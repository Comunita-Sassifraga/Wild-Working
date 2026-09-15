-- The practical information of a sede becomes reserved — SPEC §5.2, D26.
--
-- Until now `sedi.note` held "Wi-Fi, chiavi, accesso, dotazioni" and was
-- readable by every signed-in person, whether or not they had ever booked
-- anything; the spec forbade writing a password or an access code into it.
-- Decision of 15/09/2026 (D26) turns that around: the column now holds
-- exactly those things — how to get in, the door code, the Wi-Fi password —
-- and is read only by somebody who has an active booking at that sede, plus
-- the referente of that sede, plus the amministratore.
--
-- Whoever is still choosing where to work has the free seats, the hours and
-- the position on the map (§6.2), all of them public. Knowing how to get in
-- is useful to whoever is getting in.
--
-- The limit is imposed here and not in the pages (§8.3, rule 3's reasoning).
-- A row-level policy cannot state it: RLS decides which rows come out, and
-- the requirement is about one column of a row everybody may otherwise read.
-- Column privileges can, and are already used the same way on `utenti` for
-- the five optional fields of §5.1: the grant is restated column by column
-- without `note`, and three views stand as the only doors to it.
--
-- Nothing is done to `mie_prenotazioni` or to `promemoria_da_inviare`: the
-- first already carries `note` and is owned by the table's owner, so the
-- narrower grant does not reach it, and the second runs as service_role,
-- which this file does not touch.

-- ---------------------------------------------------------------------------
-- 1. Take `note` away from every signed-in person.
--
-- `revoke select` then `grant select (columns)`: the column list is the whole
-- table minus `note`. A query that names `note` anywhere — in the list, in a
-- filter, in an order — is refused by Postgres, so the column cannot be read
-- one letter at a time either.
--
-- insert/update/delete stay as they were, on the whole table: the policies of
-- *_politiche_accesso.sql already refuse them to anyone but an
-- amministratore, so an extra column list would say nothing new.
-- ---------------------------------------------------------------------------
revoke select on public.sedi from authenticated;

grant select (
  id, nome, comune, indirizzo, coordinate, capienza,
  ora_inizio_mattina, ora_fine_mattina,
  ora_inizio_pomeriggio, ora_fine_pomeriggio,
  giorni_apertura, attiva, sempre_disponibile
) on public.sedi to authenticated;

comment on column public.sedi.note is
  'SPEC §5.2, D26. How to get in: keys, access code, Wi-Fi password. Read only through mie_prenotazioni, sedi_referente and sedi_amministrazione.';

-- ---------------------------------------------------------------------------
-- 2. The amministratore's door: the whole row, suspended sedi included.
--
-- The panel writes `note` from here on, so it has to read it back; the table
-- itself no longer hands it over. security_invoker = false for the same
-- reason as utenti_amministrazione: the view, not the caller, holds the
-- privilege, and the where clause is what decides who gets a row.
-- ---------------------------------------------------------------------------
create view public.sedi_amministrazione
with (security_invoker = false)
as
  select s.*
  from public.sedi s
  where public.is_amministratore();

comment on view public.sedi_amministrazione is
  'SPEC §6.7. Every sede with its note, to the amministratore alone.';

grant select on public.sedi_amministrazione to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The referente's door: their own sedi, always.
--
-- A referente looks after the space (§4) and needs the keys and the Wi-Fi
-- password whether or not they have booked a desk that day — booking one to
-- read the door code would be an absurd way in. Their own sedi only: the
-- condition is the same is_referente_di() that already decides which
-- bookings they see in prenotazioni_referente.
--
-- No capienza and no switches: this view answers one question, "what do I
-- need to know about the space I look after".
-- ---------------------------------------------------------------------------
create view public.sedi_referente
with (security_invoker = false)
as
  select s.id, s.nome, s.comune, s.indirizzo, s.note
  from public.sedi s
  where public.is_referente_di(s.id);

comment on view public.sedi_referente is
  'SPEC §5.2, D26. The sedi a referente looks after, with their note. Always, with or without a booking.';

grant select on public.sedi_referente to authenticated;
