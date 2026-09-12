-- «Prenota un abitante» — the list, the detail and taking a place.
-- SPEC §15.14 step 17, §15.6, §15.7, §15.2.
--
-- Additive, like every file of this module (rule 20): not one of the nine
-- existing tables is touched, and the two views of step 14 only gain columns
-- at the end — nothing that already reads them changes meaning.
--
-- Three things arrive here:
--
--   iscritti_attivita, the public names of who is already signed up. The
--   list step 14 deliberately left out, saying "who is enrolled is a
--   separate matter and arrives with step 17".
--
--   ancora_aperta, on both windows: §15.7 keeps an activity in the list
--   until the following day but takes its button away the moment it begins,
--   and a page must be able to draw that without asking the database once
--   per row.
--
--   inizio, the instant an activity starts, for the one sentence of §15.7
--   that ORE_DISDETTA governs. The threshold itself stays in
--   config/limits.ts, where every configurable value lives: the database
--   hands over the instant, TypeScript compares it with the parameter.
--
-- FINESTRA_GIORNI appears nowhere here either (rule 21).

-- ===========================================================================
-- iscritti_attivita — SPEC §15.6, §15.11, and the formula of §6.6.
--
-- The second of the exactly two places a nome_pubblico may appear (rule 8),
-- built the same way as the first: presenze_pubbliche joins prenotazioni to
-- utenti and lets through only the rows whose owner switched the name on.
-- This one does the same over iscrizioni. Nothing else comes with the name —
-- no id, no email, no utente_id — so a name that comes out of here leads
-- back to nobody, and a switch turned off removes it from every activity at
-- once, because nothing is copied anywhere.
--
-- The count of everybody else is the difference between the iscritti of
-- attivita_elenco and the names shown, exactly as §6.6 computes its own:
-- the line has to add up to the number of people who will be in the room.
--
-- Who may read it, decided on 2026-09-12 between the two readings §15.6 and
-- §15.11 left open: anybody holding an active abilitazione for the active
-- edition, enrolled on that activity or not. Choosing where to go by who
-- will be there is the reason this application exists (§1), and the audience
-- is a closed one — the forty-five participants of the edition. §15.11 is
-- amended to say so in the same commit as this file.
--
-- Two branches, each mirroring the window it serves:
--
--   the abilitazione branch mirrors attivita_elenco — published, active
--   edition, not already past, so a name stops being shown the day after the
--   activity, which is the retention §15.11 promises;
--
--   the iscritto_a branch mirrors attivita_iscritto — no edition and no date
--   bound, because §15.12 keeps an iscrizione visible to its holder through a
--   deactivated edition and a revoked abilitazione.
--
-- security_invoker = false, like every other view here: it runs as its owner
-- and the WHERE clause below is the whole of the enforcement (§8.3).
-- ===========================================================================
create view public.iscritti_attivita
with (security_invoker = false)
as
  select i.attivita_id, u.nome_pubblico
  from public.iscrizioni i
  join public.utenti u on u.id = i.utente_id
  where i.stato = 'ATTIVA'
    and u.mostra_nome_pubblico
    and u.nome_pubblico is not null
    and (
      public.iscritto_a(i.attivita_id)
      or (
        public.ha_abilitazione()
        and exists (
          select 1
          from public.attivita a
          where a.id = i.attivita_id
            and a.stato = 'PUBBLICATA'
            and a.edizione_id = public.edizione_attiva()
            and a.data >= public.oggi_roma()
        )
      )
    );

comment on view public.iscritti_attivita is
  'SPEC §15.6: the public names of who is signed up, for whoever is abilitated. Only with the consent of §5.5 on, and never an identifier beside the name (rule 8).';

grant select on public.iscritti_attivita to authenticated;

-- ===========================================================================
-- The two windows of §15.8, unchanged but for two columns added at the end.
--
-- Every existing column keeps its name, its type and its position, and
-- neither view gains a level it did not have: ancora_aperta and inizio are
-- derived from `data` and `ora_inizio`, which both views already carried.
-- ===========================================================================

-- Level 1 — §15.8, rule 24. Unchanged down to `posti_rimasti`.
create or replace view public.attivita_elenco
with (security_invoker = false)
as
  select a.id,
         a.edizione_id,
         a.titolo,
         a.descrizione,
         a.abitante_nome,
         a.luogo_generico,
         a.data,
         a.ora_inizio,
         a.ora_fine,
         a.capienza,
         a.cosa_portare,
         a.lingua_attivita,
         (select count(*)::integer
            from public.iscrizioni i
           where i.attivita_id = a.id and i.stato = 'ATTIVA') as iscritti,
         greatest(
           a.capienza - (select count(*)::integer
                           from public.iscrizioni i
                          where i.attivita_id = a.id and i.stato = 'ATTIVA'),
           0
         ) as posti_rimasti,
         -- The one function that decides it, asked here rather than restated
         -- (§15.7): a card with no date or no hour answers false, and a page
         -- draws it without a button.
         public.attivita_non_cominciata(a.id) as ancora_aperta,
         (a.data + a.ora_inizio) at time zone 'Europe/Rome' as inizio
  from public.attivita a
  where a.stato = 'PUBBLICATA'
    and a.edizione_id = public.edizione_attiva()
    and a.data >= public.oggi_roma()
    and public.ha_abilitazione();

comment on view public.attivita_elenco is
  'SPEC §15.8 level 1. Abilitated users, published rows of the active edition. No level 2 column appears here.';

-- Levels 1 + 2 — §15.8, rule 24. Unchanged down to `stato`.
create or replace view public.attivita_iscritto
with (security_invoker = false)
as
  select a.id,
         a.edizione_id,
         a.titolo,
         a.descrizione,
         a.abitante_nome,
         a.abitante_cognome,
         a.abitante_telefono,
         a.luogo_generico,
         a.luogo_esatto,
         a.data,
         a.ora_inizio,
         a.ora_fine,
         a.capienza,
         a.cosa_portare,
         a.lingua_attivita,
         a.stato,
         public.attivita_non_cominciata(a.id) as ancora_aperta,
         (a.data + a.ora_inizio) at time zone 'Europe/Rome' as inizio
  from public.attivita a
  where public.iscritto_a(a.id);

comment on view public.attivita_iscritto is
  'SPEC §15.8 levels 1+2. Only rows the caller holds an ATTIVA iscrizione on. Never abitante_note_interne.';
