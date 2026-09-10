-- Pulizie automatiche notturne — SPEC §7, §5.3, §6.1, §12 step 11.
--
-- The retention table of §7 turned into six statements that run once a
-- night. They live in SQL for the reason every other rule of this project
-- does (§8.3): retention must hold whatever code did or did not run, and
-- must never be half applied. Each one is a single statement that either
-- happens or does not.
--
-- All six are reachable only by the backend job (`service_role`): none of
-- them is granted to anon or authenticated, and the two that hand back
-- something a person could care about — the addresses to warn, the accounts
-- to close — refuse to run under any other role.
--
-- What is deliberately NOT here, because §7 already handles it elsewhere:
--   * sign-in links expire after VALIDITA_LINK_MINUTI — Supabase Auth's own
--     otp_expiry does it, see supabase/config.toml;
--   * the moderation register goes with the account — the cascade from
--     auth.users does it (§5.9);
--   * technical logs are the hosting provider's, not ours.

-- ---------------------------------------------------------------------------
-- 1. The memory of the dormancy warning.
--
-- Same shape as avviso_moderazione (§6.5): NULL means "not warned yet", an
-- instant means "warned then". The column is not in the update grant of
-- *_politiche_accesso.sql, so nobody can set it from the API; a person can
-- read their own, which is their own datum and nothing else's.
-- ---------------------------------------------------------------------------
alter table public.utenti add column avviso_dormienza_il timestamptz;

comment on column public.utenti.avviso_dormienza_il is
  'SPEC §7. When the 23-month dormancy warning went out. NULL = not warned. Set and cleared by the database alone.';

-- Coming back clears the warning: whoever signs in starts the two years
-- again, and in two more years is warned again rather than deleted in
-- silence. A trigger and not a line inside registra_accesso() because the
-- rule has to hold on every path that moves ultimo_accesso, present and
-- future — and because a BEFORE trigger may touch a column the caller has
-- no grant on.
create function public.azzera_avviso_dormienza()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ultimo_accesso is distinct from old.ultimo_accesso then
    new.avviso_dormienza_il := null;
  end if;
  return new;
end
$$;

create trigger utenti_azzera_avviso_dormienza
  before update on public.utenti
  for each row execute function public.azzera_avviso_dormienza();

-- ---------------------------------------------------------------------------
-- 2. When an account was closed.
--
-- §7 keeps the consent register for 24 months "dopo la chiusura dell'account".
-- After the erasure nothing is left that says when that was: the consensi
-- rows carry an id that no longer resolves to anyone, and a closing that
-- revoked nothing writes no row at all. Without a date the rule cannot be
-- applied, so the closing itself notes one.
--
-- The row holds an internal identifier and an instant. It says that an
-- account existed and when it ended, and nothing about who that was — the
-- same status the consensi rows it accompanies have, and it is removed with
-- them at the 24-month mark.
--
-- RLS on, no policy, no grant to anon or authenticated: reachable by the
-- backend job and by the definer functions below, and by nobody else
-- (rule 2, same discipline as richieste_link).
-- ---------------------------------------------------------------------------
create table public.account_chiusi (
  utente_id uuid primary key,
  chiuso_il timestamptz not null default now()
);

create index account_chiusi_data on public.account_chiusi (chiuso_il);

alter table public.account_chiusi enable row level security;

comment on table public.account_chiusi is
  'SPEC §5.5, §7. Internal id and closing instant, so the 24-month retention of the consent register is applicable. Removed with those rows.';

-- ---------------------------------------------------------------------------
-- 3. esegui_cancellazione gains a second argument: whether the bookings keep
--    their statistical snapshot.
--
-- The rule of §5.3 (rule 19) is about an art. 17 request: "una richiesta
-- esplicita di cancellazione va onorata per intero, non aggirata con una
-- copia". The nightly closing of a dormant account is not a request — it is
-- this system tidying up on its own — and the person's bookings older than
-- thirty days have already been anonymised WITH their snapshot by cleanup 4
-- below. Without this argument the last few weeks of a dormant account would
-- behave differently from every week before them, for no reason anyone could
-- state (decision of 2026-09-11).
--
-- The default is false, so `cancella_mio_account()` — the button a person
-- presses — keeps copying nothing, unchanged.
--
-- Dropped and recreated because the signature changes. The steps and the
-- reasons for their order are the ones written in *_diritti.sql; what is new
-- is step 2 and the account_chiusi row.
-- ---------------------------------------------------------------------------
drop function public.esegui_cancellazione(uuid);

