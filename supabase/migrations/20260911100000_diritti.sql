-- Diritti dell'interessato — SPEC §7, §8.4, §12 step 10.
--
-- Two rights are exercised by the person alone, with nobody in the middle:
--
--   * access and portability (art. 15, art. 20) — read here through
--     `miei_dati_prenotazioni`, the one view that shows somebody their own
--     bookings beyond the booking window;
--   * erasure (art. 17) — `cancella_mio_account()`, one statement that either
--     removes everything or removes nothing.
--
-- The whole erasure lives in the database and not in a Server Action, for the
-- same reason as every other rule of this project (§8.3): it must hold on
-- whatever path the request arrives, and it must not be possible to run half
-- of it. It is also the only way to keep the RLS-bypassing backend client out
-- of a request served on a person's behalf (CLAUDE.md conventions).
--
-- Error codes, matched by lib/db/diritti.ts:
--   CN001  nessun account da cancellare

-- ---------------------------------------------------------------------------
-- What "Scarica i miei dati" reads about the bookings — SPEC §7.
--
-- `mie_prenotazioni` cannot serve here: it stops at the end of the booking
-- window and at today, because it is the page that cancels them (§6.4). The
-- export must carry every booking still linked to the person, cancelled ones
-- and the last thirty days included — that is precisely the set art. 15 is
-- about.
--
-- What it deliberately leaves out:
--   * `posto_progressivo` — internal, never shown to a user (§8.1);
--   * the five `stat_` columns — after the copy they are no longer that
--     person's data, and an anonymised booking has no owner to hand them to
--     anyway (§5.3, rule 16).
--
-- Anonymised rows cannot appear: they have no utente_id, so the WHERE clause
-- excludes them by construction.
-- ---------------------------------------------------------------------------
create view public.miei_dati_prenotazioni
with (security_invoker = false)
as
  select p.id, p.data, p.fascia, p.gruppo_id, p.stato, p.creata_il,
         s.nome as sede_nome,
         s.comune,
         s.indirizzo,
         public.ora_inizio(s.id, p.fascia) as ora_inizio,
         case p.fascia
           when 'MATTINA' then s.ora_fine_mattina
           else s.ora_fine_pomeriggio
         end as ora_fine
  from public.prenotazioni p
  join public.sedi s on s.id = p.sede_id
  where p.utente_id = (select auth.uid());

comment on view public.miei_dati_prenotazioni is
  'SPEC §7 art. 15/20. Own bookings, whole history, for the export. Never posto_progressivo, never stat_*.';

grant select on public.miei_dati_prenotazioni to authenticated;

-- ---------------------------------------------------------------------------
-- esegui_cancellazione — the erasure itself, in the order it has to happen.
--
-- No grant of any kind: it is reachable only from the entry point below,
-- which decides who is allowed to ask. Splitting the two keeps the question
-- "may you?" apart from the question "what happens?", so a second entry point
-- — the panel's screen of §6.7, at a later step — adds no second copy of this
-- logic.
--
-- Step by step, and why in this order:
--
--   1. Bookings that can still be cancelled (§6.4: the fascia has not begun)
--      are cancelled, so the seats are free again at once (§8.4). One whose
--      fascia has already begun is left as it is: that presence happened, and
--      it goes on counting in the occupancy statistics.
--
--   2. The five optional fields are emptied and the public name switched off
--      *before* the row goes. The consent trigger then writes the revocation
--      rows by itself, the way it does for every other change of state
--      (§5.5, decision of 2026-09-11): the register follows the real state of
--      the processing, and with the account the processing ends.
--
--   3. Every booking of the person is anonymised — the link is cut — and the
--      five `stat_` columns are left EMPTY. This is the one moment where the
--      copy of §5.3 must not happen (rule 19): "una richiesta esplicita di
--      cancellazione va onorata per intero, non aggirata con una copia".
--      Bookings anonymised earlier by the nightly job keep the stat_ values
--      they were given: nothing links them to anyone any more, and the system
--      could not find them if it wanted to.
--
--   4. cambi_nome is emptied by hand: it has no foreign key on purpose (it is
--      a two-day counter) so nothing would remove it.
--
--   5. The Auth user is deleted. The cascade takes public.utenti with it, and
--      utenti takes incarichi and moderazioni (§5.9: "cancellato l'account,
--      sparisce con lui"). Deleting only the profile would not be an erasure:
--      a fresh sign-in link would build an empty one back, and the account
--      would still exist.
--
-- The consensi rows stay: they carry an id that no longer resolves to anyone
-- and are removed 24 months later by the retention job (§7, step 11).
-- ---------------------------------------------------------------------------
create function public.esegui_cancellazione(p_utente_id uuid)
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

  -- 2. Revoke what was consented, through the state itself (§5.5).
  update public.utenti u
     set nome_pubblico = null,
         mostra_nome_pubblico = false,
         eta = null,
         genere = null,
         professione = null,
         motivo_visita = null,
         residenza = null
   where u.id = p_utente_id;

  -- 3. Cut every link, copying nothing into stat_ (§5.3, rule 19).
  update public.prenotazioni p
     set utente_id = null,
         anonimizzata = true
   where p.utente_id = p_utente_id;

  -- 4. The daily name-change counter has no foreign key to follow.
  delete from public.cambi_nome c where c.utente_id = p_utente_id;

  -- 5. The account itself. Cascades to utenti, and from there to incarichi
  --    and moderazioni.
  delete from auth.users a where a.id = p_utente_id;
end
$$;

revoke all on function public.esegui_cancellazione(uuid) from public, anon, authenticated;

comment on function public.esegui_cancellazione(uuid) is
  'SPEC §7 art. 17, §8.4. The erasure itself. No grant: reached only through cancella_mio_account().';

-- ---------------------------------------------------------------------------
-- cancella_mio_account — the door the person walks through (§7).
--
-- "esecuzione immediata, non richiesta a un umano": no queue, no approval,
-- no email to anybody. It takes no argument at all, so there is no id to get
-- wrong and no way to aim it at somebody else — the caller is the subject,
-- and that is the whole authorisation check.
--
-- The confirmation of §7 is a page, not a parameter: a second press on a
-- screen that spells out the consequences (app/impostazioni/cancella).
-- ---------------------------------------------------------------------------
create function public.cancella_mio_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
begin
  if v_utente is null then
    raise exception 'accesso richiesto' using errcode = '28000';
  end if;

  if not exists (select 1 from public.utenti u where u.id = v_utente) then
    raise exception 'nessun account da cancellare' using errcode = 'CN001';
  end if;

  perform public.esegui_cancellazione(v_utente);
end
$$;

revoke all on function public.cancella_mio_account() from public, anon;
grant execute on function public.cancella_mio_account() to authenticated;

comment on function public.cancella_mio_account() is
  'SPEC §7 art. 17. Immediate erasure of the caller''s own account. Takes no argument: the caller is the subject.';
