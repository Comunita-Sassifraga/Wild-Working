-- prenotazioni — SPEC §5.3, §8.1, §6.3.
--
-- Concurrency is enforced by the database, never by a read-then-write check
-- (CLAUDE.md rule 5): the unique index on (sede_id, data, fascia,
-- posto_progressivo) rejects the second of two simultaneous bookings for the
-- last seat, and prenota_posto() retries with the next number.

create table public.prenotazioni (
  id                  uuid primary key default gen_random_uuid(),
  -- NULL once anonymised: the link to the person is cut (§5.3).
  -- RESTRICT: an account is never deleted with bookings still attached; the
  -- erasure flow (step 10) anonymises first, without copying stat_*.
  utente_id           uuid references public.utenti (id) on delete restrict,
  sede_id             uuid not null references public.sedi (id) on delete restrict,
  data                date not null,
  fascia              public.fascia not null,
  -- Internal seat number 1..capienza. Never shown to users (§8.1).
  posto_progressivo   integer not null check (posto_progressivo >= 1),
  -- Links the two bookings of a "giornata intera" (§3).
  gruppo_id           uuid,
  stato               public.stato_prenotazione not null default 'ATTIVA',
  creata_il           timestamptz not null default now(),
  anonimizzata        boolean not null default false,
  -- Snapshot of the five optional values, copied ONCE at anonymisation and
  -- only if DATI_FACOLTATIVI consent is active then; never on an art. 17
  -- erasure (§5.3, rule 19). Readable by the statistics engine only.
  stat_eta            public.fascia_eta,
  stat_genere         public.genere,
  stat_professione    text check (char_length(stat_professione) <= 100),
  stat_motivo_visita  text check (char_length(stat_motivo_visita) <= 200),
  stat_residenza      public.residenza,

  -- Anonymised if and only if the user link is gone.
  constraint prenotazioni_anonimizzata_senza_utente
    check (anonimizzata = (utente_id is null)),
  -- Before anonymisation the optional data lives in exactly one place.
  constraint prenotazioni_stat_solo_anonimizzate
    check (
      anonimizzata
      or (stat_eta is null and stat_genere is null and stat_professione is null
          and stat_motivo_visita is null and stat_residenza is null)
    )
);

-- §8.1: one seat number per sede/day/fascia among ACTIVE bookings. A
-- cancelled booking releases its number.
create unique index prenotazioni_posto_unico
  on public.prenotazioni (sede_id, data, fascia, posto_progressivo)
  where stato = 'ATTIVA';

-- §6.3: one active booking per person per day/fascia, across all sedi.
create unique index prenotazioni_una_per_fascia
  on public.prenotazioni (utente_id, data, fascia)
  where stato = 'ATTIVA';

create index prenotazioni_utente on public.prenotazioni (utente_id);
create index prenotazioni_sede_data on public.prenotazioni (sede_id, data);

alter table public.prenotazioni enable row level security;

comment on table public.prenotazioni is 'SPEC §5.3. Seat uniqueness enforced by index prenotazioni_posto_unico (§8.1).';
comment on column public.prenotazioni.posto_progressivo is 'Internal. Never shown to users (SPEC §8.1).';

-- ---------------------------------------------------------------------------
-- prenota_posto — the only write path for a new booking.
--
-- Runs with the caller's privileges (SECURITY INVOKER): the RLS insert policy
-- on prenotazioni still applies, so a user can only book in their own name.
-- Tries seat numbers 1..capienza; the unique index decides who wins a race.
--
-- Error codes (matched by lib/db/prenotazioni.ts):
--   PS001  posti esauriti        — every seat number is taken
--   PS002  prenotazione duplicata — caller already has an active booking on
--                                   that day and fascia (§6.3)
--   PS003  sede non disponibile  — unknown or switched-off sede
--
-- Step 5 of SPEC §12 adds the remaining bookability checks (window, chiusure,
-- periodi_attivita, giorni_apertura) inside this function, mirroring
-- isSedeBookable. They are deliberately absent here.
-- ---------------------------------------------------------------------------
create function public.prenota_posto(p_sede_id uuid, p_data date, p_fascia public.fascia)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_utente      uuid := (select auth.uid());
  v_capienza    integer;
  v_id          uuid;
  v_n           integer;
  v_constraint  text;
begin
  if v_utente is null then
    raise exception 'accesso richiesto' using errcode = '28000';
  end if;

  select s.capienza into v_capienza
  from public.sedi s
  where s.id = p_sede_id and s.attiva;

  if v_capienza is null then
    raise exception 'sede non disponibile' using errcode = 'PS003';
  end if;

  for v_n in 1..v_capienza loop
    begin
      insert into public.prenotazioni (utente_id, sede_id, data, fascia, posto_progressivo)
      values (v_utente, p_sede_id, p_data, p_fascia, v_n)
      returning id into v_id;
      return v_id;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'prenotazioni_una_per_fascia' then
          raise exception 'prenotazione duplicata' using errcode = 'PS002';
        end if;
        -- Seat v_n was taken by a concurrent booking: try the next one.
    end;
  end loop;

  raise exception 'posti esauriti' using errcode = 'PS001';
end
$$;

-- Functions are executable by everyone by default (PUBLIC). Only a signed-in
-- person or the backend may call this one.
revoke execute on function public.prenota_posto(uuid, date, public.fascia) from public, anon;
grant execute on function public.prenota_posto(uuid, date, public.fascia) to authenticated, service_role;
