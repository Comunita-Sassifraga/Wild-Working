-- Public name: validation, blocklist and daily change limit — SPEC §6.5,
-- §12 step 6.
--
-- All three checks live here and not in the page, so they hold whatever path
-- the write comes from (§8.3, CLAUDE.md rule 3). Of the three moderation
-- layers of §6.5 this migration builds the first one only: the after-the-fact
-- notice to EMAIL_MODERAZIONE is step 9 (no mail provider yet) and the
-- amministratore's clear action is step 8, with the panel.
--
-- Error codes, matched by lib/db/utenti.ts:
--   NP001  nome troppo lungo        — more than 40 characters
--   NP002  contatto nel nome        — link, email address or phone number
--   NP003  termine vietato          — refused with a neutral message
--   NP004  troppi cambi oggi        — over MAX_CAMBI_NOME_GIORNO

-- ---------------------------------------------------------------------------
-- Comparison form: lowercase, without accents.
--
-- Used both by the blocklist check and by the unique index on the list, so
-- "Idiota" and "idiòta" are one term and one match (§6.5, decision of
-- 2026-09-10). Nothing else is stripped: collapsing punctuation as well would
-- start matching across word boundaries and refuse ordinary names.
-- ---------------------------------------------------------------------------
create function public.normalizza_confronto(p_testo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(normalize(coalesce(p_testo, ''), nfd)), E'[\u0300-\u036f]', '', 'g')
$$;

-- ---------------------------------------------------------------------------
-- Blocklist (§6.5, level 1) — editable by the amministratore without touching
-- the code. The list starts empty: the terms are entered from the panel at
-- step 8. Until then the filter exists and refuses nothing, while the format
-- check and the daily limit below already work.
--
-- Nobody but the amministratore may read it: knowing the list is knowing how
-- to skirt it. The write-time check therefore runs in a definer function.
-- ---------------------------------------------------------------------------
create table public.termini_vietati (
  id         uuid primary key default gen_random_uuid(),
  termine    text not null check (btrim(termine) <> ''),
  creato_il  timestamptz not null default now(),
  creato_da  uuid references public.utenti (id) on delete set null
);

create unique index termini_vietati_unico
  on public.termini_vietati (public.normalizza_confronto(termine));

alter table public.termini_vietati enable row level security;

comment on table public.termini_vietati is
  'SPEC §6.5 level 1. Read and written by the amministratore only; matched at write time by valida_nome_pubblico().';

grant select, insert, update, delete on public.termini_vietati to authenticated;

create policy termini_vietati_solo_admin on public.termini_vietati
  for all to authenticated
  using (public.is_amministratore())
  with check (public.is_amministratore());

-- ---------------------------------------------------------------------------
-- Change log, for the daily limit alone (§6.5, level 2).
--
-- utente_id and an instant: enough to count, nothing to remember. Rows older
-- than two days are dropped on every call, the way richieste_link does it.
-- No grant and no policy: only the definer function below touches it.
-- ---------------------------------------------------------------------------
create table public.cambi_nome (
  -- No foreign key: rows live two days at most and a deleted account must
  -- not be held back by them.
  id           uuid primary key default gen_random_uuid(),
  utente_id    uuid not null,
  cambiato_il  timestamptz not null default now()
);

create index cambi_nome_utente on public.cambi_nome (utente_id, cambiato_il);

alter table public.cambi_nome enable row level security;

comment on table public.cambi_nome is
  'SPEC §6.5 daily change limit. Counts only; written by imposta_nome_pubblico() alone.';

