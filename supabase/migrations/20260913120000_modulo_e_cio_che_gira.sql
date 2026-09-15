-- «Prenota un abitante» dentro ciò che già gira — SPEC §15.14 passo 20.
--
-- The last step of the module, and the only one that touches parts already in
-- people's hands. Nothing here alters one of the nine existing tables, nor one
-- of the six the module brought (rule 20): what it adds is two views, four
-- nightly cleanups, and two steps inside the erasure that already existed.
--
-- Four things, in the order they are written below:
--
--   1. `iscrizioni_da_verificare` — the iscrizioni a change has left behind,
--      for the panel's "Prenotazioni da controllare" (§6.7, §15.12). Reading
--      them is all it does: nothing in this file cancels anybody's place
--      (rule 6, which forbids the automatic cancellation and not the decision
--      a person takes and signs).
--
--   2. `miei_dati_iscrizioni` — what "Scarica i miei dati" owes the person
--      about their iscrizioni (§7 art. 15, §15.11). Level 1 only: the level 2
--      of §15.8 belongs to the rows they hold a place on right now, and the
--      export is a file that outlives them.
--
--   3. the four cleanups of §15.11, hooked onto the run that already exists.
--
--   4. the erasure of §7 art. 17, extended to iscrizioni (§15.12). It is not
--      a refinement: today an account with an iscrizione attached CANNOT be
--      erased at all — `iscrizioni.utente_id` is ON DELETE RESTRICT, and the
--      final `delete from auth.users` would be refused. The right the law
--      makes immediate is repaired here.
--
-- What the cascades already do, and is therefore not written again: an
-- abilitazione goes with its person (ON DELETE CASCADE), so do the code
-- attempts, and a used card keeps its row while losing the link to who used
-- it (ON DELETE SET NULL) — which is §15.12 word for word, because the
-- progressivo must stay burnt (rule 23).

-- ===========================================================================
-- 1. Le iscrizioni da controllare — §6.7, §15.12.
--
-- The same list as prenotazioni_da_verificare and the same discipline: the
-- amministratore reads, a person decides, nothing cancels itself (§8.2).
-- Two reasons can put a row here, and §15.12 names both:
--
--   CAPIENZA_RIDOTTA    the capacity was lowered under the number of people
--                       already signed up — the seat number is now past it.
--                       A capienza emptied altogether counts as the same
--                       thing taken to zero;
--   ATTIVITA_RITIRATA   the consent tick was cleared on a published activity,
--                       which returns it to BOZZA and makes it disappear.
--                       "Gli iscritti restano e vanno avvisati a mano: il
--                       sistema lo segnala, non decide" (§15.12) — this is
--                       where it signals.
--
-- Only from today on: an activity already past is nobody's problem any more,
-- exactly as for the bookings.
--
-- The email is here for the reason §8.4 gives for the other list — the panel
-- has to be able to write to the person. Nothing else about them comes
-- through: no optional field, no stat_ column, no nome_pubblico (rules 15,
-- 16). LEFT JOIN because an anonymised iscrizione has nobody left to warn.
-- ===========================================================================
create view public.iscrizioni_da_verificare
with (security_invoker = false)
as
  select
    i.id           as iscrizione_id,
    a.id           as attivita_id,
    a.titolo,
    a.data,
    a.ora_inizio,
    u.email,
    case
      when a.stato = 'BOZZA' then 'ATTIVITA_RITIRATA'
      else 'CAPIENZA_RIDOTTA'
    end as motivo
  from public.iscrizioni i
  join public.attivita a on a.id = i.attivita_id
  left join public.utenti u on u.id = i.utente_id
  where public.is_amministratore()
    and i.stato = 'ATTIVA'
    and a.stato <> 'ANNULLATA'
    and a.data >= public.oggi_roma()
    and (
      a.stato = 'BOZZA'
      or a.capienza is null
      or i.posto_progressivo > a.capienza
    );

comment on view public.iscrizioni_da_verificare is
  'SPEC §6.7, §15.12. Iscrizioni left behind by a change, for a human to act on. Nothing here cancels anything.';

grant select on public.iscrizioni_da_verificare to authenticated;

