-- «Prenota un abitante» — signing somebody up, and cancelling for them.
-- SPEC §15.14 step 18, §15.9 («L'elenco degli iscritti» and «Iscrivere e
-- annullare per conto di qualcuno»), §15.7, §15.12, D22.
--
-- These are the two powers the amministratore has over `iscrizioni` and does
-- NOT have over `prenotazioni`. The difference is not an oversight: without a
-- waiting list, the swap between somebody who gives a place up and somebody
-- who takes it can only be closed by a person (D22, §15.7).
--
-- They stay inside rule 6, which forbids an AUTOMATIC cancellation, not one
-- somebody decides and signs. The three conditions of §15.9 are met here:
--
--   only iscrizioni — nothing in this file can reach a `prenotazione`, by
--   any argument it is given;
--   traced — `creata_da` and `annullata_da` say for ever who acted;
--   the person is told — the email is sent by lib/posta/abitanti.ts, which
--   these two functions hand the utente_id to.
--
-- Additive, like every file of this module (rule 20): no existing table is
-- altered. `iscriviti()` is rewritten around a shared seat-taker so that the
-- two write paths cannot drift apart, and keeps every one of its error codes.

-- ===========================================================================
-- abilitato — the question ha_abilitazione() already asked, about somebody
-- who is not the caller.
--
-- Needed because the amministratore signs up a person who is not themselves:
-- the abilitazione to check is the other person's. ha_abilitazione() becomes
-- the same question about auth.uid(), so there is one answer and not two
-- that could one day disagree (rule 22).
-- ===========================================================================
create function public.abilitato(p_utente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.abilitazioni a
    where a.utente_id = p_utente_id
      and a.edizione_id = public.edizione_attiva()
      and a.attiva
  )
$$;

comment on function public.abilitato(uuid) is
  'SPEC §15.3.4: does this person hold an active abilitazione for the active edition? False outside an edition, whatever rows exist.';

create or replace function public.ha_abilitazione()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.abilitato((select auth.uid()))
$$;

