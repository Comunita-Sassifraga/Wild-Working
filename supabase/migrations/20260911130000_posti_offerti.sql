-- Seats offered, night by night — SPEC §6.8, §5.2, §12 step 11.
--
-- §6.8 asks for an average occupancy rate per sede and per fascia. That is a
-- fraction, and only its numerator is safe: bookings keep sede, data, fascia
-- and stato forever, anonymisation cuts the person and nothing else (§5.3).
--
-- The DENOMINATOR has no memory at all. How many seats a sede offered on a
-- past day depends on four things an admin edits from the panel without
-- leaving a trace: the capienza, the giorni_apertura, the periodi_attivita
-- and the chiusure (§5.2). Raise a capienza in March and every month before
-- it is silently recomputed against the new number; shorten a season and days
-- that were open stop having been open. The rate would be wrong, and wrong in
-- a way nobody can notice by reading it.
--
-- So the offer is written down while it is still true, the same discipline
-- persone_per_mese (§6.8) and the stat_ columns (§5.3) already follow: one
-- row per giorno, sede and fascia, saying how many seats there were to take.
-- A day the sede was shut records 0 — which is not the same as recording
-- nothing, and is how a gap in the job is told apart from a closed Sunday.
--
-- What this can and cannot do:
--   * it records from the day it is put to work, never backwards. There is
--     no way to reconstruct the past, which is the whole reason it exists;
--   * a run that skips some nights fills them in at the next one, but with
--     tonight's settings — an approximation, and the only one here;
--   * it says what was OFFERED, never who took it. A giorno, a sede, a
--     fascia and a number: no row is about a person (rule 15).
--
-- Step 12 reads this table. It is the one that will open it to the
-- amministratore, together with the rest of the statistics.

-- ---------------------------------------------------------------------------
-- sede_aperta — the four conditions of §5.2 that are about the sede.
--
-- §5.2 has five conditions and sede_prenotabile has always held all five in
-- one place, which is the rule (CLAUDE.md, §8.3). Four of them describe the
-- sede on a day; the fifth, the booking window, describes the calendar and is
-- false for every day already gone.
--
-- Recording yesterday's offer needs the four without the fifth, so the four
-- get a name and sede_prenotabile is rewritten in terms of it. Nothing is
-- copied and nothing changes: the conditions still live in exactly one place,
-- and sede_prenotabile still answers what it answered before.
-- ---------------------------------------------------------------------------
create function public.sede_aperta(p_sede_id uuid, p_data date, p_fascia public.fascia)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sedi s
    where s.id = p_sede_id
      and s.attiva
      and public.sede_in_stagione(s.id, p_data)
      and not public.in_chiusura(s.id, p_data, p_fascia)
      and public.giorno_di(p_data) = any (s.giorni_apertura)
  )
$$;

comment on function public.sede_aperta(uuid, date, public.fascia) is
  'SPEC §5.2 conditions 1, 2, 3 and 5: the sede is open that day and fascia. Says nothing about the booking window — see sede_prenotabile.';

-- sede_aperta comes first in the AND on purpose: it is an EXISTS and is never
-- null, so a null date still answers false here as it did before.
create or replace function public.sede_prenotabile(p_sede_id uuid, p_data date, p_fascia public.fascia)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.sede_aperta(p_sede_id, p_data, p_fascia)
     and p_data between public.oggi_roma() and public.fine_finestra()
$$;

comment on function public.sede_prenotabile(uuid, date, public.fascia) is
  'The five bookability conditions of SPEC §5.2: sede_aperta plus the window of §6.3. Single source of truth: the availability view, the public page and prenota_posto all go through this.';

-- ---------------------------------------------------------------------------
-- The table.
--
-- `posti` is what there was to take: the capienza when the sede was open that
-- day and fascia, 0 when it was not — suspended, out of season, closed for
-- the day, closed for that fascia alone, or open with no seats. Step 12
-- divides by the sum of this column over the days it was above zero: the rate
-- measures the spaces when they are there, so a shut day weighs on neither
-- side of the fraction (decision of 2026-09-11).
--
-- The key is the day, the sede and the fascia together, which is what makes
-- the nightly write idempotent: a second run of the same night, or two runs
-- overlapping, find the row already there and leave it alone. What is written
-- once is never rewritten — a number that changes later is a number that has
-- forgotten what it was for.
--
-- RLS on and no policy at all: the table belongs to the automatic job until
-- step 12 opens it (rule 2, same as persone_per_mese and richieste_link).
--
-- ON DELETE CASCADE for the same reason persone_per_mese has it: a sede with
-- bookings cannot be deleted, so this hardly ever fires, and a record that no
-- longer knows which sede it speaks of is worse than no record.
-- ---------------------------------------------------------------------------
create table public.posti_offerti (
  data     date not null,
  sede_id  uuid not null references public.sedi (id) on delete cascade,
  fascia   public.fascia not null,
  posti    integer not null check (posti >= 0),

  primary key (data, sede_id, fascia)
);

alter table public.posti_offerti enable row level security;

comment on table public.posti_offerti is
  'SPEC §6.8. Seats offered per giorno, sede and fascia, written the night after. The denominator of the occupancy rate: only counts, never a person (rule 15).';
comment on column public.posti_offerti.posti is
  'Capienza of that day and fascia, 0 when the sede was shut. 0 and "no row" are different things: no row means the job never ran for that day.';

-- ---------------------------------------------------------------------------
-- registra_posti_offerti — the nightly write.
--
-- Records every day still missing, up to and including the one that just
-- ended. Normally that is a single day; after a stop it is the whole gap,
-- read with the settings of tonight, which is the approximation the header
-- names. Nothing before the first run is ever recorded: the first night
-- writes the day before itself and no further back.
--
-- The insert crosses the days with the sedi that exist tonight and with both
-- fasce, so a sede created today starts being recorded from today on, and one
-- switched off keeps being recorded with 0 — which is exactly the fact that
-- it was shut.
--
-- SECURITY INVOKER with the guard and the grant saying the same thing twice,
-- as in promemoria_da_inviare and the cleanups: a grant added by mistake
-- would still not open this to a signed-in person.
--
-- p_fino_a and p_da exist for the tests. In production the job passes
-- nothing: the day is yesterday in Europe/Rome, like every other date (§8.4).
-- ---------------------------------------------------------------------------
create function public.registra_posti_offerti(
  p_fino_a date default null,
  p_da     date default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fino_a date;
  v_da     date;
  v_n      integer;
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  v_fino_a := coalesce(p_fino_a, public.oggi_roma() - 1);

  -- Where to start: the day after the last one on record. With nothing on
  -- record — the first night — only the day that just ended.
  if p_da is not null then
    v_da := p_da;
  else
    select coalesce(max(o.data) + 1, v_fino_a) into v_da from public.posti_offerti o;
  end if;

  if v_da > v_fino_a then
    return 0;
  end if;

  insert into public.posti_offerti (data, sede_id, fascia, posti)
  select g::date,
         s.id,
         f,
         case when public.sede_aperta(s.id, g::date, f) then s.capienza else 0 end
    from generate_series(v_da::timestamp, v_fino_a::timestamp, interval '1 day') g
   cross join public.sedi s
   cross join unnest(enum_range(null::public.fascia)) f
      on conflict (data, sede_id, fascia) do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.registra_posti_offerti(date, date) is
  'SPEC §6.8. Writes down the seats offered on every day not yet recorded, up to yesterday. Idempotent: a day already written is never touched again.';

revoke all on function public.registra_posti_offerti(date, date) from public, anon, authenticated;
grant execute on function public.registra_posti_offerti(date, date) to service_role;
