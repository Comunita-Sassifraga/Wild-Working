-- Admin panel — SPEC §6.7, §6.5 level 3, §8.2, §8.4, §12 step 8.
--
-- Everything the panel can do is decided here and not in a page (§8.3,
-- CLAUDE.md rule 2). Three things arrive with this migration:
--
--   1. the register of moderations (§5.9, added to the spec with this step)
--      and the single write path that clears a public name;
--   2. the notice the cleared person reads in their settings (§6.5), which
--      is the in-app half of the warning — the email is step 9;
--   3. the list of bookings a change has left behind (§8.2, §8.4), which the
--      panel shows to a human and NEVER acts on by itself (rule 6).
--
-- Error codes, matched by lib/db/amministrazione.ts:
--   MD001  utente inesistente
--   MD002  nessun nome pubblico da rimuovere
-- A caller who is not an amministratore gets 42501, like any other refusal.

-- ---------------------------------------------------------------------------
-- moderazioni — SPEC §5.9, §6.7 "viene registrata (chi, quando, quale nome)".
--
-- Never an email address: the internal id is what the admin acted on, and it
-- is enough to answer for the action afterwards. The row lives as long as the
-- person's account and goes with it (decision of 2026-09-10, SPEC §7).
-- ---------------------------------------------------------------------------
create table public.moderazioni (
  id                 uuid primary key default gen_random_uuid(),
  utente_id          uuid not null references public.utenti (id) on delete cascade,
  nome_rimosso       text not null,
  -- The amministratore who acted. Kept as a reference, cleared if that
  -- account is one day deleted: the action stays on record, its author does
  -- not hold the row back.
  amministratore_id  uuid references public.utenti (id) on delete set null,
  avvenuta_il        timestamptz not null default now()
);

create index moderazioni_utente on public.moderazioni (utente_id, avvenuta_il);

alter table public.moderazioni enable row level security;

comment on table public.moderazioni is
  'SPEC §5.9, §6.7. One row per cleared public name. Never an email address. Deleted with the account.';

-- Read by the amministratore alone. No insert, update or delete grant to
-- anyone: the row is written by azzera_nome_pubblico() and by nothing else.
grant select on public.moderazioni to authenticated;

create policy moderazioni_lettura_admin on public.moderazioni
  for select to authenticated
  using (public.is_amministratore());

-- ---------------------------------------------------------------------------
-- The notice of §6.5: "Lo stesso messaggio compare nelle impostazioni
-- personali al primo accesso successivo."
--
-- An instant, not a flag, so the settings page can say when it happened. The
-- person clears it themselves from that page; nobody else can, because the
-- existing utenti_propria_riga_modifica policy scopes the update to auth.uid().
-- ---------------------------------------------------------------------------
alter table public.utenti add column avviso_moderazione timestamptz;

comment on column public.utenti.avviso_moderazione is
  'SPEC §6.5. Set when an amministratore clears the public name; shown once in the settings and cleared by the person. NULL = nothing to say.';

grant update (avviso_moderazione) on public.utenti to authenticated;

-- ---------------------------------------------------------------------------
-- The moderation screen — SPEC §6.7: "La schermata mostra il nome pubblico e
-- l'identificativo interno, mai l'email dell'utente."
--
-- That "mai" is enforced by leaving the column out of the view the screen
-- reads, not by the page choosing not to render it. utenti_amministrazione
-- carries the email and is used by the other screens; this one cannot.
-- ---------------------------------------------------------------------------
create view public.nomi_pubblici_moderazione
with (security_invoker = false)
as
  select u.id,
         u.nome_pubblico,
         u.mostra_nome_pubblico,
         u.avviso_moderazione is not null as avviso_in_attesa
  from public.utenti u
  where public.is_amministratore()
    and u.nome_pubblico is not null;

comment on view public.nomi_pubblici_moderazione is
  'SPEC §6.7. Public name and internal id only — no email address reaches the moderation screen.';

grant select on public.nomi_pubblici_moderazione to authenticated;