-- ===========================================================================
-- 2. Le iscrizioni in «Scarica i miei dati» — §7 art. 15 e art. 20.
--
-- Shaped on miei_dati_prenotazioni: the caller's own rows, whole history,
-- cancelled ones included, pinned to them by the WHERE clause and not by any
-- filter a page might write (§8.3).
--
-- Deliberately absent:
--   * `posto_progressivo`, internal and never shown to a user (§15.3.3);
--   * the five `stat_` columns, which after the copy are nobody's data (§5.3,
--     rule 16);
--   * every level 2 and level 3 column of §15.8. The cognome, the telefono
--     and the luogo_esatto belong to the abitante, they reach a participant
--     only while they hold an ATTIVA iscrizione (rule 24), and they already
--     reached them in the confirmation email. A file that can be kept and
--     forwarded for years is not where they go.
--
-- Anonymised rows cannot appear: they have no utente_id.
-- ===========================================================================
create view public.miei_dati_iscrizioni
with (security_invoker = false)
as
  select i.id, i.stato, i.creata_il, i.annullata_il,
         a.titolo,
         a.abitante_nome,
         a.luogo_generico,
         a.data,
         a.ora_inizio,
         a.ora_fine
  from public.iscrizioni i
  join public.attivita a on a.id = i.attivita_id
  where i.utente_id = (select auth.uid());

comment on view public.miei_dati_iscrizioni is
  'SPEC §7 art. 15/20, §15.8 level 1. Own iscrizioni for the export. Never posto_progressivo, never stat_, never a level 2 column.';

grant select on public.miei_dati_iscrizioni to authenticated;

