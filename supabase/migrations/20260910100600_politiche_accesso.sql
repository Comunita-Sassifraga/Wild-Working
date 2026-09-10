-- Access policies, grants and views — SPEC §4, §8.3, §6.5, §6.6, §6.8, §5.3.
--
-- Who sees what is decided here, in the database, never in a page
-- (CLAUDE.md rules 2, 3, 15, 16). Reading order:
--   1. views (created first so the blanket revoke below covers them too)
--   2. revoke everything from anon and authenticated
--   3. per-table grants (table- and column-level) and RLS policies
--
-- Roles: anon = visitor; authenticated = registered user, referente and
-- amministratore (told apart by incarichi through is_amministratore() and
-- is_referente_di()); service_role = backend jobs only.

-- ===========================================================================
-- 1. Views
--
-- The views below run with the privileges of their owner (postgres), not of
-- the caller: security_invoker = false. That is deliberate. They are the
-- only doors through which a visitor sees anything about bookings, and
-- through which a referente or an amministratore sees another person's
-- email. Each exposes a fixed list of columns and its own WHERE clause;
-- the base tables stay closed. Supabase's advisor flags such views —
-- accepted and documented here.
-- ===========================================================================

-- Sedi as the public sees them: active only, without `note` (§5.2).
create view public.sedi_pubbliche
with (security_invoker = false)
as
  select s.id, s.nome, s.comune, s.indirizzo, s.coordinate, s.capienza,
         s.orario_mattina, s.orario_pomeriggio, s.giorni_apertura,
         s.sempre_disponibile
  from public.sedi s
  where s.attiva;

-- Active bookings per sede/day/fascia inside the window (§6.2, §6.6).
-- Counts only: the number of people who did not consent to a public name is
-- prenotati minus the rows of presenze_pubbliche for the same slot.
create view public.occupazione_pubblica
with (security_invoker = false)
as
  select p.sede_id, p.data, p.fascia, count(*)::integer as prenotati
  from public.prenotazioni p
  join public.sedi s on s.id = p.sede_id
  where p.stato = 'ATTIVA'
    and s.attiva
    and p.data between public.oggi_roma() and public.fine_finestra()
  group by p.sede_id, p.data, p.fascia;

-- Public names of who will be there (§6.6). Only with mostra_nome_pubblico
-- on (rule 3), only inside the window, never the past (rule 8), and no
-- identifier of any kind: nothing links a name back to a row.
create view public.presenze_pubbliche
with (security_invoker = false)
as
  select p.sede_id, p.data, p.fascia, u.nome_pubblico
  from public.prenotazioni p
  join public.utenti u on u.id = p.utente_id
  join public.sedi s on s.id = p.sede_id
  where p.stato = 'ATTIVA'
    and s.attiva
    and u.mostra_nome_pubblico
    and u.nome_pubblico is not null
    and p.data between public.oggi_roma() and public.fine_finestra();

-- Referente: nominative list of the assigned sede only, window only (§4, §7).
-- Email always; nome_pubblico only when the user shows it. None of the five
-- optional fields, none of the stat_* columns (rule 16).
create view public.prenotazioni_referente
with (security_invoker = false)
as
  select p.id, p.sede_id, p.data, p.fascia, p.gruppo_id, p.creata_il,
         u.email,
         case when u.mostra_nome_pubblico then u.nome_pubblico end as nome_pubblico
  from public.prenotazioni p
  join public.utenti u on u.id = p.utente_id
  where p.stato = 'ATTIVA'
    and public.is_referente_di(p.sede_id)
    and p.data between public.oggi_roma() and public.fine_finestra();

-- Amministratore: the only way to read other users. Email, public name,
-- switch, language, dates — and NOT eta, genere, professione, motivo_visita,
-- residenza, which reach the admin in aggregate form only (§6.5, §6.8,
-- rules 15 and 16).
create view public.utenti_amministrazione
with (security_invoker = false)
as
  select u.id, u.email, u.nome_pubblico, u.mostra_nome_pubblico, u.lingua,
         u.creato_il, u.ultimo_accesso
  from public.utenti u
  where public.is_amministratore();

-- ===========================================================================
-- 2. Close everything, then open exactly what each role needs.
-- ===========================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ===========================================================================
-- 3. Grants and policies, table by table
-- ===========================================================================

-- sedi ---------------------------------------------------------------------
-- Visitors go through sedi_pubbliche. Registered users read the table
-- (including note); only an amministratore writes it.
grant select on public.sedi_pubbliche to anon, authenticated;
grant select, insert, update, delete on public.sedi to authenticated;

create policy sedi_lettura_registrati on public.sedi
  for select to authenticated
  using (attiva or public.is_amministratore());

create policy sedi_inserimento_admin on public.sedi
  for insert to authenticated
  with check (public.is_amministratore());

create policy sedi_modifica_admin on public.sedi
  for update to authenticated
  using (public.is_amministratore())
  with check (public.is_amministratore());

create policy sedi_cancellazione_admin on public.sedi
  for delete to authenticated
  using (public.is_amministratore());

-- periodi_attivita --------------------------------------------------------
-- Needed by the availability grid, which is public (§6.2).
grant select on public.periodi_attivita to anon, authenticated;
grant insert, update, delete on public.periodi_attivita to authenticated;