-- ---------------------------------------------------------------------------
-- azzera_nome_pubblico — SPEC §6.5 level 3.
--
-- One statement for the whole action: empty the name, switch the visibility
-- off, record who did it and to which name, and raise the notice the person
-- will read. Either all of it happens or none of it does.
--
-- What it deliberately does NOT do: touch a single prenotazione, or close the
-- account (§6.5, §8.4). There is no sanction beyond the removal of the name.
--
-- SECURITY DEFINER because nome_pubblico is not updatable by anyone through
-- the API (see *_nome_pubblico.sql) and utenti is readable only row by row.
-- The role is checked inside, so the rule holds whatever page calls this.
--
-- The daily change limit of §6.5 is not consumed: it counts what a person
-- does to their own name, and this is not that.
-- ---------------------------------------------------------------------------
create function public.azzera_nome_pubblico(p_utente_id uuid)
returns table (nome_rimosso text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := (select auth.uid());
  v_nome   text;
  v_esiste boolean;
begin
  if not public.is_amministratore() then
    raise exception 'azione riservata all''amministratore' using errcode = '42501';
  end if;

  select true, u.nome_pubblico into v_esiste, v_nome
    from public.utenti u
   where u.id = p_utente_id;

  if v_esiste is null then
    raise exception 'utente inesistente' using errcode = 'MD001';
  end if;

  if v_nome is null then
    raise exception 'nessun nome pubblico da rimuovere' using errcode = 'MD002';
  end if;

  update public.utenti u
     set nome_pubblico = null,
         mostra_nome_pubblico = false,
         avviso_moderazione = now()
   where u.id = p_utente_id;

  insert into public.moderazioni (utente_id, nome_rimosso, amministratore_id)
  values (p_utente_id, v_nome, v_admin);

  return query select v_nome;
end
$$;

revoke all on function public.azzera_nome_pubblico(uuid) from public;
grant execute on function public.azzera_nome_pubblico(uuid) to authenticated;

comment on function public.azzera_nome_pubblico(uuid) is
  'SPEC §6.5 level 3. Empties the name, switches visibility off, records the action, raises the notice. Never touches a prenotazione.';

-- ---------------------------------------------------------------------------
-- Bookings a change has left behind — SPEC §8.2 and §8.4.
--
-- "Il sistema non cancella nulla in automatico. Mostra l'elenco dei giorni in
-- eccesso e chiede all'amministratore di intervenire, avvisando le persone."
-- This view is that list, and it is the whole mechanism: there is no function
-- anywhere that cancels somebody else's booking (rule 6).
--
-- Only active bookings from today to the end of the window: a booking can
-- only ever have been made inside the window, so the future never reaches
-- past it, and the past is nobody's problem any more.
--
-- Unlike every other view here it does NOT filter on `s.attiva`: a suspended
-- sede is precisely one of the reasons a booking needs attention.
--
-- The email is here on purpose — §8.4 asks for "l'elenco delle persone da
-- avvisare", and §7 lists the amministratore among who may see an address.
-- Nothing else about the person comes through: none of the five optional
-- fields, none of the stat_* columns (rules 15 and 16).
-- ---------------------------------------------------------------------------
create view public.prenotazioni_da_verificare
with (security_invoker = false)
as
  select
    p.id as prenotazione_id,
    p.sede_id,
    s.nome as sede_nome,
    p.data,
    p.fascia,
    u.email,
    case
      when not s.attiva then 'SEDE_SOSPESA'
      when not public.sede_in_stagione(s.id, p.data) then 'FUORI_STAGIONE'
      when public.in_chiusura(s.id, p.data, p.fascia) then 'CHIUSURA'
      when public.giorno_di(p.data) <> all (s.giorni_apertura) then 'GIORNO_CHIUSO'
      else 'CAPIENZA_RIDOTTA'
    end as motivo
  from public.prenotazioni p
  join public.sedi s on s.id = p.sede_id
  -- LEFT: an anonymised booking has no person to warn. It cannot be in the
  -- future either, but the join must not silently drop rows.
  left join public.utenti u on u.id = p.utente_id
  where public.is_amministratore()
    and p.stato = 'ATTIVA'
    and p.data between public.oggi_roma() and public.fine_finestra()
    and (
      not s.attiva
      or not public.sede_in_stagione(s.id, p.data)
      or public.in_chiusura(s.id, p.data, p.fascia)
      or public.giorno_di(p.data) <> all (s.giorni_apertura)
      or p.posto_progressivo > s.capienza
    );

comment on view public.prenotazioni_da_verificare is
  'SPEC §8.2, §8.4. Bookings left behind by a change, for a human to act on. Nothing here cancels anything.';

grant select on public.prenotazioni_da_verificare to authenticated;
