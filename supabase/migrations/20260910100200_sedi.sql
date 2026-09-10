-- sedi, periodi_attivita, chiusure — SPEC §5.2, §5.7, §5.4.
--
-- Site availability is data, not code (CLAUDE.md rule 11): seasons are rows
-- in periodi_attivita, exceptions are rows in chiusure, and both are edited
-- from the admin panel without a deploy.

create table public.sedi (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  comune              text not null,
  indirizzo           text,
  -- Postgres point is (x, y) = (longitude, latitude).
  coordinate          point,
  capienza            integer not null check (capienza >= 0),
  orario_mattina      text not null default '09:00–13:00',
  orario_pomeriggio   text not null default '14:00–18:00',
  -- Fifth bookability condition of §5.2. Default lun–sab, editable per sede.
  giorni_apertura     public.giorno_settimana[] not null default '{LUN,MAR,MER,GIO,VEN,SAB}',
  -- Practical info. Authenticated users only, never in a public view.
  note                text,
  -- Master switch: off = the sede disappears everywhere, whatever the periods.
  attiva              boolean not null default true,
  -- On = ignore periodi_attivita, available all year.
  sempre_disponibile  boolean not null default true
);

alter table public.sedi enable row level security;

comment on table public.sedi is 'SPEC §5.2. Bookability: attiva AND (sempre_disponibile OR in a periodo) AND not in a chiusura AND in window AND weekday in giorni_apertura.';
comment on column public.sedi.note is 'Visible to authenticated users only (SPEC §5.2). Never passwords or access codes.';

-- ---------------------------------------------------------------------------
-- periodi_attivita — §5.7. Several per sede, overlaps allowed (union wins).
-- With ricorre_ogni_anno the year is ignored: only day and month count.
-- ---------------------------------------------------------------------------
create table public.periodi_attivita (
  id                  uuid primary key default gen_random_uuid(),
  sede_id             uuid not null references public.sedi (id) on delete cascade,
  data_inizio         date not null,
  data_fine           date not null,
  etichetta           text not null,
  ricorre_ogni_anno   boolean not null default false,
  constraint periodi_attivita_intervallo check (data_fine >= data_inizio)
);

create index periodi_attivita_sede on public.periodi_attivita (sede_id);

alter table public.periodi_attivita enable row level security;

-- ---------------------------------------------------------------------------
-- chiusure — §5.4. A punctual exception inside an active period.
-- fascia NULL means "tutte le fasce".
-- ---------------------------------------------------------------------------
create table public.chiusure (
  id            uuid primary key default gen_random_uuid(),
  sede_id       uuid not null references public.sedi (id) on delete cascade,
  data_inizio   date not null,
  data_fine     date not null,
  fascia        public.fascia,
  creata_da     uuid references public.utenti (id) on delete set null,
  constraint chiusure_intervallo check (data_fine >= data_inizio)
);

create index chiusure_sede_date on public.chiusure (sede_id, data_inizio, data_fine);

alter table public.chiusure enable row level security;

comment on column public.chiusure.fascia is 'NULL = every fascia of the day (SPEC §5.4 "tutte").';

-- ---------------------------------------------------------------------------
-- Helper for policies on child tables: is the parent sede switched on?
-- SECURITY DEFINER so it works for anon, which has no direct access to sedi.
-- ---------------------------------------------------------------------------
create function public.sede_attiva(p_sede_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.sedi s where s.id = p_sede_id and s.attiva)
$$;
