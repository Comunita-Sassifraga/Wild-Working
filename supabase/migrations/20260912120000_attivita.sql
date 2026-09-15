-- «Prenota un abitante» — the panel's write paths for an attivita.
-- SPEC §15.14 step 16, §15.3.2, §15.8, §15.9 (first three bullets).
--
-- Step 14 left `attivita` reachable by nobody: no grant, no policy, three
-- views for reading and — said in §15.8 and in rule 24 — writes through
-- functions. This file is those functions and nothing else. No table is
-- created, no column added, no view changed (rule 20): every line below is
-- additive, and the nine tables of §5 are not mentioned once.
--
-- Five verbs, because the panel of §15.9 has five things to do with a card:
--
--   crea_attivita      a new card, empty, in BOZZA
--   aggiorna_attivita  save what has been typed so far
--   pubblica_attivita  tick the consent box and go to PUBBLICATA
--   ritira_attivita    untick it: back to BOZZA (§15.12, "l'abitante cambia idea")
--   annulla_attivita   ANNULLATA, and its iscrizioni with it
--
-- All five refuse a non-amministratore inside the database. The pages check
-- too, but that check is a courtesy: this is the enforcement (§8.3, rule 2).
--
-- Error codes, which lib/db/attivita.ts turns into Italian:
--   AT001  edizione inesistente     (already raised by step 14's trigger)
--   AT002  data fuori edizione      (idem)
--   AT003  attivita inesistente
--   AT004  forma del consenso mancante
--   42501  non autorizzato

-- ===========================================================================
-- crea_attivita — §15.3.2, §15.9 second bullet.
--
-- A card is born in BOZZA with nothing but its edition and, if the panel has
-- one to give, a title. Nothing is required in writing (decision of
-- 2026-09-12): 25 cards are typed in by hand from emails and scattered notes,
-- and whoever enters them must be able to save what they have.
--
-- The edition is not checked to be the current one. The programme is prepared
-- in the weeks before an edition opens, not on its first morning, so the
-- panel works on an edition whose dates may still be ahead (§15.9). What is
-- checked — by step 14's trigger — is that the edition exists.
-- ===========================================================================
create function public.crea_attivita(p_edizione_id uuid, p_titolo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  insert into public.attivita (edizione_id, titolo)
  values (p_edizione_id, nullif(btrim(coalesce(p_titolo, '')), ''))
  returning id into v_id;

  return v_id;
end
$$;

revoke execute on function public.crea_attivita(uuid, text) from public, anon;
grant execute on function public.crea_attivita(uuid, text) to authenticated, service_role;

comment on function public.crea_attivita(uuid, text) is
  'SPEC §15.3.2. A card in BOZZA, with or without a title: nothing is required in writing.';

-- ===========================================================================
-- aggiorna_attivita — §15.3.2, §15.9 second bullet.
--
-- Saves the card. It takes every field of §15.3.2 that a person types and
-- REPLACES all of them: the form always sends the lot, so a field emptied on
-- the screen is emptied in the database. That is how aggiornaSede already
-- behaves, and the alternative — leaving out what arrives null — would make
-- clearing a wrong telephone number impossible from the panel.
--
-- What it does not touch, deliberately:
--
--   stato              publishing, withdrawing and cancelling are their own
--                      verbs below, each with its own meaning to whoever
--                      presses them;
--   consenso_*         the tick is an attestation with a date and a name on
--                      it (§15.8, rule 25). It is never a side effect of
--                      fixing a typo in the title, and cannot be forged from
--                      here because it is not a parameter at all.
--
-- The date is checked against the edition by step 14's trigger, which fires
-- on update of `data` — so a card moved outside its edition is refused here
-- exactly as it is on insert (§15.12). A card with no date yet has nothing
-- to check.
-- ===========================================================================
create function public.aggiorna_attivita(
  p_id                    uuid,
  p_titolo                text default null,
  p_descrizione           text default null,
  p_abitante_nome         text default null,
  p_abitante_cognome      text default null,
  p_abitante_telefono     text default null,
  p_abitante_note_interne text default null,
  p_luogo_generico        text default null,
  p_luogo_esatto          text default null,
  p_data                  date default null,
  p_ora_inizio            time default null,
  p_ora_fine              time default null,
  p_capienza              integer default null,
  p_cosa_portare          text default null,
  p_lingua_attivita       text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  -- An empty box and an absent value are the same thing on this form: both
  -- mean "not yet". Storing '' would also break the length checks of
  -- §15.3.2, which start at 1.
  update public.attivita set
    titolo                = nullif(btrim(coalesce(p_titolo, '')), ''),
    descrizione           = nullif(btrim(coalesce(p_descrizione, '')), ''),
    abitante_nome         = nullif(btrim(coalesce(p_abitante_nome, '')), ''),
    abitante_cognome      = nullif(btrim(coalesce(p_abitante_cognome, '')), ''),
    abitante_telefono     = nullif(btrim(coalesce(p_abitante_telefono, '')), ''),
    abitante_note_interne = nullif(btrim(coalesce(p_abitante_note_interne, '')), ''),
    luogo_generico        = nullif(btrim(coalesce(p_luogo_generico, '')), ''),
    luogo_esatto          = nullif(btrim(coalesce(p_luogo_esatto, '')), ''),
    data                  = p_data,
    ora_inizio            = p_ora_inizio,
    ora_fine              = p_ora_fine,
    capienza              = p_capienza,
    cosa_portare          = nullif(btrim(coalesce(p_cosa_portare, '')), ''),
    lingua_attivita       = nullif(btrim(coalesce(p_lingua_attivita, '')), '')
  where id = p_id;

  if not found then
    raise exception 'attivita inesistente' using errcode = 'AT003';
  end if;
end
$$;

revoke execute on function public.aggiorna_attivita(
  uuid, text, text, text, text, text, text, text, text, date, time, time, integer, text, text
) from public, anon;
grant execute on function public.aggiorna_attivita(
  uuid, text, text, text, text, text, text, text, text, date, time, time, integer, text, text
) to authenticated, service_role;

comment on function public.aggiorna_attivita(
  uuid, text, text, text, text, text, text, text, text, date, time, time, integer, text, text
) is
  'SPEC §15.3.2. Replaces the typed fields of a card. Never stato, never the consent tick (rule 25).';

-- ===========================================================================
-- pubblica_attivita — §15.8, §15.9 third bullet.
--
-- The one act in this module that carries weight outside the software. The
-- tick is not the consent: the consent is the paper the Direttivo holds,
-- signed by hand or received by email from an address of the abitante. The
-- tick is the traced declaration that the paper exists, and `consenso_raccolto_il`
-- and `_da` are written by step 14's trigger from the session — never from a
-- request, not even this one (rule 25).
--
-- The form is mandatory and comes from the closed list of two. A verbal
-- agreement minuted in a meeting is not one of them and never will be: it
-- proves the association said something, not that the abitante consented
-- (§15.8). The enum refuses a third value; this refuses none at all.
--
-- An incomplete card can still be published (§15.3.2). The refusal to do so
-- would be wrong — the database does not know whether a card is finished —
-- so the warning lives on the screen instead: §15.9 has the publish page list
-- the empty fields, and say that without a date the card never appears and
-- without a capienza it takes nobody.
-- ===========================================================================
create function public.pubblica_attivita(
  p_id uuid,
  p_modalita public.modalita_consenso
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  if p_modalita is null then
    raise exception 'forma del consenso mancante' using errcode = 'AT004';
  end if;

  update public.attivita set
    consenso_raccolto = true,
    consenso_modalita = p_modalita,
    stato             = 'PUBBLICATA'
  where id = p_id;

  if not found then
    raise exception 'attivita inesistente' using errcode = 'AT003';
  end if;
end
$$;

revoke execute on function public.pubblica_attivita(uuid, public.modalita_consenso)
  from public, anon;
grant execute on function public.pubblica_attivita(uuid, public.modalita_consenso)
  to authenticated, service_role;

comment on function public.pubblica_attivita(uuid, public.modalita_consenso) is
  'SPEC §15.8. Ticks the consent box, records which of the two forms, and publishes. The date and the author are the system''s.';

-- ===========================================================================
-- ritira_attivita — §15.12, "abitante che ritira il consenso".
--
-- He has no account to revoke from: he says so out loud to somebody of the
-- Direttivo. The admin unticks the box, and that is the whole gesture — the
-- return to BOZZA is step 14's trigger, because whoever unticks is thinking
-- about Maria, not about `stato`.
--
-- The enrolled people stay. Nothing here cancels anybody's place: the panel
-- says they are there and a person decides (§15.12, rule 6).
-- ===========================================================================
create function public.ritira_attivita(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  update public.attivita set consenso_raccolto = false where id = p_id;

  if not found then
    raise exception 'attivita inesistente' using errcode = 'AT003';
  end if;
end
$$;

revoke execute on function public.ritira_attivita(uuid) from public, anon;
grant execute on function public.ritira_attivita(uuid) to authenticated, service_role;

comment on function public.ritira_attivita(uuid) is
  'SPEC §15.12. Unticks the consent: the card returns to BOZZA and leaves the elenco. Its iscritti stay.';

-- ===========================================================================
-- annulla_attivita — §15.12, "attività annullata con iscritti".
--
-- The card goes to ANNULLATA and its active iscrizioni go with it. This is
-- the one place where cancelling somebody else's row happens outside the two
-- admin actions of step 18, and it is inside rule 6 for the same reason they
-- are: rule 6 forbids an AUTOMATIC cancellation, not one a person decides and
-- signs. `annullata_da` says for ever who signed it.
--
-- §15.12 also asks that everyone enrolled receive an email. The emails of
-- §15.10 are step 19; until then the panel says how many people are on the
-- card and that they must be told by hand. Cancelling the iscrizioni here
-- rather than later is not a choice: an ATTIVA iscrizione on an ANNULLATA
-- activity would be a seat on an event that is not happening, and the holder
-- would still hold level 2 on it.
-- ===========================================================================
create function public.annulla_attivita(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iscritti integer;
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  update public.attivita set stato = 'ANNULLATA' where id = p_id;

  if not found then
    raise exception 'attivita inesistente' using errcode = 'AT003';
  end if;

  with annullate as (
    update public.iscrizioni
       set stato = 'ANNULLATA',
           annullata_da = (select auth.uid())
     where attivita_id = p_id
       and stato = 'ATTIVA'
    returning 1
  )
  select count(*)::integer into v_iscritti from annullate;

  -- How many people have just lost a place, so the panel can say it and the
  -- email of step 19 can be sent to them.
  return v_iscritti;
end
$$;

revoke execute on function public.annulla_attivita(uuid) from public, anon;
grant execute on function public.annulla_attivita(uuid) to authenticated, service_role;

comment on function public.annulla_attivita(uuid) is
  'SPEC §15.12. ANNULLATA, and its ATTIVA iscrizioni with it, traced in annullata_da. Returns how many people to warn.';
