-- Base: enums, shared functions, default privileges.
-- SPEC §5 (types), §8.4 (today in Europe/Rome), §10 (FINESTRA_GIORNI).

-- ---------------------------------------------------------------------------
-- Default privileges
--
-- Supabase grants anon and authenticated full access to every new table in
-- `public` by default. This project closes that: every table starts with no
-- grants and RLS enabled, and each migration grants exactly what a role may
-- touch (CLAUDE.md rule 2). Anything not granted here is unreachable through
-- the API. service_role keeps its grants: it is the backend-only key used by
-- the nightly jobs and the statistics engine.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enums — values are exactly the ones written in SPEC §5.1 and §5.3.
-- ---------------------------------------------------------------------------
create type public.fascia as enum ('MATTINA', 'POMERIGGIO');
create type public.stato_prenotazione as enum ('ATTIVA', 'ANNULLATA');
create type public.fascia_eta as enum ('18-25', '26-35', '36-50', '51-65', 'Oltre 65');
create type public.genere as enum ('M', 'F', 'Preferisco non rispondere');
create type public.residenza as enum ('Valle Soana', 'Canavese', 'Piemonte', 'Italia', 'Altro');
create type public.lingua as enum ('it', 'en', 'fr');
create type public.tipo_consenso as enum ('NOME_PUBBLICO', 'DATI_FACOLTATIVI');
create type public.valore_consenso as enum ('DATO', 'REVOCATO');
create type public.ruolo_incarico as enum ('REFERENTE', 'AMMINISTRATORE');
create type public.giorno_settimana as enum ('LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM');

-- ---------------------------------------------------------------------------
-- Today, always in Europe/Rome (SPEC §8.4). A UTC server is still on the
-- previous day until 02:00 Italian summer time.
-- ---------------------------------------------------------------------------
create function public.oggi_roma()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Rome')::date
$$;

-- ---------------------------------------------------------------------------
-- Booking window length (SPEC §10, D8).
--
-- This is a MIRROR of FINESTRA_GIORNI in config/limits.ts, needed because the
-- referente access policy and the public views run inside Postgres.
-- tests/rls.test.ts asserts the two values are equal. Change both together.
-- ---------------------------------------------------------------------------
create function public.finestra_giorni()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 14
$$;

-- Last bookable date, inclusive: today + FINESTRA_GIORNI.
create function public.fine_finestra()
returns date
language sql
stable
set search_path = ''
as $$
  select public.oggi_roma() + public.finestra_giorni()
$$;
