-- Sign-in by email link — SPEC §6.1, §8.4, §12 step 2.
--
-- Three things live here:
--   1. the profile row is created when the link is USED, not when it is
--      requested (§6.1 point 4);
--   2. registra_accesso(): updates ultimo_accesso and tells whether this is
--      the first sign-in (drives the one-time optional-fields screen, §6.1
--      point 5, built at step 6);
--   3. the request limit of §6.1 (per email and per network address, per
--      hour), kept as irreversible fingerprints that expire after an hour.

-- ---------------------------------------------------------------------------
-- 1. Profile creation at first use of the link.
--
-- Supabase Auth registers the address as soon as a link is requested, with
-- email_confirmed_at empty until the link is opened. The utenti row must not
-- exist for an address that never completed sign-in, so the trigger fires on
-- confirmation: an UPDATE that sets email_confirmed_at, or an INSERT that
-- arrives already confirmed (admin-created users, tests). Unconfirmed stubs
-- are removed by the nightly job of §7 (step 11).
-- ---------------------------------------------------------------------------
drop trigger utenti_da_auth_insert on auth.users;

create or replace function public.crea_utente_da_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;
  insert into public.utenti (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger utenti_da_auth_conferma
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.crea_utente_da_auth();

-- ---------------------------------------------------------------------------
-- 2. registra_accesso() — called by the app right after a link is verified.
--
-- Runs as the caller (security invoker): RLS lets a person touch their own
-- row only, and ultimo_accesso is among the columns they may update. Returns
-- true on the first sign-in: creato_il and ultimo_accesso are both set to
-- the insert time and only this function moves ultimo_accesso afterwards.
-- ---------------------------------------------------------------------------
create function public.registra_accesso()
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_primo boolean;
begin
  select u.creato_il = u.ultimo_accesso
    into v_primo
    from public.utenti u
   where u.id = (select auth.uid());

  if v_primo is null then
    return false;
  end if;

  update public.utenti
     set ultimo_accesso = now()
   where id = (select auth.uid());

  return v_primo;
end
$$;

revoke all on function public.registra_accesso() from public, anon;
grant execute on function public.registra_accesso() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Request limit (§6.1): at most N link requests per email per hour and
--    M per network address per hour. Values come from config/limits.ts and
--    are passed in by the caller: one source of truth, no mirror.
--
-- The table stores fingerprints only — keyed hashes computed by the server
-- with a secret it alone holds — never an address of either kind. Rows older
-- than an hour are dropped on every call. No grant and no policy: the table
-- is reachable only through the definer function below.
-- ---------------------------------------------------------------------------
create table public.richieste_link (
  id             uuid primary key default gen_random_uuid(),
  impronta_email text not null,
  impronta_rete  text not null,
  richiesta_il   timestamptz not null default now()
);

create index richieste_link_email on public.richieste_link (impronta_email, richiesta_il);
create index richieste_link_rete  on public.richieste_link (impronta_rete, richiesta_il);

alter table public.richieste_link enable row level security;

comment on table public.richieste_link is
  'SPEC §6.1 request limit. Fingerprints only, expire after one hour. Written by consenti_richiesta_link() alone.';

create function public.consenti_richiesta_link(
  p_impronta_email text,
  p_impronta_rete  text,
  p_max_email      integer,
  p_max_rete       integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email integer;
  v_rete  integer;
begin
  delete from public.richieste_link
   where richiesta_il < now() - interval '1 hour';

  select count(*) filter (where impronta_email = p_impronta_email),
         count(*) filter (where impronta_rete  = p_impronta_rete)
    into v_email, v_rete
    from public.richieste_link
   where impronta_email = p_impronta_email
      or impronta_rete  = p_impronta_rete;

  if v_email >= p_max_email or v_rete >= p_max_rete then
    return false;
  end if;

  insert into public.richieste_link (impronta_email, impronta_rete)
  values (p_impronta_email, p_impronta_rete);

  return true;
end
$$;

revoke all on function public.consenti_richiesta_link(text, text, integer, integer) from public;
grant execute on function public.consenti_richiesta_link(text, text, integer, integer) to anon, authenticated;
