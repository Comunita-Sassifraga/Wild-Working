-- Booking and cancellation — SPEC §6.3, §6.4, §12 step 5.
--
-- The write path finally applies the five conditions of §5.2 through
-- sede_prenotabile(), the same function the availability grid goes through:
-- one answer, not two (CLAUDE.md conventions). Concurrency stays where it
-- was, on the unique index of §8.1 — nothing here counts rows before
-- inserting (rule 5).
--
-- Error codes, matched by lib/db/prenotazioni.ts:
--   PS001  posti esauriti
--   PS002  prenotazione duplicata  — one active booking per person per fascia
--   PS003  sede non disponibile    — unknown or switched-off sede
--   PS004  fuori finestra          — past day, or beyond today + FINESTRA_GIORNI
--   PS005  sede chiusa             — out of season, chiusura, or closed weekday
--   PS006  giornata incompleta     — one of the two fasce is full (hint: which)

-- ---------------------------------------------------------------------------
-- prenota_slot — the single write path. prenota_posto and prenota_giornata
-- are the two doors onto it; nothing else inserts a prenotazione.
--
-- SECURITY INVOKER: the RLS insert policy still applies, so a person can only
-- book in their own name.
-- ---------------------------------------------------------------------------
create function public.prenota_slot(
  p_sede_id uuid,
  p_data date,
  p_fascia public.fascia,
  p_gruppo uuid
)
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

  -- The window is re-evaluated here, at write time, never at page load
  -- (§8.4): a request sent at 23:59 for a day that has just left the window
  -- is refused. sede_prenotabile() below tests the window too — this test
  -- exists only to tell the two refusals apart in the message.
  if p_data < public.oggi_roma() or p_data > public.fine_finestra() then
    raise exception 'fuori finestra' using errcode = 'PS004';
  end if;

  if not public.sede_prenotabile(p_sede_id, p_data, p_fascia) then
    raise exception 'sede chiusa' using errcode = 'PS005';
  end if;

  for v_n in 1..v_capienza loop
    begin
      insert into public.prenotazioni (utente_id, sede_id, data, fascia, posto_progressivo, gruppo_id)
      values (v_utente, p_sede_id, p_data, p_fascia, v_n, p_gruppo)
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

revoke execute on function public.prenota_slot(uuid, date, public.fascia, uuid) from public, anon;
grant execute on function public.prenota_slot(uuid, date, public.fascia, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- One fascia. Unchanged as seen from outside: same name, same arguments, same
-- return. It now refuses a day the sede is not open on, which it did not.
-- ---------------------------------------------------------------------------
create or replace function public.prenota_posto(p_sede_id uuid, p_data date, p_fascia public.fascia)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.prenota_slot(p_sede_id, p_data, p_fascia, null)
$$;

-- ---------------------------------------------------------------------------
-- Giornata intera — §3, §6.3. Two prenotazioni sharing a gruppo_id; never a
-- third value of the fascia enum.
--
-- All or nothing: a function body is one transaction, so if the second fascia
-- does not fit, the first one is undone with it and the caller is told which
-- fascia was full (in the hint). A whole-day request never settles for half a
-- day without the person choosing it (§6.3, added in this step).
-- ---------------------------------------------------------------------------
create function public.prenota_giornata(p_sede_id uuid, p_data date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_gruppo uuid := gen_random_uuid();
  v_fascia public.fascia;
begin
  foreach v_fascia in array enum_range(null::public.fascia) loop
    begin
      perform public.prenota_slot(p_sede_id, p_data, v_fascia, v_gruppo);
    exception
      when sqlstate 'PS001' then
        raise exception 'giornata incompleta'
          using errcode = 'PS006', hint = v_fascia::text;
    end;
  end loop;
  return v_gruppo;
end
$$;

revoke execute on function public.prenota_giornata(uuid, date) from public, anon;
grant execute on function public.prenota_giornata(uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The cancellation limit of SPEC §6.4: "sempre possibile, fino all'orario di
-- inizio della fascia". Compared in Italian wall-clock time, like every other
-- date computation in the app (§8.4).
-- ---------------------------------------------------------------------------
create function public.annullabile(p_sede_id uuid, p_data date, p_fascia public.fascia)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_data + public.ora_inizio(p_sede_id, p_fascia))
           > (now() at time zone 'Europe/Rome')
$$;

comment on function public.annullabile(uuid, date, public.fascia) is
  'SPEC §6.4: a booking can be cancelled until its fascia begins.';

-- The cancellation policy gains that condition. Everything else stands: the
-- only updatable column is stato, its only value ANNULLATA, and nobody can
-- touch someone else''s booking (rule 6).
drop policy prenotazioni_annullamento_proprio on public.prenotazioni;

create policy prenotazioni_annullamento_proprio on public.prenotazioni
  for update to authenticated
  using (
    utente_id = (select auth.uid())
    and stato = 'ATTIVA'
    and public.annullabile(sede_id, data, fascia)
  )
  with check (utente_id = (select auth.uid()) and stato = 'ANNULLATA');

-- ---------------------------------------------------------------------------
-- "Le mie prenotazioni" — the page SPEC §6.4 calls "la propria pagina",
-- described there as part of this step.
--
-- Active bookings from today to the end of the window, with what the page
-- has to show: sede, comune, indirizzo, the practical `note` (authenticated
-- only, §5.2), the hours of the fascia, and whether it can still be
-- cancelled. Never posto_progressivo (§8.1).
--
-- security_invoker = false so that a booking stays visible to its owner even
-- if the sede has been switched off in the meantime (§8.4). The WHERE clause
-- pins the rows to the caller, and the view is granted to authenticated only:
-- a visitor cannot reach it, and no row of another person can come out of it.
-- ---------------------------------------------------------------------------
create view public.mie_prenotazioni
with (security_invoker = false)
as
  select p.id, p.sede_id, p.data, p.fascia, p.gruppo_id, p.creata_il,
         s.nome as sede_nome,
         s.comune,
         s.indirizzo,
         s.note,
         public.ora_inizio(s.id, p.fascia) as ora_inizio,
         case p.fascia
           when 'MATTINA' then s.ora_fine_mattina
           else s.ora_fine_pomeriggio
         end as ora_fine,
         public.annullabile(p.sede_id, p.data, p.fascia) as annullabile
  from public.prenotazioni p
  join public.sedi s on s.id = p.sede_id
  where p.utente_id = (select auth.uid())
    and p.stato = 'ATTIVA'
    and p.data >= public.oggi_roma();

comment on view public.mie_prenotazioni is
  'SPEC §6.4. Own active bookings, today onwards. Never another person''s row.';

grant select on public.mie_prenotazioni to authenticated;