create policy periodi_lettura on public.periodi_attivita
  for select to anon, authenticated
  using (public.sede_attiva(sede_id) or public.is_amministratore());

create policy periodi_inserimento_admin on public.periodi_attivita
  for insert to authenticated
  with check (public.is_amministratore());

create policy periodi_modifica_admin on public.periodi_attivita
  for update to authenticated
  using (public.is_amministratore())
  with check (public.is_amministratore());

create policy periodi_cancellazione_admin on public.periodi_attivita
  for delete to authenticated
  using (public.is_amministratore());

-- chiusure -----------------------------------------------------------------
-- Public read without creata_da (an internal user id). Only an amministratore
-- writes: the referente's "segnalare una chiusura" (§4) is defined at step 8.
grant select (id, sede_id, data_inizio, data_fine, fascia) on public.chiusure to anon;
grant select on public.chiusure to authenticated;
grant insert, update, delete on public.chiusure to authenticated;

create policy chiusure_lettura on public.chiusure
  for select to anon, authenticated
  using (public.sede_attiva(sede_id) or public.is_amministratore());

create policy chiusure_inserimento_admin on public.chiusure
  for insert to authenticated
  with check (public.is_amministratore());

create policy chiusure_modifica_admin on public.chiusure
  for update to authenticated
  using (public.is_amministratore())
  with check (public.is_amministratore());

create policy chiusure_cancellazione_admin on public.chiusure
  for delete to authenticated
  using (public.is_amministratore());

-- utenti -------------------------------------------------------------------
-- A person reads and edits their own row. Nobody else reads the table: the
-- amministratore uses utenti_amministrazione, the referente uses
-- prenotazioni_referente, the visitor uses presenze_pubbliche. Email changes
-- only through Auth (mirrored by trigger), so it is not updatable here. Rows
-- are created by the Auth trigger and deleted with the Auth user: no insert
-- or delete grant.
grant select on public.utenti to authenticated;
grant update (nome_pubblico, eta, genere, professione, motivo_visita, residenza,
              mostra_nome_pubblico, lingua, ultimo_accesso)
  on public.utenti to authenticated;
grant select on public.utenti_amministrazione to authenticated;

create policy utenti_propria_riga_lettura on public.utenti
  for select to authenticated
  using (id = (select auth.uid()));

create policy utenti_propria_riga_modifica on public.utenti
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- incarichi ----------------------------------------------------------------
grant select, insert, update, delete on public.incarichi to authenticated;

create policy incarichi_lettura on public.incarichi
  for select to authenticated
  using (utente_id = (select auth.uid()) or public.is_amministratore());

create policy incarichi_inserimento_admin on public.incarichi
  for insert to authenticated
  with check (public.is_amministratore());

create policy incarichi_modifica_admin on public.incarichi
  for update to authenticated
  using (public.is_amministratore())
  with check (public.is_amministratore());

create policy incarichi_cancellazione_admin on public.incarichi
  for delete to authenticated
  using (public.is_amministratore());

-- consensi -----------------------------------------------------------------
-- Own rows for the person (art. 15), all rows for the amministratore. No
-- insert grant: rows come from the trigger. No update or delete for anyone
-- (append-only, guarded by trigger as well).
grant select on public.consensi to authenticated;

create policy consensi_lettura on public.consensi
  for select to authenticated
  using (utente_id = (select auth.uid()) or public.is_amministratore());

-- prenotazioni -------------------------------------------------------------
-- Column-level: posto_progressivo is never readable by a user (§8.1) and the
-- five stat_* columns are readable and writable by service_role only (§5.3,
-- rule 16). The insert grant on posto_progressivo exists solely for
-- prenota_posto(), which runs as the caller.
grant select (id, utente_id, sede_id, data, fascia, gruppo_id, stato, creata_il, anonimizzata)
  on public.prenotazioni to authenticated;
grant insert (utente_id, sede_id, data, fascia, posto_progressivo, gruppo_id)
  on public.prenotazioni to authenticated;
grant update (stato) on public.prenotazioni to authenticated;
grant select on public.occupazione_pubblica to anon, authenticated;
grant select on public.presenze_pubbliche to anon, authenticated;
grant select on public.prenotazioni_referente to authenticated;

-- Own bookings, or every booking for the amministratore (§4). Anonymised
-- rows have no owner and are reachable by the amministratore only.
create policy prenotazioni_lettura on public.prenotazioni
  for select to authenticated
  using (utente_id = (select auth.uid()) or public.is_amministratore());

-- Only in one's own name, only active, only with the person attached.
create policy prenotazioni_inserimento_proprio on public.prenotazioni
  for insert to authenticated
  with check (
    utente_id = (select auth.uid())
    and stato = 'ATTIVA'
    and not anonimizzata
  );

-- A person may cancel an active booking of their own, and nothing else:
-- the only updatable column is stato, and the only value it may take is
-- ANNULLATA. Cancelling someone else's booking is never automatic and, in
-- this step, not possible for anyone (rule 6; admin intervention is step 8).
create policy prenotazioni_annullamento_proprio on public.prenotazioni
  for update to authenticated
  using (utente_id = (select auth.uid()) and stato = 'ATTIVA')
  with check (utente_id = (select auth.uid()) and stato = 'ANNULLATA');