-- ===========================================================================
-- 3. Le pulizie del modulo — §15.11.
--
-- Four statements that join the run of ORA_PULIZIE (lib/pulizie.ts). They are
-- in SQL for the reason every retention rule of this project is (§8.3): it
-- must hold whatever code did or did not run, and must never be half applied.
--
-- All four are reachable by the backend job alone: no grant to anon or
-- authenticated, and a guard on current_user as well, so a grant added by
-- mistake one day would still not open them.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 3a. Iscrizioni oltre GIORNI_ANONIMIZZAZIONE dalla data dell'attività.
--
-- The twin of anonimizza_prenotazioni, counted from the date of the activity
-- — the date of the presence, which is what the row is about (§5.3).
--
-- The copy of the five optional values happens here and only here, in the
-- same statement that cuts the link, so there is no instant in which a row is
-- anonymised but not yet snapshotted. Copying all five unconditionally IS the
-- consent check: DATI_FACOLTATIVI is active exactly when at least one of them
-- is filled, and when it is not, five NULLs are copied (§5.5). Rows already
-- anonymised are excluded, so nothing is ever re-copied (rule 19).
--
-- A card whose date was cleared after somebody took a place on it would
-- otherwise keep that link for ever: such a row falls back on the day the
-- iscrizione was made, which is never later than the activity and cannot make
-- the retention shorter than the rule.
-- ---------------------------------------------------------------------------
create function public.anonimizza_iscrizioni(p_giorni integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n integer;
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  update public.iscrizioni i
     set utente_id = null,
         anonimizzata = true,
         stat_eta = u.eta,
         stat_genere = u.genere,
         stat_professione = u.professione,
         stat_motivo_visita = u.motivo_visita,
         stat_residenza = u.residenza
    from public.utenti u,
         public.attivita a
   where u.id = i.utente_id
     and a.id = i.attivita_id
     and not i.anonimizzata
     and coalesce(a.data, (i.creata_il at time zone 'Europe/Rome')::date)
           < public.oggi_roma() - p_giorni;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.anonimizza_iscrizioni(integer) is
  'SPEC §15.11, §5.3. Cuts the link with the person and takes the statistical snapshot, once. Backend job only.';

revoke all on function public.anonimizza_iscrizioni(integer) from public, anon, authenticated;
grant execute on function public.anonimizza_iscrizioni(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3b. Abilitazioni e impronte dei codici di un'edizione chiusa da
--     GIORNI_CHIUSURA_EDIZIONE — §15.11.
--
-- "Chiusa" is the calendar and not the switch: an edition whose data_fine has
-- gone by. The switch can be left on by mistake, the dates cannot go
-- backwards, and edizione_attiva() already reads them the same way.
--
-- The codici rows go entirely, fingerprint included. Nothing is reissued from
-- them afterwards: the numbers of rule 23 are unique within an edition, and
-- that edition is over. What must never happen — a number handed out twice
-- inside the same edition — is not what this touches.
--
-- One number for the two, because §15.11 states them as one line.
-- ---------------------------------------------------------------------------
create function public.cancella_accessi_edizioni_chiuse(p_giorni integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_abilitazioni integer;
  v_codici       integer;
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  delete from public.abilitazioni b
   using public.edizioni e
   where e.id = b.edizione_id
     and e.data_fine < public.oggi_roma() - p_giorni;
  get diagnostics v_abilitazioni = row_count;

  delete from public.codici_invito c
   using public.edizioni e
   where e.id = c.edizione_id
     and e.data_fine < public.oggi_roma() - p_giorni;
  get diagnostics v_codici = row_count;

  return v_abilitazioni + v_codici;
end
$$;

comment on function public.cancella_accessi_edizioni_chiuse(integer) is
  'SPEC §15.11. Abilitazioni and code fingerprints of an edition closed p_giorni days ago. Backend job only.';

revoke all on function public.cancella_accessi_edizioni_chiuse(integer) from public, anon, authenticated;
grant execute on function public.cancella_accessi_edizioni_chiuse(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3c. I dati degli abitanti di un'edizione chiusa — §15.11.
--
-- All three levels of §15.8, and the titolo and the descrizione with them.
-- §15.11 says why the titolo goes too, and it is worth repeating here: the
-- titles carry the names of the abitanti — "Cena da Maria", "Il forno di
-- Giulio" — and keeping them after deleting the cognome would not delete
-- much.
--
-- `cosa_portare` and `lingua_attivita` go as well (agreed 2026-09-13, written
-- into §15.11): they are free text the abitante dictated, they can name a
-- person or a place like any other sentence, and §15.11 lists what remains
-- rather than what goes.
--
-- What remains is `data`, `capienza` and, through the iscrizioni, the number
-- of people who came: enough to say "nel 2026 abbiamo fatto 23 attività, 180
-- partecipazioni". The consent declaration stays as long as the activity
-- does — it is the proof of having done things properly (§15.11).
--
-- No delay: the retention is "fino alla chiusura dell'edizione". The run is
-- idempotent — a row with nothing left in it is not touched again, so the
-- count is the number of cards actually emptied tonight.
-- ---------------------------------------------------------------------------
create function public.cancella_dati_abitanti()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n integer;
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  update public.attivita a
     set titolo = null,
         descrizione = null,
         abitante_nome = null,
         abitante_cognome = null,
         abitante_telefono = null,
         abitante_note_interne = null,
         luogo_generico = null,
         luogo_esatto = null,
         cosa_portare = null,
         lingua_attivita = null
    from public.edizioni e
   where e.id = a.edizione_id
     and e.data_fine < public.oggi_roma()
     and (a.titolo is not null
       or a.descrizione is not null
       or a.abitante_nome is not null
       or a.abitante_cognome is not null
       or a.abitante_telefono is not null
       or a.abitante_note_interne is not null
       or a.luogo_generico is not null
       or a.luogo_esatto is not null
       or a.cosa_portare is not null
       or a.lingua_attivita is not null);

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.cancella_dati_abitanti() is
  'SPEC §15.11. Empties every level of §15.8, titolo and descrizione included, on a closed edition. Leaves data, capienza and the consent declaration. Backend job only.';

revoke all on function public.cancella_dati_abitanti() from public, anon, authenticated;
grant execute on function public.cancella_dati_abitanti() to service_role;

-- ---------------------------------------------------------------------------
-- 3d. I tentativi di inserimento del codice più vecchi di un'ora — §15.11.
--
-- consuma_codice() only counts the attempts of the last hour; it never
-- removes the older ones, so without this sweep the table would keep every
-- attempt ever made. §15.11 gives them one hour, and one hour is what this
-- gives them. Same shape and same reason as cancella_impronte_scadute() for
-- the fingerprints of §6.1.
-- ---------------------------------------------------------------------------
create function public.cancella_tentativi_scaduti()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n integer;
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  delete from public.tentativi_codice t
   where t.tentato_il < now() - interval '1 hour';

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.cancella_tentativi_scaduti() is
  'SPEC §15.11. Drops code attempts older than one hour. Backend job only.';

revoke all on function public.cancella_tentativi_scaduti() from public, anon, authenticated;
grant execute on function public.cancella_tentativi_scaduti() to service_role;

-- ===========================================================================
-- 4. La cancellazione dell'account, estesa alle iscrizioni — §7, §15.12.
--
-- Same signature, so nothing that calls it changes: cancella_mio_account()
-- for the button a person presses, cancella_account_dormienti() for the
-- closing nobody asked for. Replaced rather than dropped for the same reason.
--
-- This is the third replacement of the function — *_pulizie.sql added the
-- snapshot argument, *_persone_per_mese.sql added the count of §6.8 — and
-- every step of those two is carried over here unchanged. A `create or
-- replace` writes the whole body, so anything left out would silently go.
--
-- Two steps are new, and they sit beside the two that already did the same
-- thing for the prenotazioni, because §15.12 asks for the same thing:
-- "Iscrizioni future annullate e posti liberati; iscrizioni passate
-- anonimizzate senza copiare i campi stat_".
--
-- Cancelling frees the seat at once: iscrizioni_posto_unico only counts the
-- ATTIVA rows, so the place is available to the next person in the same
-- instant — which is what makes this worth doing before the anonymisation
-- rather than as part of it.
--
-- `annullata_da` is left NULL on purpose. It exists to record that somebody
-- ELSE acted on the row (§15.9); here the holder is closing their own
-- account, and writing their id into a column that outlives them would be
-- keeping a link the erasure is there to cut.
--
-- Everything else about the order is unchanged and its reasons are in
-- *_diritti.sql and *_pulizie.sql.
-- ===========================================================================
create or replace function public.esegui_cancellazione(
  p_utente_id  uuid,
  p_copia_stat boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Free the seats that can still be freed (§6.4, §8.4).
  update public.prenotazioni p
     set stato = 'ANNULLATA'
   where p.utente_id = p_utente_id
     and p.stato = 'ATTIVA'
     and public.annullabile(p.sede_id, p.data, p.fascia);

  -- 2. The same for the places on the activities that have not begun
  --    (§15.7, §15.12). One that has begun stays as it is: that presence
  --    happened, and it goes on counting.
  update public.iscrizioni i
     set stato = 'ANNULLATA',
         annullata_il = now()
   where i.utente_id = p_utente_id
     and i.stato = 'ATTIVA'
     and public.attivita_non_cominciata(i.attivita_id);

  -- 3. §6.8: the months this account takes away with it, counted while the
  --    link is still there. After step 1, so a cancelled future booking does
  --    not count as a presence.
  perform public.conta_persone_in_uscita(p_utente_id => p_utente_id);

  -- 4. Only for a closing the person did not ask for: the snapshot of §5.3,
  --    taken here because step 5 is about to empty the fields it reads. An
  --    absent or revoked consent leaves all five NULL, so this copies
  --    nothing (§5.5).
  if p_copia_stat then
    update public.prenotazioni p
       set utente_id = null,
           anonimizzata = true,
           stat_eta = u.eta,
           stat_genere = u.genere,
           stat_professione = u.professione,
           stat_motivo_visita = u.motivo_visita,
           stat_residenza = u.residenza
      from public.utenti u
     where u.id = p.utente_id
       and p.utente_id = p_utente_id;

    update public.iscrizioni i
       set utente_id = null,
           anonimizzata = true,
           stat_eta = u.eta,
           stat_genere = u.genere,
           stat_professione = u.professione,
           stat_motivo_visita = u.motivo_visita,
           stat_residenza = u.residenza
      from public.utenti u
     where u.id = i.utente_id
       and i.utente_id = p_utente_id;
  end if;

  -- 5. Revoke what was consented, through the state itself (§5.5).
  update public.utenti u
     set nome_pubblico = null,
         mostra_nome_pubblico = false,
         eta = null,
         genere = null,
         professione = null,
         motivo_visita = null,
         residenza = null
   where u.id = p_utente_id;

  -- 6. Cut every link still standing, copying nothing (§5.3, rule 19).
  --    On an art. 17 erasure this is every booking and every place of the
  --    person; after step 4 there is nothing left to do.
  update public.prenotazioni p
     set utente_id = null,
         anonimizzata = true
   where p.utente_id = p_utente_id;

  update public.iscrizioni i
     set utente_id = null,
         anonimizzata = true
   where i.utente_id = p_utente_id;

  -- 7. The daily name-change counter has no foreign key to follow.
  delete from public.cambi_nome c where c.utente_id = p_utente_id;

  -- 8. When this account ended, for the retention of §7.
  insert into public.account_chiusi (utente_id)
  values (p_utente_id)
  on conflict (utente_id) do nothing;

  -- 9. The account itself. Cascades to utenti, and from there to incarichi,
  --    moderazioni, abilitazioni and tentativi_codice; a used codice_invito
  --    keeps its row and loses the link to who used it (§15.12, rule 23).
  delete from auth.users a where a.id = p_utente_id;
end
$$;

comment on function public.esegui_cancellazione(uuid, boolean) is
  'SPEC §7 art. 17, §8.4, §15.12. The erasure itself, prenotazioni and iscrizioni alike. p_copia_stat only for a closing nobody asked for (§5.3). No grant.';
