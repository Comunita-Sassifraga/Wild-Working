-- utenti — SPEC §5.1.
--
-- Email is the only mandatory personal field (CLAUDE.md rule 1). The five
-- optional fields (eta, genere, professione, motivo_visita, residenza) are
-- collected under the DATI_FACOLTATIVI consent and are never public
-- (rule 16). No password column: sign-in is by magic link (§6.1).

create table public.utenti (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text not null unique,
  nome_pubblico         text check (char_length(nome_pubblico) <= 40),
  eta                   public.fascia_eta,
  genere                public.genere,
  professione           text check (char_length(professione) <= 100),
  motivo_visita         text check (char_length(motivo_visita) <= 200),
  residenza             public.residenza,
  mostra_nome_pubblico  boolean not null default false,
  lingua                public.lingua not null default 'it',
  creato_il             timestamptz not null default now(),
  ultimo_accesso        timestamptz not null default now()
);

alter table public.utenti enable row level security;

comment on table public.utenti is
  'SPEC §5.1. Email only mandatory field. Optional fields never public, never per-user in admin.';

-- ---------------------------------------------------------------------------
-- Row creation from Supabase Auth.
-- The public row is created the moment Auth creates the user, with the email
-- and nothing else: registration completes with every optional field empty
-- (§6.1, rule 17). Email changes confirmed in Auth are mirrored here.
-- ---------------------------------------------------------------------------
create function public.crea_utente_da_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.utenti (id, email) values (new.id, new.email);
  return new;
end
$$;

create trigger utenti_da_auth_insert
  after insert on auth.users
  for each row execute function public.crea_utente_da_auth();

create function public.sincronizza_email_da_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.utenti set email = new.email where id = new.id;
  return new;
end
$$;

create trigger utenti_da_auth_email
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sincronizza_email_da_auth();

-- ---------------------------------------------------------------------------
-- Empty strings are stored as NULL, so "empty" has exactly one representation.
-- The consent trigger (see *_consensi.sql) relies on this.
-- ---------------------------------------------------------------------------
create function public.normalizza_utente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nome_pubblico := nullif(btrim(new.nome_pubblico), '');
  new.professione   := nullif(btrim(new.professione), '');
  new.motivo_visita := nullif(btrim(new.motivo_visita), '');
  return new;
end
$$;

create trigger utenti_normalizza
  before insert or update on public.utenti
  for each row execute function public.normalizza_utente();
