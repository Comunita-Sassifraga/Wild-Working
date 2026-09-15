-- «Prenota un abitante» — editions, invite codes, abilitazioni.
-- SPEC §15.14 step 15. References: §15.3.1, §15.3.4, §15.3.5, §15.3.6, §15.4.
--
-- Step 14 created the six tables and closed them. This file adds the write
-- paths, and nothing else: no activity, no iscrizione, no email. Not one
-- existing table is altered (rule 20) and not one of step 14's is either —
-- what changes is who may write to them and through what.
--
-- Two tables stay unreachable, exactly as step 14 left them: codici_invito
-- and tentativi_codice have no grant and no policy, and every line below
-- that touches them is SECURITY DEFINER with is_amministratore() or
-- auth.uid() checked inside. That is deliberate. A grant on codici_invito
-- would let a signed-in person enumerate the fingerprints of the cards not
-- yet handed out.
--
-- THE CODE IN CLEAR NEVER REACHES THIS FILE. It is made in the application,
-- fingerprinted there with CHIAVE_IMPRONTE_ACCESSO (rule 23, the same key
-- and the same technique as the request limit of §6.1), and only the
-- fingerprint crosses the wire. Nothing here can turn one back into a code.

-- ===========================================================================
-- edizioni — the panel of §15.9 first bullet
--
-- A plain table with admin policies, like sedi: the "one active at a time"
-- trigger of step 14 is what makes the switch safe, so the panel needs no
-- function of its own. Reading is already open to every signed-in person
-- (the entry of §15.5 asks whether the module is open); this adds writing.
-- ===========================================================================
grant insert, update, delete on public.edizioni to authenticated;

create policy edizioni_inserimento_admin on public.edizioni
  for insert to authenticated
  with check (public.is_amministratore());

create policy edizioni_modifica_admin on public.edizioni
  for update to authenticated
  using (public.is_amministratore())
  with check (public.is_amministratore());

-- An edition with abilitazioni or attivita attached is held back by the
-- ON DELETE RESTRICT of step 14: the panel gets a refusal, never a silent
-- cascade through somebody's access rights.
create policy edizioni_cancellazione_admin on public.edizioni
  for delete to authenticated
  using (public.is_amministratore());

-- ===========================================================================
-- The two admin lists — §15.9, fourth and fifth bullets.
--
-- Views rather than grants, for the same reason as attivita (rule 24): the
-- underlying tables must stay shut, and a view can show a subset of the
-- columns to a subset of the people.
-- ===========================================================================

-- The cards of an edition, as the panel lists them: "Cartoncino 12 — non
-- ancora usato", "Cartoncino 13 — usato il 21/09" (§15.3.5).
--
-- `impronta` is deliberately absent. It is irreversible and would tell a
-- reader nothing, but it is the one column whose whole purpose is to be
-- compared against a secret, and it has no business on a screen.
create view public.codici_amministrazione
with (security_invoker = false)
as
  select c.id,
         c.edizione_id,
         c.progressivo,
         c.creato_il,
         c.usato_il,
         c.utente_id,
         c.revocato
  from public.codici_invito c
  where public.is_amministratore();

comment on view public.codici_amministrazione is
  'SPEC §15.3.5, §15.9. The cards of an edition without their fingerprints: a code never comes back out of the database.';

grant select on public.codici_amministrazione to authenticated;

-- Who is enabled, and by what name the panel can recognise them.
--
-- The email is here because it is the only handle this application has on a
-- person: to revoke Mario's access somebody has to be able to tell which row
-- is Mario. Same choice as the incarichi list (§6.7) and the iscritti list
-- (§15.9), and agreed into §15.9 on 2026-09-12. It is not a directory of
-- everyone registered — only of the people already enabled — and it carries
-- no optional field: rule 15 and rule 16 are untouched.
create view public.abilitazioni_amministrazione
with (security_invoker = false)
as
  select a.id,
         a.utente_id,
         a.edizione_id,
         u.email,
         a.attivata_il,
         a.origine,
         a.attiva,
         a.revocata_il
  from public.abilitazioni a
  join public.utenti u on u.id = a.utente_id
  where public.is_amministratore();

comment on view public.abilitazioni_amministrazione is
  'SPEC §15.9. Enabled people with the address to recognise them by. Admin only, no optional field.';

grant select on public.abilitazioni_amministrazione to authenticated;