-- ===========================================================================
-- assegna_posto — the seat-taker, shared by the two write paths.
--
-- Lifted unchanged out of iscriviti(): it tries seat numbers 1..capienza and
-- lets iscrizioni_posto_unico decide who wins a race, so N simultaneous
-- sign-ups on capacity M produce exactly min(N, M) and nothing else — there
-- is no waiting list for the rest to fall into (rule 29, rule 5).
--
-- `p_agente` is who is acting: the person themselves, or the amministratore
-- signing them up. It is what lands in `creata_da` (§15.3.3).
--
-- Internal: no grant, called only by the two functions below. Whether the
-- caller is allowed to do this at all is decided there, before we get here.
--
-- Error codes, unchanged from the ones iscriviti() has raised since step 14:
--   IS001  posti esauriti           — every seat number is taken
--   IS002  iscrizione duplicata     — that person already holds an active one
--   IS003  attivita non disponibile — unknown, not published, not in the
--                                     active edition, or published with no
--                                     capienza typed in yet (§15.3.2)
--   IS005  attivita cominciata      — its start time has passed (§15.7)
-- ===========================================================================
create function public.assegna_posto(
  p_attivita_id uuid,
  p_utente_id   uuid,
  p_agente      uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capienza   integer;
  v_id         uuid;
  v_n          integer;
  v_constraint text;
begin
  select a.capienza into v_capienza
  from public.attivita a
  where a.id = p_attivita_id
    and a.stato = 'PUBBLICATA'
    and a.edizione_id = public.edizione_attiva();

  -- Two different silences, one answer: no such published activity, and one
  -- whose capienza has not been typed in. Neither tells the caller which.
  if not found or v_capienza is null then
    raise exception 'attivita non disponibile' using errcode = 'IS003';
  end if;

  if not public.attivita_non_cominciata(p_attivita_id) then
    raise exception 'attivita cominciata' using errcode = 'IS005';
  end if;

  for v_n in 1..v_capienza loop
    begin
      insert into public.iscrizioni (attivita_id, utente_id, posto_progressivo, creata_da)
      values (p_attivita_id, p_utente_id, v_n, p_agente)
      returning id into v_id;
      return v_id;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'iscrizioni_una_per_attivita' then
          raise exception 'iscrizione duplicata' using errcode = 'IS002';
        end if;
        -- Seat v_n was taken by a concurrent sign-up: try the next one.
    end;
  end loop;

  raise exception 'posti esauriti' using errcode = 'IS001';
end
$$;

revoke execute on function public.assegna_posto(uuid, uuid, uuid)
  from public, anon, authenticated;

comment on function public.assegna_posto(uuid, uuid, uuid) is
  'SPEC §15.3.3, §8.1. Internal. Capacity decided by iscrizioni_posto_unico, never by a read-then-write check (rule 5).';

-- ---------------------------------------------------------------------------
-- iscriviti — unchanged in what it does and in what it refuses (§15.7).
--
-- Every error code it raised before it raises now, from the same conditions
-- and in the same order: the caller must be signed in (28000), must hold an
-- abilitazione (IS004), and then the seat-taker answers for the rest.
-- ---------------------------------------------------------------------------
create or replace function public.iscriviti(p_attivita_id uuid)
returns uuid
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

  if not public.ha_abilitazione() then
    raise exception 'accesso non abilitato' using errcode = 'IS004';
  end if;

  -- Acting for themselves: creata_da is the person (§15.3.3).
  return public.assegna_posto(p_attivita_id, v_utente, v_utente);
end
$$;

-- ===========================================================================
-- iscrivi_per_conto — §15.9, the second half of the swap.
--
-- The amministratore takes a place for somebody else. Three refusals before
-- the seat-taker is reached, and one of them is the whole point of §15.12:
--
--   not an amministratore                → 42501, like every other write here;
--   the person has no active abilitazione → IS004. Agreed 2026-09-13 and
--     written into §15.9: signing somebody up who cannot read the activity
--     would put them in a room whose address they are not allowed to see,
--     and send them an email about an event they cannot find. Enabling them
--     comes first — it is one field away, in the same panel.
--   the activity is full                  → IS001, from the same unique index
--     that refuses everybody else (§15.12). The amministratore does not get a
--     place that is not there: first the one who gives up is cancelled, then
--     the one who takes over is signed up.
--
-- It returns the id of the iscrizione. The email of §15.10 is sent by the
-- caller, which already knows the person it asked for.
-- ===========================================================================
create function public.iscrivi_per_conto(p_attivita_id uuid, p_utente_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  if not public.abilitato(p_utente_id) then
    raise exception 'accesso non abilitato' using errcode = 'IS004';
  end if;

  -- The agent is the amministratore, the place is the other person's.
  return public.assegna_posto(p_attivita_id, p_utente_id, (select auth.uid()));
end
$$;

revoke execute on function public.iscrivi_per_conto(uuid, uuid) from public, anon;
grant execute on function public.iscrivi_per_conto(uuid, uuid) to authenticated, service_role;

comment on function public.iscrivi_per_conto(uuid, uuid) is
  'SPEC §15.9. Only iscrizioni, never a prenotazione. Traced in creata_da; the caller sends the email of §15.10.';

-- ===========================================================================
-- annulla_per_conto — §15.9, the first half of the swap.
--
-- Cancelling somebody else's iscrizione. The policy of step 14 already lets
-- an amministratore do it; this exists so that the act and the id of the
-- person to write to come back in one statement, and so the refusals have
-- names a page can put into Italian.
--
-- Deliberately NOT bounded by the start of the activity, unlike the holder's
-- own cancellation (§15.7): the amministratore is exactly who closes the
-- cases a person can no longer close alone — a revoked abilitazione, a card
-- whose date was cleared (§15.12).
--
-- Returns the utente_id so the caller can send the email of §15.10. That id
-- is not a name and not an address: the address is read afterwards, by the
-- backend client, and never reaches whoever pressed the button (rule 4).
--
--   IS006  iscrizione inesistente o gia annullata
-- ===========================================================================
create function public.annulla_per_conto(p_iscrizione_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid;
begin
  if not public.is_amministratore() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  update public.iscrizioni
     set stato        = 'ANNULLATA',
         annullata_da = (select auth.uid())
   where id = p_iscrizione_id
     and stato = 'ATTIVA'
  returning utente_id into v_utente;

  if not found then
    raise exception 'iscrizione inesistente o gia annullata' using errcode = 'IS006';
  end if;

  return v_utente;
end
$$;

revoke execute on function public.annulla_per_conto(uuid) from public, anon;
grant execute on function public.annulla_per_conto(uuid) to authenticated, service_role;

comment on function public.annulla_per_conto(uuid) is
  'SPEC §15.9. Only iscrizioni, never a prenotazione. Traced in annullata_da; returns who to write to.';

-- ===========================================================================
-- iscritti_amministrazione — §15.9 «L'elenco degli iscritti».
--
-- An apparent exception to §4, and §15.9 states it outright: Maria needs to
-- know how many people are coming to her house, and the amministratore needs
-- to be able to write to them if something changes. The email address is the
-- only handle this application has on a person — the same choice as the
-- incarichi list (§6.7) and the abilitazioni list (§15.9).
--
-- Two bounds, both in the database and not in a page (§8.3):
--
--   amministratore only. Nobody else, ever.
--   until the day AFTER the activity. Past that the row leaves this view and
--   the iscrizione goes back under the ordinary 30-day rule of §15.11. A card
--   with no date yet has nothing to expire and stays.
--
-- `nome_pubblico` comes out only for whoever switched it on (rule 3): the
-- consent of §5.5 is imposed here, in the view, not by whichever screen or
-- export happens to read it next. Everyone else is a count, as on the public
-- page — and what the amministratore hands the proponente is that sentence,
-- never this list (§15.9).
--
-- No optional field of §5.1 appears, and none ever will (rules 15 and 16).
-- ===========================================================================
create view public.iscritti_amministrazione
with (security_invoker = false)
as
  select i.id,
         i.attivita_id,
         i.utente_id,
         u.email,
         case when u.mostra_nome_pubblico then u.nome_pubblico end as nome_pubblico,
         i.stato,
         i.creata_il,
         i.creata_da,
         i.annullata_il,
         i.annullata_da
  from public.iscrizioni i
  join public.utenti u on u.id = i.utente_id
  join public.attivita a on a.id = i.attivita_id
  where public.is_amministratore()
    and (a.data is null or a.data >= public.oggi_roma() - 1);

comment on view public.iscritti_amministrazione is
  'SPEC §15.9. Who is coming, with the address to write to. Amministratore only, until the day after the activity.';

grant select on public.iscritti_amministrazione to authenticated;
