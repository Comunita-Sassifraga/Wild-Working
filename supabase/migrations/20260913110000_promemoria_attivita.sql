-- «Prenota un abitante» — the emails of the module.
-- SPEC §15.14 step 19, §15.10, §15.12.
--
-- Step 18 already brought the two messages §15.9 makes a condition of the
-- amministratore's own actions. This step brings the other four, and the
-- database has to prepare two of them:
--
--   * the reminder of the evening before, which acquires a SECOND LIST on
--     the nightly run that already exists (§15.10). Not a second run, not a
--     second schedule, and not one line changed in the reminder of §6.3 —
--     that one is in service, and §15.14 names it as what this step can
--     break;
--   * the notice to everybody who loses a place when an activity is called
--     off (§15.12), for which annulla_attivita() must say WHO lost it and
--     not only how many.
--
-- The confirmation and the cancellation of §15.10 need nothing here: both
-- are sent by the page that wrote the row, from data the caller is already
-- entitled to read.
--
-- Additive, like every file of this module (rule 20): the nine tables that
-- existed before the module are not touched. `iscrizioni` gains the column
-- the nightly job remembers itself by — the same column, with the same
-- rules, that `prenotazioni` has carried since step 9.

-- ===========================================================================
-- When the reminder for an iscrizione went out.
--
-- The memory of the job and nothing else. Reads of `iscrizioni` are granted
-- column by column (see *_abitanti.sql), so a column added here is readable
-- by nobody at all — not by the holder, not by the amministratore — without
-- a single line of policy. NULL means "not sent yet".
--
-- SPEC §15.3.3 gains the corresponding row in the same commit as this file.
-- ===========================================================================
alter table public.iscrizioni add column promemoria_inviato_il timestamptz;

comment on column public.iscrizioni.promemoria_inviato_il is
  'SPEC §6.3, §15.10. Set by promemoria_attivita_da_inviare() when the reminder is taken in charge. Job only: never granted, never in a view.';

-- Only the rows still to be reminded are ever looked up. The date lives on
-- `attivita`, so the index is on what this table can offer: the activity and
-- the state.
create index iscrizioni_promemoria_da_fare
  on public.iscrizioni (attivita_id)
  where stato = 'ATTIVA' and promemoria_inviato_il is null;