-- ===========================================================================
-- genera_codici — §15.3.5, §15.9 fourth bullet.
--
-- Takes fingerprints, gives back numbers. The application made the codes and
-- knows which fingerprint belongs to which one; it pairs them up again by
-- the fingerprint this function returns beside each progressivo.
--
-- The numbers continue from the highest ever issued in the edition, revoked
-- ones included: `max(progressivo) + 1`, never `count(*) + 1`. A reissued
-- number would make the paper list of whoever hands out the keys lie
-- (§15.3.5), and that list is the only thing pairing a number to a person.
--
-- Two admins generating at the same second would compute the same starting
-- number; the unique index of step 14 refuses the second one, and the panel
-- shows a refusal rather than two cards numbered 12. With one Direttivo and
-- one printing session this is a guard, not a workflow.
-- ===========================================================================
create function public.genera_codici(p_edizione_id uuid, p_impronte text[])
returns table (progressivo integer, impronta text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_da integer;
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  if p_impronte is null or array_length(p_impronte, 1) is null then
    raise exception 'nessun codice da generare' using errcode = 'CD001';
  end if;

  if not exists (select 1 from public.edizioni e where e.id = p_edizione_id) then
    raise exception 'edizione inesistente' using errcode = 'CD002';
  end if;

  select coalesce(max(c.progressivo), 0)
    into v_da
    from public.codici_invito c
   where c.edizione_id = p_edizione_id;

  return query
  insert into public.codici_invito (edizione_id, progressivo, impronta)
  select p_edizione_id, v_da + i.n, p_impronte[i.n]
    from generate_subscripts(p_impronte, 1) as i(n)
  returning public.codici_invito.progressivo, public.codici_invito.impronta;
end
$$;

revoke execute on function public.genera_codici(uuid, text[]) from public, anon;
grant execute on function public.genera_codici(uuid, text[]) to authenticated, service_role;

comment on function public.genera_codici(uuid, text[]) is
  'SPEC §15.3.5. Numbers continue from the highest ever issued, revoked ones included: a progressivo is never reused.';

-- ===========================================================================
-- revoca_codice — §15.4, first way out of three.
--
-- Only a card that has not been used. One already consumed gives nobody
-- access any more — access lives in the abilitazione, not in the card — and
-- revoking it would look like it had shut somebody out when it had not.
-- Shutting out a person who is already in is revoca_abilitazione, below.
-- Agreed into §15.4 on 2026-09-12.
-- ===========================================================================
create function public.revoca_codice(p_codice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usato timestamptz;
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  select c.usato_il into v_usato
    from public.codici_invito c
   where c.id = p_codice_id;

  if not found then
    raise exception 'cartoncino inesistente' using errcode = 'CD003';
  end if;

  if v_usato is not null then
    raise exception 'cartoncino gia usato' using errcode = 'CD004';
  end if;

  update public.codici_invito set revocato = true where id = p_codice_id;
end
$$;

revoke execute on function public.revoca_codice(uuid) from public, anon;
grant execute on function public.revoca_codice(uuid) to authenticated, service_role;

comment on function public.revoca_codice(uuid) is
  'SPEC §15.4. Unused cards only: a consumed one no longer grants anything, and the abilitazione is what to revoke.';

-- ===========================================================================
-- abilita_utente — §15.4, third way out.
--
-- The manual enabling of somebody already registered. There is no "enable
-- this email address" for a person who has never signed in, and there is not
-- going to be one: their utenti row does not exist yet, and holding
-- addresses of people who are not users would be a second place to protect,
-- to erase and to declare (§15.4).
--
-- ON CONFLICT, not INSERT: one abilitazione per person per edition
-- (§15.3.4). Somebody revoked gets their row switched back on, never a
-- second one — two rows would be two answers to "may this person come in?".
-- `origine` follows what turned it on this time, which is what the panel is
-- being asked to record.
-- ===========================================================================
create function public.abilita_utente(p_utente_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edizione uuid := public.edizione_attiva();
  v_id       uuid;
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  if v_edizione is null then
    raise exception 'nessuna edizione attiva' using errcode = 'CD005';
  end if;

  if not exists (select 1 from public.utenti u where u.id = p_utente_id) then
    raise exception 'utente inesistente' using errcode = 'CD006';
  end if;

  insert into public.abilitazioni (utente_id, edizione_id, origine)
  values (p_utente_id, v_edizione, 'MANUALE')
  on conflict (utente_id, edizione_id) do update
    set attiva      = true,
        origine     = 'MANUALE',
        attivata_il = now(),
        revocata_il = null,
        revocata_da = null
  returning id into v_id;

  return v_id;
end
$$;

revoke execute on function public.abilita_utente(uuid) from public, anon;
grant execute on function public.abilita_utente(uuid) to authenticated, service_role;

comment on function public.abilita_utente(uuid) is
  'SPEC §15.4. Re-enabling switches the existing row back on: never a second abilitazione for the same person and edition (§15.3.4).';

-- ===========================================================================
-- revoca_abilitazione — §15.4, the punctual revocation.
--
-- Switches one abilitazione off without touching any other. It does NOT
-- cancel the iscrizioni already made: those stay, and stop being changeable
-- by the person concerned. If they have to go, an amministratore cancels
-- them and says so (§15.4, §15.12) — which is step 18, not this one.
-- ===========================================================================
create function public.revoca_abilitazione(p_abilitazione_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  update public.abilitazioni
     set attiva      = false,
         revocata_il = now(),
         revocata_da = (select auth.uid())
   where id = p_abilitazione_id
     and attiva;

  if not found then
    raise exception 'abilitazione inesistente o gia revocata' using errcode = 'CD007';
  end if;
end
$$;

revoke execute on function public.revoca_abilitazione(uuid) from public, anon;
grant execute on function public.revoca_abilitazione(uuid) to authenticated, service_role;

comment on function public.revoca_abilitazione(uuid) is
  'SPEC §15.4. Switches one abilitazione off. Never cancels an iscrizione: that is a person''s decision, taken in the panel (§15.9).';

-- ===========================================================================
-- consuma_codice — §15.4. The one path from a card to an abilitazione.
--
-- Returns a word, not an error, for every outcome a person can cause: the
-- page of §15.6 turns it into one of the sentences of messages/it.json, and
-- an exception would make three of these look like a failure of the app.
--
--   ABILITATO         the code was good; the card is burnt and the
--                     abilitazione exists
--   GIA_ABILITATO     the caller can already come in — either they hold an
--                     active abilitazione, or this is their own card used a
--                     second time (§15.4: the one case that is allowed to
--                     say something different)
--   RIFIUTATO         everything else, in one word on purpose: unknown,
--                     already used by somebody else, revoked, or belonging
--                     to another edition. §15.4 asks for one message and
--                     that starts here — a page cannot tell apart what the
--                     database never told it
--   TROPPI_TENTATIVI  over MAX_TENTATIVI_CODICE_ORA in the last hour
--   MODULO_CHIUSO     no active edition
--
-- The limit is counted in tentativi_codice keyed by utente_id, never by a
-- fingerprint (rule 23): the caller has already signed in, so their id is
-- already in the database and hashing it would protect nothing. Same shape
-- as consenti_richiesta_link(): the rows of the last hour are counted, and
-- the refusal does not add one — MAX attempts are recorded and the next is
-- turned away.
--
-- The order of the checks matters. "Already enabled" comes before the code
-- is looked at, so that somebody who types a card that is not theirs while
-- already holding access does not burn it.
-- ===========================================================================
create function public.consuma_codice(p_impronta text, p_max_tentativi integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente    uuid := (select auth.uid());
  v_edizione  uuid := public.edizione_attiva();
  v_tentativi integer;
  v_codice    public.codici_invito%rowtype;
  v_preso     uuid;
begin
  if v_utente is null then
    raise exception 'accesso richiesto' using errcode = '28000';
  end if;

  if v_edizione is null then
    return 'MODULO_CHIUSO';
  end if;

  if public.ha_abilitazione() then
    return 'GIA_ABILITATO';
  end if;

  select count(*)
    into v_tentativi
    from public.tentativi_codice t
   where t.utente_id = v_utente
     and t.tentato_il > now() - interval '1 hour';

  if v_tentativi >= p_max_tentativi then
    return 'TROPPI_TENTATIVI';
  end if;

  insert into public.tentativi_codice (utente_id) values (v_utente);

  select * into v_codice
    from public.codici_invito c
   where c.impronta = p_impronta
     and c.edizione_id = v_edizione;

  if not found or v_codice.revocato then
    return 'RIFIUTATO';
  end if;

  -- A card already used, whoever used it. The exception §15.4 grants — "già
  -- usato dallo stesso utente, dove si dice semplicemente che è già
  -- abilitato" — has already been served above, by ha_abilitazione(): that
  -- is exactly the person it describes.
  --
  -- Reaching here with one's own card therefore means one thing only: the
  -- abilitazione was revoked (§15.4). It must not come back by retyping the
  -- card, and the standard refusal is also the right thing to read — it
  -- says who to write to, which is precisely what that person has to do.
  -- The spec did not foresee this combination; §15.4 now says so.
  if v_codice.usato_il is not null then
    return 'RIFIUTATO';
  end if;

  -- Consumed in the same statement that finds it free: two people typing
  -- the same code at once, one wins, and the other is told exactly what a
  -- stranger is told.
  update public.codici_invito
     set usato_il = now(), utente_id = v_utente
   where id = v_codice.id
     and usato_il is null
  returning id into v_preso;

  if v_preso is null then
    return 'RIFIUTATO';
  end if;

  insert into public.abilitazioni (utente_id, edizione_id, origine)
  values (v_utente, v_edizione, 'CODICE')
  on conflict (utente_id, edizione_id) do update
    set attiva      = true,
        origine     = 'CODICE',
        attivata_il = now(),
        revocata_il = null,
        revocata_da = null;

  return 'ABILITATO';
end
$$;

revoke execute on function public.consuma_codice(text, integer) from public, anon;
grant execute on function public.consuma_codice(text, integer) to authenticated, service_role;

comment on function public.consuma_codice(text, integer) is
  'SPEC §15.4. One word per outcome, and one single word for unknown, used and revoked.';
