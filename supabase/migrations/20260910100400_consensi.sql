-- consensi — SPEC §5.5, art. 7.1 GDPR.
--
-- Append-only log. Two independent consent types, NOME_PUBBLICO and
-- DATI_FACOLTATIVI; either can be given or revoked without touching the
-- other. Rows are written by the database itself (trigger on utenti), so the
-- log follows the real state of the data whatever code path changed it.

create table public.consensi (
  id          uuid primary key default gen_random_uuid(),
  -- No foreign key on purpose: the register outlives the account by 24
  -- months (§7). After deletion the id no longer resolves to anyone.
  utente_id   uuid not null,
  tipo        public.tipo_consenso not null,
  valore      public.valore_consenso not null,
  data_ora    timestamptz not null default now()
);

create index consensi_utente on public.consensi (utente_id, data_ora);

alter table public.consensi enable row level security;

comment on table public.consensi is 'SPEC §5.5. Append-only. Written by trigger registra_consensi, never by application code.';

-- ---------------------------------------------------------------------------
-- Append-only guard. UPDATE is never allowed. DELETE is allowed only to
-- service_role, for the 24-month purge job (§7, step 11): no user, no admin,
-- no API key other than the backend one.
-- ---------------------------------------------------------------------------
create function public.consensi_solo_append()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'consensi is append-only' using errcode = 'CS001';
  end if;
  if current_user <> 'service_role' then
    raise exception 'consensi rows are removed only by the retention job' using errcode = 'CS002';
  end if;
  return old;
end
$$;

create trigger consensi_no_update
  before update on public.consensi
  for each row execute function public.consensi_solo_append();

create trigger consensi_no_delete
  before delete on public.consensi
  for each row execute function public.consensi_solo_append();

-- ---------------------------------------------------------------------------
-- Automatic logging from utenti.
--
-- NOME_PUBBLICO: given when mostra_nome_pubblico turns on, revoked when it
-- turns off (§5.5, §6.5).
-- DATI_FACOLTATIVI: given when the five optional fields go from all empty to
-- at least one filled; revoked when they go back to all empty — whichever
-- way they were emptied (decision of 2026-09-10, SPEC §5.5).
-- ---------------------------------------------------------------------------
create function public.registra_consensi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome_prima  boolean;
  v_nome_dopo   boolean;
  v_dati_prima  boolean;
  v_dati_dopo   boolean;
begin
  v_nome_dopo := new.mostra_nome_pubblico;
  v_dati_dopo := new.eta is not null
              or new.genere is not null
              or new.professione is not null
              or new.motivo_visita is not null
              or new.residenza is not null;

  if tg_op = 'INSERT' then
    v_nome_prima := false;
    v_dati_prima := false;
  else
    v_nome_prima := old.mostra_nome_pubblico;
    v_dati_prima := old.eta is not null
                 or old.genere is not null
                 or old.professione is not null
                 or old.motivo_visita is not null
                 or old.residenza is not null;
  end if;

  if v_nome_dopo and not v_nome_prima then
    insert into public.consensi (utente_id, tipo, valore) values (new.id, 'NOME_PUBBLICO', 'DATO');
  elsif v_nome_prima and not v_nome_dopo then
    insert into public.consensi (utente_id, tipo, valore) values (new.id, 'NOME_PUBBLICO', 'REVOCATO');
  end if;

  if v_dati_dopo and not v_dati_prima then
    insert into public.consensi (utente_id, tipo, valore) values (new.id, 'DATI_FACOLTATIVI', 'DATO');
  elsif v_dati_prima and not v_dati_dopo then
    insert into public.consensi (utente_id, tipo, valore) values (new.id, 'DATI_FACOLTATIVI', 'REVOCATO');
  end if;

  return new;
end
$$;

create trigger utenti_registra_consensi
  after insert or update on public.utenti
  for each row execute function public.registra_consensi();