-- ===========================================================================
-- promemoria_attivita_da_inviare — takes tomorrow's iscrizioni in charge and
-- returns what the message has to say.
--
-- A deliberate twin of promemoria_da_inviare(), down to the shape: claiming
-- and reading are one statement, so a second run, or two overlapping runs,
-- find nothing left to claim and send nothing (rule 5, §6.3). The cost is the
-- same one §6.3 accepted: a row is marked before the provider confirms, so a
-- failed send is a reminder lost, never a reminder sent twice.
--
-- It returns the LEVEL 2 fields of §15.8 — surname, telephone, exact address.
-- Everybody in this result holds an ATTIVA iscrizione on the activity, which
-- is exactly the condition §15.8 puts on level 2, and it is what the evening
-- before is for: the address to walk to and the number to ring if something
-- goes wrong. The confirmation email already carried them (§15.10).
--
-- `descrizione` is not returned. It is the abitante's own words, up to 4000
-- characters, and it belongs on the page where it can be read whole (rule 26).
--
-- What it deliberately does NOT check: the state of the activity. An
-- iscrizione that is still ATTIVA is a place somebody still holds, and an
-- activity withdrawn to BOZZA after they took it leaves them enrolled on
-- purpose (§15.12: "Gli iscritti restano e vanno avvisati a mano"). It is the
-- same reading as §6.3 for a `chiusura` entered after a booking: the reminder
-- still goes out, because the row is real until a person acts on it (rule 6).
-- An ANNULLATA activity does not arise — annulla_attivita() cancels its
-- iscrizioni in the same statement — and if one ever did, its iscrizioni
-- would no longer be ATTIVA.
--
-- SECURITY INVOKER, so `current_user` is the role that called: the guard and
-- the EXECUTE grant say the same thing twice, and a future grant by mistake
-- would still not open the function to a signed-in person.
--
-- p_giorno exists for the tests. In production the job passes nothing and the
-- day is always tomorrow, in Europe/Rome like every other date (§8.4).
-- ===========================================================================
create function public.promemoria_attivita_da_inviare(p_giorno date default null)
returns table (
  iscrizione_id     uuid,
  utente_id         uuid,
  email             text,
  attivita_id       uuid,
  titolo            text,
  data              date,
  ora_inizio        time,
  ora_fine          time,
  luogo_generico    text,
  luogo_esatto      text,
  abitante_nome     text,
  abitante_cognome  text,
  abitante_telefono text,
  cosa_portare      text,
  lingua_attivita   text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_giorno date := coalesce(p_giorno, public.oggi_roma() + 1);
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  return query
  with prese as (
    update public.iscrizioni i
       set promemoria_inviato_il = now()
     where i.stato = 'ATTIVA'
       and not i.anonimizzata
       and i.promemoria_inviato_il is null
       and i.attivita_id in (
         select a.id from public.attivita a where a.data = v_giorno
       )
    returning i.id, i.utente_id, i.attivita_id
  )
  select x.id,
         x.utente_id,
         u.email,
         a.id,
         a.titolo,
         a.data,
         a.ora_inizio,
         a.ora_fine,
         a.luogo_generico,
         a.luogo_esatto,
         a.abitante_nome,
         a.abitante_cognome,
         a.abitante_telefono,
         a.cosa_portare,
         a.lingua_attivita
    from prese x
    join public.utenti u on u.id = x.utente_id
    join public.attivita a on a.id = x.attivita_id
   order by x.utente_id, a.data, a.ora_inizio;
end
$$;

comment on function public.promemoria_attivita_da_inviare(date) is
  'SPEC §15.10. Claims tomorrow''s active iscrizioni and returns them once, level 2 included. Backend job only.';

revoke all on function public.promemoria_attivita_da_inviare(date) from public, anon, authenticated;
grant execute on function public.promemoria_attivita_da_inviare(date) to service_role;

-- ===========================================================================
-- annulla_attivita — unchanged in what it does, changed in what it says.
--
-- §15.12 asks that everybody enrolled receive an email when an activity is
-- called off. Step 16 could only count them, and the panel said so in
-- writing: "Scrivi tu a ciascuna per dirglielo." Now the message goes out by
-- itself, and to send it the caller needs the people, not the number.
--
-- Returning them from the same statement that cancels them is not a
-- convenience: reading the iscritti first and cancelling after would leave a
-- gap in which somebody takes the last place and is never told the activity
-- is off. The set that comes back is exactly the set that was cancelled.
--
-- Dropped and recreated because the return type changes. Everything else is
-- as step 16 wrote it: the amministratore guard, the AT003 refusal, and
-- `annullata_da` saying for ever who signed the act. Rule 6 is intact for the
-- same reason it was then — it forbids an AUTOMATIC cancellation, not one a
-- person decides (§15.12, rule 29).
-- ===========================================================================
drop function public.annulla_attivita(uuid);

create function public.annulla_attivita(p_id uuid)
returns table (utente_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  update public.attivita set stato = 'ANNULLATA' where id = p_id;

  if not found then
    raise exception 'attivita inesistente' using errcode = 'AT003';
  end if;

  -- Who has just lost a place, so the caller can write to them (§15.10).
  -- An id is not a name and not an address: the address is read afterwards,
  -- by the backend client, and never reaches whoever pressed the button
  -- (rule 4).
  return query
  with annullate as (
    update public.iscrizioni i
       set stato        = 'ANNULLATA',
           annullata_da = (select auth.uid())
     where i.attivita_id = p_id
       and i.stato = 'ATTIVA'
    returning i.utente_id as persona
  )
  select annullate.persona from annullate;
end
$$;

revoke execute on function public.annulla_attivita(uuid) from public, anon;
grant execute on function public.annulla_attivita(uuid) to authenticated, service_role;

comment on function public.annulla_attivita(uuid) is
  'SPEC §15.12. ANNULLATA, and its ATTIVA iscrizioni with it, traced in annullata_da. Returns who to write to (§15.10).';