create function public.esegui_cancellazione(
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

  -- 2. Only for a closing the person did not ask for: the snapshot of §5.3,
  --    taken here because step 3 is about to empty the fields it reads. An
  --    absent or revoked consent leaves all five NULL, so this copies
  --    nothing — exactly the test the consent register itself uses (§5.5).
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
  end if;

  -- 3. Revoke what was consented, through the state itself (§5.5).
  update public.utenti u
     set nome_pubblico = null,
         mostra_nome_pubblico = false,
         eta = null,
         genere = null,
         professione = null,
         motivo_visita = null,
         residenza = null
   where u.id = p_utente_id;

  -- 4. Cut every link still standing, copying nothing (§5.3, rule 19).
  --    On an art. 17 erasure this is every booking of the person; after
  --    step 2 there is nothing left to do.
  update public.prenotazioni p
     set utente_id = null,
         anonimizzata = true
   where p.utente_id = p_utente_id;

  -- 5. The daily name-change counter has no foreign key to follow.
  delete from public.cambi_nome c where c.utente_id = p_utente_id;

  -- 6. When this account ended, for the retention of §7. Written before the
  --    account goes, so the two cannot come apart.
  insert into public.account_chiusi (utente_id)
  values (p_utente_id)
  on conflict (utente_id) do nothing;

  -- 7. The account itself. Cascades to utenti, and from there to incarichi
  --    and moderazioni.
  delete from auth.users a where a.id = p_utente_id;
end
$$;

revoke all on function public.esegui_cancellazione(uuid, boolean) from public, anon, authenticated;

comment on function public.esegui_cancellazione(uuid, boolean) is
  'SPEC §7 art. 17, §8.4. The erasure itself. p_copia_stat only for a closing nobody asked for (§5.3). No grant: reached through cancella_mio_account() and cancella_account_dormienti().';

-- ---------------------------------------------------------------------------
-- 4. Bookings older than GIORNI_ANONIMIZZAZIONE — §7, §5.3.
--
-- "Prenotazioni oltre 30 giorni": counted from the day booked, not from the
-- day the booking was made. It is the date of the presence, and it is what
-- the row is about (§5.3, clarified 2026-09-11).
--
-- The copy of the five optional values happens here and only here for a
-- living account, once, in the same statement that cuts the link — so there
-- is no instant in which a booking is anonymised but not yet snapshotted, or
-- snapshotted but still attached to a person. Copying all five unconditionally
-- is the consent check: DATI_FACOLTATIVI is active exactly when at least one
-- of them is filled, and when it is not, five NULLs are copied, which is to
-- say nothing (§5.5).
--
-- Rows already anonymised are excluded, so nothing is ever re-copied or
-- back-filled (rule 19). A cancelled booking is anonymised like any other:
-- until then it is still part of what "Scarica i miei dati" owes the person.
-- ---------------------------------------------------------------------------
create function public.anonimizza_prenotazioni(p_giorni integer)
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
     and not p.anonimizzata
     and p.data < public.oggi_roma() - p_giorni;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.anonimizza_prenotazioni(integer) is
  'SPEC §5.3, §7. Cuts the link with the person and takes the statistical snapshot, once. Backend job only.';

revoke all on function public.anonimizza_prenotazioni(integer) from public, anon, authenticated;
grant execute on function public.anonimizza_prenotazioni(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. The accounts to warn — §7, "Avviso via email a 23 mesi".
--
-- Claims and returns in one statement, the same discipline as
-- promemoria_da_inviare(): two overlapping runs cannot warn the same person
-- twice, and a send the provider refuses is a warning lost, never a warning
-- repeated. Losing one is harmless here in a way it is not for a reminder:
-- the account is not deleted until a month after the warning went out, and
-- cleanup 6 will not touch an account that was never warned at all.
--
-- Returns the address, so it is INVOKER with a guard as well as a grant: the
-- two say the same thing twice, and a grant added by mistake one day would
-- still not open it to a signed-in person.
-- ---------------------------------------------------------------------------
create function public.avvisi_dormienza_da_inviare(p_mesi integer)
returns table (
  utente_id      uuid,
  email          text,
  ultimo_accesso timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  return query
  with presi as (
    update public.utenti u
       set avviso_dormienza_il = now()
     where u.ultimo_accesso < now() - make_interval(months => p_mesi)
       and u.avviso_dormienza_il is null
    returning u.id, u.email, u.ultimo_accesso
  )
  select x.id, x.email, x.ultimo_accesso from presi x;
end
$$;

comment on function public.avvisi_dormienza_da_inviare(integer) is
  'SPEC §7. Claims the dormant accounts to warn and returns them once. Backend job only: it carries addresses.';

revoke all on function public.avvisi_dormienza_da_inviare(integer) from public, anon, authenticated;
grant execute on function public.avvisi_dormienza_da_inviare(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 6. The dormant accounts to close — §7, "cancellazione a 24".
--
-- Two conditions, not one. The months of silence are the rule as written;
-- the warning is the rest of the same sentence. An account is closed only if
-- it was warned, and only once the distance between the two values of §10
-- has passed since the warning went out. So a job that was switched off for
-- half a year warns first and closes a month later, instead of deleting
-- everybody the night it comes back — which is what "avviso a 23 mesi" is
-- for in the first place.
--
-- One account at a time on purpose: esegui_cancellazione() is seven
-- statements, and a failure on one person must not undo the closing of
-- another. SECURITY DEFINER because that function has no grant to anyone.
-- No email is sent here: after the closing there is no address left to write
-- to, and the warning of cleanup 5 was the notice (§7, art. 17 row).
-- ---------------------------------------------------------------------------
create function public.cancella_account_dormienti(p_mesi integer, p_mesi_avviso integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_n  integer := 0;
begin
  for v_id in
    select u.id
      from public.utenti u
     where u.ultimo_accesso < now() - make_interval(months => p_mesi)
       and u.avviso_dormienza_il is not null
       and u.avviso_dormienza_il < now() - make_interval(months => p_mesi - p_mesi_avviso)
  loop
    perform public.esegui_cancellazione(v_id, true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;

comment on function public.cancella_account_dormienti(integer, integer) is
  'SPEC §7. Closes accounts dormant for p_mesi months that were warned p_mesi - p_mesi_avviso months ago. Backend job only.';

revoke all on function public.cancella_account_dormienti(integer, integer) from public, anon, authenticated;
grant execute on function public.cancella_account_dormienti(integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Link requests never completed — §6.1 point 4, §7.
--
-- Asking for a link registers the address with Auth; opening it is what
-- creates the profile (see *_accesso.sql). An address that never opened one
-- leaves a stub with no profile behind it, and §6.1 says so in as many
-- words: "Un'email che ha richiesto un link senza mai usarlo non ha un
-- profilo e viene eliminata dalla pulizia notturna".
--
-- Deleting from auth.users takes its identities, sessions and unused tokens
-- with it. Nothing in public is touched: there is nothing there to touch.
-- SECURITY DEFINER because the auth schema is not the job's to write.
-- ---------------------------------------------------------------------------
create function public.cancella_richieste_incomplete(p_ore integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from auth.users a
   where a.email_confirmed_at is null
     and a.created_at < now() - make_interval(hours => p_ore);

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.cancella_richieste_incomplete(integer) is
  'SPEC §6.1 point 4, §7. Removes Auth stubs of link requests never opened. Backend job only.';

revoke all on function public.cancella_richieste_incomplete(integer) from public, anon, authenticated;
grant execute on function public.cancella_richieste_incomplete(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Expired fingerprints of the request limit — §6.1, §7.
--
-- consenti_richiesta_link() already drops them on every call, which is
-- enough while somebody is asking for links. This is for the hours when
-- nobody is: a table that is emptied only by its own traffic keeps the last
-- fingerprints of the night until morning, and §7 says one hour.
-- ---------------------------------------------------------------------------
create function public.cancella_impronte_scadute()
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

  delete from public.richieste_link r
   where r.richiesta_il < now() - interval '1 hour';

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.cancella_impronte_scadute() is
  'SPEC §6.1, §7. Drops fingerprints older than one hour. Backend job only.';

revoke all on function public.cancella_impronte_scadute() from public, anon, authenticated;
grant execute on function public.cancella_impronte_scadute() to service_role;

-- ---------------------------------------------------------------------------
-- 9. The consent register of closed accounts — §7, 24 months.
--
-- The only cleanup that must run as the calling role and not as the owner:
-- consensi refuses a DELETE unless `current_user` is service_role
-- (*_consensi.sql, "consensi rows are removed only by the retention job").
-- This is that job. SECURITY DEFINER would arrive as postgres and be refused
-- by the very trigger written to protect the register.
--
-- The account_chiusi row goes in the same breath as the rows it dates: after
-- this, that identifier exists nowhere in the system.
-- ---------------------------------------------------------------------------
create function public.cancella_consensi_scaduti(p_mesi integer)
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

  delete from public.consensi c
   using public.account_chiusi a
   where a.utente_id = c.utente_id
     and a.chiuso_il < now() - make_interval(months => p_mesi);

  get diagnostics v_n = row_count;

  delete from public.account_chiusi a
   where a.chiuso_il < now() - make_interval(months => p_mesi);

  return v_n;
end
$$;

comment on function public.cancella_consensi_scaduti(integer) is
  'SPEC §5.5, §7. Removes the consent rows of accounts closed p_mesi months ago, and the closing dates with them. Backend job only.';

revoke all on function public.cancella_consensi_scaduti(integer) from public, anon, authenticated;
grant execute on function public.cancella_consensi_scaduti(integer) to service_role;