-- ---------------------------------------------------------------------------
-- Format and blocklist, as a trigger on utenti.
--
-- A trigger and not a check inside the function below, so that the rules hold
-- on every write path — including service_role and the nightly jobs. It fires
-- only when the name really changes, and runs after utenti_normalizza (which
-- turns an empty name into NULL): trigger order at the same timing is
-- alphabetical, and `utenti_valida_nome` sorts after `utenti_normalizza`.
--
-- SECURITY DEFINER because termini_vietati is unreadable to the caller.
-- ---------------------------------------------------------------------------
create function public.valida_nome_pubblico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_confronto text;
begin
  if new.nome_pubblico is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.nome_pubblico is not distinct from old.nome_pubblico then
    return new;
  end if;

  if char_length(new.nome_pubblico) > 40 then
    raise exception 'nome pubblico troppo lungo' using errcode = 'NP001';
  end if;

  -- Email address, link and phone number (§6.5). Unlike the blocklist these
  -- rules are worth explaining, and the message says what to take out.
  if new.nome_pubblico like '%@%'
     or new.nome_pubblico like '%://%'
     or public.normalizza_confronto(new.nome_pubblico) like '%www.%'
     -- A dot glued between letters, as in "sassifraga.org".
     or new.nome_pubblico ~ '[[:alnum:]]\.[[:alpha:]]{2,}'
     or new.nome_pubblico ~ '\+[0-9]'
     -- Six or more digits in a row, however they are spaced out.
     or translate(new.nome_pubblico, ' .-/()', '') ~ '[0-9]{6,}'
  then
    raise exception 'contatto nel nome pubblico' using errcode = 'NP002';
  end if;

  -- The term is looked for anywhere inside the name, ignoring case and
  -- accents (§6.5). position() and not LIKE: a term containing % or _ must
  -- match itself, not act as a pattern.
  v_confronto := public.normalizza_confronto(new.nome_pubblico);
  if exists (
    select 1
    from public.termini_vietati t
    where position(public.normalizza_confronto(t.termine) in v_confronto) > 0
  ) then
    raise exception 'nome pubblico non consentito' using errcode = 'NP003';
  end if;

  return new;
end
$$;

create trigger utenti_valida_nome
  before insert or update on public.utenti
  for each row execute function public.valida_nome_pubblico();

-- ---------------------------------------------------------------------------
-- imposta_nome_pubblico — the single write path for the name, the way
-- prenota_posto is the single write path for a booking.
--
-- p_max_cambi comes from MAX_CAMBI_NOME_GIORNO in config/limits.ts: passed in
-- by the caller, never copied into the database. Only a save that changes the
-- text of the name counts against the limit — that is exactly what will send
-- an email at step 9. Turning the switch on or off does not (§6.5, decision
-- of 2026-09-10) and stays an ordinary update of mostra_nome_pubblico.
--
-- SECURITY DEFINER because the UPDATE grant on nome_pubblico is revoked
-- below: the function scopes every read and write to auth.uid() itself.
-- ---------------------------------------------------------------------------
create function public.imposta_nome_pubblico(
  p_nome       text,
  p_mostra     boolean,
  p_max_cambi  integer
)
returns table (nome_pubblico text, mostra_nome_pubblico boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_nome   text := nullif(btrim(p_nome), '');
  v_prima  text;
  v_cambi  integer;
  v_esiste boolean;
begin
  if v_utente is null then
    raise exception 'accesso richiesto' using errcode = '28000';
  end if;

  select true, u.nome_pubblico into v_esiste, v_prima
    from public.utenti u
   where u.id = v_utente;

  if v_esiste is null then
    raise exception 'accesso richiesto' using errcode = '28000';
  end if;

  if v_nome is distinct from v_prima then
    delete from public.cambi_nome where cambiato_il < now() - interval '2 days';

    select count(*) into v_cambi
      from public.cambi_nome c
     where c.utente_id = v_utente
       and (c.cambiato_il at time zone 'Europe/Rome')::date = public.oggi_roma();

    if v_cambi >= p_max_cambi then
      raise exception 'troppi cambi di nome oggi' using errcode = 'NP004';
    end if;

    -- Recorded before the update: if the name is refused by the trigger the
    -- whole statement rolls back, this row included.
    insert into public.cambi_nome (utente_id) values (v_utente);
  end if;

  update public.utenti u
     set nome_pubblico = v_nome,
         mostra_nome_pubblico = p_mostra
   where u.id = v_utente;

  return query
    select u.nome_pubblico, u.mostra_nome_pubblico
      from public.utenti u
     where u.id = v_utente;
end
$$;

revoke all on function public.imposta_nome_pubblico(text, boolean, integer) from public;
grant execute on function public.imposta_nome_pubblico(text, boolean, integer) to authenticated;

-- The name is writable through that function and nowhere else: a plain update
-- would skip the daily limit. The switch stays directly updatable — it sends
-- no notice, consumes no limit, and is the person's own visibility.
revoke update (nome_pubblico) on public.utenti from authenticated;
