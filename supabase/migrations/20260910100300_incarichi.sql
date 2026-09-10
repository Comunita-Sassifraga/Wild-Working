-- incarichi — SPEC §5.6, roles of §4.
--
-- REFERENTE is bound to one sede. AMMINISTRATORE is global: sede_id is NULL
-- (decision of 2026-09-10, SPEC §5.6). The two helper functions below are
-- the only way policies ask "who is this?".

create table public.incarichi (
  id          uuid primary key default gen_random_uuid(),
  utente_id   uuid not null references public.utenti (id) on delete cascade,
  sede_id     uuid references public.sedi (id) on delete cascade,
  ruolo       public.ruolo_incarico not null,
  attivo      boolean not null default true,
  constraint incarichi_sede_per_ruolo check (
    (ruolo = 'REFERENTE' and sede_id is not null)
    or (ruolo = 'AMMINISTRATORE' and sede_id is null)
  )
);

-- One row per (user, role, sede); NULL sede folded to a fixed value so the
-- global admin role is also unique per user.
create unique index incarichi_unici
  on public.incarichi (utente_id, ruolo, coalesce(sede_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.incarichi enable row level security;

-- SECURITY DEFINER: policies on incarichi itself call these, and a policy
-- must not recurse into RLS on the same table.
create function public.is_amministratore()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.incarichi i
    where i.utente_id = (select auth.uid())
      and i.ruolo = 'AMMINISTRATORE'
      and i.attivo
  )
$$;

create function public.is_referente_di(p_sede_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.incarichi i
    where i.utente_id = (select auth.uid())
      and i.ruolo = 'REFERENTE'
      and i.sede_id = p_sede_id
      and i.attivo
  )
$$;
