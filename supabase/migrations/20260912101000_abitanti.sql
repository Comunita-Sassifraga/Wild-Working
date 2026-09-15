-- «Prenota un abitante» — the tables and the access rules. SPEC §15.14 step 14.
--
-- Additive: not one of the nine existing tables is altered (CLAUDE.md rule
-- 20). Six new tables (§15.3), three views over `attivita` (§15.8), and the
-- refusals §15.12 lists. No screen, no email, no panel action: those are
-- steps 15 to 20.
--
-- Two rules shape everything below.
--
--   Access is enforced here, not in a page (rule 22). A user without an
--   active abilitazione for the active edizione must not be able to retrieve
--   a titolo, an abitante_nome or a luogo_generico by any route.
--
--   The three visibility levels of §15.8 cannot be expressed as column
--   grants: "these columns, only for the rows you are enrolled in" is
--   row-dependent column visibility, and GRANT is per role while RLS is per
--   row. So `attivita` is reachable by nobody, and three views stand over it
--   (rule 24).
--
-- FINESTRA_GIORNI appears nowhere in this file, deliberately: an edition runs
-- 29 days and the whole programme must be visible on arrival (rule 21).

-- ---------------------------------------------------------------------------
-- Enums — values exactly as SPEC §15.3 writes them.
--
-- stato_iscrizione carries the same two values as stato_prenotazione and is
-- still its own type: they are two different things that happen to agree
-- today, and a third value added to one must not appear in the other. There
-- is no IN_ATTESA and there is not going to be one (D22, rule 29).
-- ---------------------------------------------------------------------------
create type public.stato_attivita as enum ('BOZZA', 'PUBBLICATA', 'ANNULLATA');
create type public.stato_iscrizione as enum ('ATTIVA', 'ANNULLATA');
create type public.modalita_consenso as enum ('MODULO_CARTACEO_FIRMATO', 'EMAIL_DI_CONSENSO');
create type public.origine_abilitazione as enum ('CODICE', 'MANUALE');

-- ===========================================================================
-- edizioni — §15.3.1
--
-- The time switch of the module, the same idea as periodi_attivita for a
-- sede: seasonality is a row an admin edits, never a condition in code
-- (rule 11, D9).
-- ===========================================================================
create table public.edizioni (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null check (char_length(nome) between 1 and 80),
  data_inizio  date not null,
  data_fine    date not null,
  attiva       boolean not null default false,
  creata_il    timestamptz not null default now(),
  constraint edizioni_intervallo check (data_fine >= data_inizio)
);

-- At most one active edition, ever (§15.3.1). The trigger below turns the
-- others off; this index is what makes "two active editions" impossible
-- rather than merely unlikely.
create unique index edizioni_una_attiva on public.edizioni ((attiva)) where attiva;

alter table public.edizioni enable row level security;

comment on table public.edizioni is
  'SPEC §15.3.1. At most one active at a time, enforced by edizioni_una_attiva.';

-- Activating one deactivates the others (§15.3.1, §15.12). BEFORE, so the
-- unique index sees a consistent picture within the statement. The nested
-- UPDATE sets attiva to false, which re-enters this trigger and returns at
-- the first line: no recursion.
create function public.edizione_unica_attiva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.attiva then
    return new;
  end if;
  update public.edizioni
     set attiva = false
   where attiva
     and id is distinct from new.id;
  return new;
end
$$;

create trigger edizioni_una_sola_attiva
  before insert or update of attiva on public.edizioni
  for each row execute function public.edizione_unica_attiva();

-- ---------------------------------------------------------------------------
-- The active edition: switched on AND today inside its dates (§15.3.1).
-- Both halves matter — the switch has precedence, the calendar closes the
-- module on 18 October without anybody having to remember.
--
-- SECURITY DEFINER: policies on other tables call it, and it must answer the
-- same thing whoever asks.
-- ---------------------------------------------------------------------------
create function public.edizione_attiva()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.edizioni e
  where e.attiva
    and public.oggi_roma() between e.data_inizio and e.data_fine
  limit 1
$$;

comment on function public.edizione_attiva() is
  'SPEC §15.3.1: the edition that is switched on and current today (Europe/Rome). NULL when the module is closed.';

-- ===========================================================================
-- attivita — §15.3.2
--
-- The columns are the table of §15.3.2, in its order. Nothing is added to that
-- table on our own initiative (rule 1, scope note).
--
-- NOT ONE OF THEM IS REQUIRED (decision of 2026-09-12, written into §15.3.2).
-- The 25 activities are typed in by hand, often in one evening, copied out of
-- emails and scattered notes: a half-filled card has to be saveable and
-- finishable the next day. The lengths still hold, and so does the consent
-- rule — which stays the only refusal of its kind in the module (§15.3.2).
--
-- Publishing an incomplete card is therefore allowed, and has two visible
-- consequences the panel of step 16 is the right place to warn about: an
-- activity with no data does not appear in attivita_elenco, and one with no
-- capienza takes no iscrizioni. Neither is a hidden failure — it is a card
-- that is not finished.
--
-- The three visibility levels are noted on each column because whoever reads
-- this file next has to know, at a glance, which of these reaches 45 people.
-- ===========================================================================
create table public.attivita (
  id                     uuid primary key default gen_random_uuid(),
  edizione_id            uuid not null references public.edizioni (id) on delete restrict,
  titolo                 text check (char_length(titolo) between 1 and 80),
  -- Level 1. The abitante's own words, transcribed by the admin. Never
  -- rewritten, summarised or truncated on display (rule 26).
  descrizione            text check (char_length(descrizione) between 1 and 4000),
  abitante_nome          text check (char_length(abitante_nome) between 1 and 40),
  abitante_cognome       text check (char_length(abitante_cognome) between 1 and 60),   -- level 2
  abitante_telefono      text check (char_length(abitante_telefono) between 1 and 30),  -- level 2
  abitante_note_interne  text check (char_length(abitante_note_interne) <= 300),                 -- level 3
  luogo_generico         text check (char_length(luogo_generico) between 1 and 120),
  luogo_esatto           text check (char_length(luogo_esatto) between 1 and 200),      -- level 2
  data                   date,
  ora_inizio             time,
  ora_fine               time,
  capienza               integer check (capienza > 0),
  cosa_portare           text check (char_length(cosa_portare) <= 300),
  lingua_attivita        text check (char_length(lingua_attivita) <= 60),
  stato                  public.stato_attivita not null default 'BOZZA',
  -- The admin's attestation that a signed consent is held by the Direttivo
  -- (§15.8). Not the consent itself: that is the paper (rule 25).
  consenso_raccolto      boolean not null default false,
  consenso_raccolto_il   timestamptz,
  consenso_raccolto_da   uuid references public.utenti (id) on delete set null,
  consenso_modalita      public.modalita_consenso,
  creata_il              timestamptz not null default now(),

  -- §15.12: an activity without the consent tick cannot be published. The
  -- refusal is the database's, not the form's (rule 25).
  constraint attivita_pubblicata_con_consenso
    check (stato <> 'PUBBLICATA' or consenso_raccolto),
  -- §15.3.2: consenso_modalita is mandatory whenever the tick is on, and
  -- meaningless when it is off. The enum closes the list to two (rule 25).
  constraint attivita_modalita_con_consenso
    check (consenso_raccolto = (consenso_modalita is not null)),
  -- Written by the system, never by a request: the trigger below sets it and
  -- this ties it to the tick.
  constraint attivita_consenso_datato
    check (consenso_raccolto = (consenso_raccolto_il is not null))
);

create index attivita_edizione_data on public.attivita (edizione_id, data);

alter table public.attivita enable row level security;

-- Reachable by nobody: no grant, no policy (rule 24, §15.8). Everything a
-- person sees comes from one of the three views below, and from step 16
-- writes come from functions. The blanket revoke is redundant with the
-- default privileges of the base migration and is written out anyway,
-- because this is the one table where being wrong is expensive.
revoke all on public.attivita from anon, authenticated;

comment on table public.attivita is
  'SPEC §15.3.2. Unreachable directly: three views impose the levels of §15.8 (CLAUDE.md rule 24).';
comment on column public.attivita.descrizione is
  'SPEC §15.8. A third party''s own words. Never rewritten, summarised or truncated (rule 26).';
comment on column public.attivita.abitante_note_interne is
  'SPEC §15.8 level 3. Amministratore only, never in an export.';
comment on column public.attivita.consenso_raccolto is
  'SPEC §15.8. An admin attestation that a signed paper exists, not a digital consent.';

-- ---------------------------------------------------------------------------
-- The date must fall inside the edition (§15.3.2, §15.12). A CHECK cannot
-- read another table, so it is a trigger — and a trigger on edizione_id too,
-- so moving an activity to another edition is checked as well.
--
-- A card that has no date yet has nothing to check: the refusal is about a
-- date that is wrong, not about one that has not been typed in.
-- ---------------------------------------------------------------------------
create function public.attivita_dentro_edizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inizio date;
  v_fine   date;
begin
  select e.data_inizio, e.data_fine into v_inizio, v_fine
  from public.edizioni e
  where e.id = new.edizione_id;

  if v_inizio is null then
    raise exception 'edizione inesistente' using errcode = 'AT001';
  end if;

  if new.data is null then
    return new;
  end if;

  if new.data < v_inizio or new.data > v_fine then
    raise exception 'data fuori edizione' using errcode = 'AT002';
  end if;

  return new;
end
$$;

create trigger attivita_data_nell_edizione
  before insert or update of data, edizione_id on public.attivita
  for each row execute function public.attivita_dentro_edizione();

-- ---------------------------------------------------------------------------
-- The consent tick and what the system writes around it (§15.8, §15.12).
--
--   ticked   → consenso_raccolto_il and _da are set from here, whatever the
--              request supplied; they cannot be forged (rule 25).
--   unticked → the two fields and the modalita are cleared, and a published
--              activity returns to BOZZA. That is the "abitante changes his
--              mind" case of §15.12: it must not need a second statement,
--              because whoever unticks the box is not thinking about stato.
-- ---------------------------------------------------------------------------
create function public.attivita_consenso_di_sistema()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consenso_raccolto then
    if tg_op = 'INSERT' or not old.consenso_raccolto then
      new.consenso_raccolto_il := now();
      new.consenso_raccolto_da := (select auth.uid());
    else
      -- Already ticked: the two fields keep what they had. A request cannot
      -- move them, and cannot pretend the paper is older or newer than it is.
      new.consenso_raccolto_il := old.consenso_raccolto_il;
      new.consenso_raccolto_da := old.consenso_raccolto_da;
    end if;
  else
    new.consenso_raccolto_il := null;
    new.consenso_raccolto_da := null;
    new.consenso_modalita := null;
    -- Unticking a published activity returns it to BOZZA (§15.12). ONLY
    -- unticking. An activity that never had the tick and is being pushed to
    -- PUBBLICATA must be refused by attivita_pubblicata_con_consenso, not
    -- quietly demoted: §15.12 asks for an explicit refusal, and a silent
    -- correction would leave whoever pressed publish believing it worked.
    if tg_op = 'UPDATE' and old.consenso_raccolto and new.stato = 'PUBBLICATA' then
      new.stato := 'BOZZA';
    end if;
  end if;
  return new;
end
$$;

create trigger attivita_consenso_scritto_dal_sistema
  before insert or update on public.attivita
  for each row execute function public.attivita_consenso_di_sistema();

-- ===========================================================================
-- abilitazioni — §15.3.4
--
-- The real authorisation. The invite code only creates one (rule 23); access
-- rights never live as a column on utenti (rule 20).
-- ===========================================================================
create table public.abilitazioni (
  id           uuid primary key default gen_random_uuid(),
  utente_id    uuid not null references public.utenti (id) on delete cascade,
  edizione_id  uuid not null references public.edizioni (id) on delete restrict,
  attivata_il  timestamptz not null default now(),
  origine      public.origine_abilitazione not null,
  attiva       boolean not null default true,
  revocata_il  timestamptz,
  revocata_da  uuid references public.utenti (id) on delete set null,
  constraint abilitazioni_revoca_coerente check (attiva = (revocata_il is null))
);

-- One per person per edition (agreed 2026-09-12, SPEC §15.3.4). Re-enabling
-- somebody who was revoked switches the existing row back on; it never makes
-- a second one, which would leave two answers to "is this person allowed?".
create unique index abilitazioni_una_per_edizione
  on public.abilitazioni (utente_id, edizione_id);

alter table public.abilitazioni enable row level security;

comment on table public.abilitazioni is
  'SPEC §15.3.4. The authorisation itself; the code only creates it. One row per person per edition.';

-- ===========================================================================
-- codici_invito — §15.3.5
--
-- Only the keyed fingerprint of the code is stored, never the code (rule 23):
-- the same technique and the same secret as the request limit of §6.1, with a
-- different lifetime. Nothing here carries a name or an email address — the
-- pairing between a number and a person lives on the paper of whoever hands
-- out the keys.
-- ===========================================================================
create table public.codici_invito (
  id           uuid primary key default gen_random_uuid(),
  edizione_id  uuid not null references public.edizioni (id) on delete restrict,
  progressivo  integer not null check (progressivo > 0),
  impronta     text not null,
  creato_il    timestamptz not null default now(),
  usato_il     timestamptz,
  -- The person who used the card. Cleared when they close their account: the
  -- row stays so the number stays burnt (§15.12, agreed 2026-09-12).
  utente_id    uuid references public.utenti (id) on delete set null,
  revocato     boolean not null default false
);

-- Unique within the edition, and never reused — not even after a revocation
-- (§15.3.5). The index makes a duplicate impossible; the generator of step 15
-- is what must keep counting upwards past the revoked ones.
create unique index codici_progressivo_unico
  on public.codici_invito (edizione_id, progressivo);
-- A fingerprint identifies one card: the same code cannot exist twice.
create unique index codici_impronta_unica on public.codici_invito (impronta);

alter table public.codici_invito enable row level security;

-- No grant and no policy: like richieste_link, the table is reachable only
-- through the functions of step 15 and the panel that runs as the backend.
revoke all on public.codici_invito from anon, authenticated;

comment on table public.codici_invito is
  'SPEC §15.3.5. Fingerprints only, never a code in clear. progressivo is unique per edition and never reused.';

-- ===========================================================================
-- tentativi_codice — §15.3.6
--
-- The hourly attempt limit of §15.4, keyed by utente_id and NOT by a
-- fingerprint (rule 23): the caller has already signed in, their id is
-- already in the database, and hashing it would protect nothing while making
-- the count unreadable. Small and volatile — the nightly cleanup of §15.11
-- drops rows older than an hour (step 20).
-- ===========================================================================
create table public.tentativi_codice (
  id         uuid primary key default gen_random_uuid(),
  utente_id  uuid not null references public.utenti (id) on delete cascade,
  tentato_il timestamptz not null default now()
);

create index tentativi_codice_utente on public.tentativi_codice (utente_id, tentato_il);

alter table public.tentativi_codice enable row level security;

revoke all on public.tentativi_codice from anon, authenticated;

comment on table public.tentativi_codice is
  'SPEC §15.3.6. Read by the system alone: no grant, no policy. Keyed by utente_id, never by a fingerprint (rule 23).';

-- ---------------------------------------------------------------------------
-- Does the caller hold an active abilitazione for the active edition?
--
-- This is the gate of rule 22. SECURITY DEFINER because policies and views
-- call it and it must not depend on what the caller can read.
-- ---------------------------------------------------------------------------
create function public.ha_abilitazione()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.abilitazioni a
    where a.utente_id = (select auth.uid())
      and a.edizione_id = public.edizione_attiva()
      and a.attiva
  )
$$;

comment on function public.ha_abilitazione() is
  'SPEC §15.3.4, CLAUDE.md rule 22. False outside an active edition, whatever rows exist.';

-- ===========================================================================
-- iscrizioni — §15.3.3
--
-- Same shape as prenotazioni: a seat number assigned by the system and never
-- shown, a unique index that decides a race, and the five stat_ columns
-- copied once at anonymisation (§5.3, rule 19).
--
-- Two states and no more. There is no waiting list, and adding one is not a
-- small change (D22, rule 29).
-- ===========================================================================
create table public.iscrizioni (
  id                 uuid primary key default gen_random_uuid(),
  attivita_id        uuid not null references public.attivita (id) on delete restrict,
  -- NULL once anonymised, exactly as a prenotazione (§5.3). RESTRICT: an
  -- account is never deleted with iscrizioni still attached; the erasure
  -- flow of step 20 anonymises first, without copying stat_*.
  utente_id          uuid references public.utenti (id) on delete restrict,
  stato              public.stato_iscrizione not null default 'ATTIVA',
  -- 1..capienza. Internal, never shown to anybody (§15.3.3).
  posto_progressivo  integer not null check (posto_progressivo >= 1),
  creata_il          timestamptz not null default now(),
  -- Who acted. Normally the person themselves; the amministratore when they
  -- sign somebody up or cancel for them (§15.9). Never shown to the
  -- participant, who sees their own row and its state.
  creata_da          uuid references public.utenti (id) on delete set null,
  annullata_il       timestamptz,
  annullata_da       uuid references public.utenti (id) on delete set null,
  anonimizzata       boolean not null default false,
  stat_eta           public.fascia_eta,
  stat_genere        public.genere,
  stat_professione   text check (char_length(stat_professione) <= 100),
  stat_motivo_visita text check (char_length(stat_motivo_visita) <= 200),
  stat_residenza     public.residenza,

  constraint iscrizioni_anonimizzata_senza_utente
    check (anonimizzata = (utente_id is null)),
  constraint iscrizioni_stat_solo_anonimizzate
    check (
      anonimizzata
      or (stat_eta is null and stat_genere is null and stat_professione is null
          and stat_motivo_visita is null and stat_residenza is null)
    ),
  constraint iscrizioni_annullamento_datato
    check ((stato = 'ANNULLATA') = (annullata_il is not null))
);

-- §15.3.3, the same rule as §8.1: one seat number per activity among ACTIVE
-- iscrizioni. A cancelled one releases its number. This index — not a check
-- in application code — is what makes two people unable to take the last
-- place (rule 5).
create unique index iscrizioni_posto_unico
  on public.iscrizioni (attivita_id, posto_progressivo)
  where stato = 'ATTIVA';

-- §15.3.3: nobody holds two non-cancelled iscrizioni on the same activity.
create unique index iscrizioni_una_per_attivita
  on public.iscrizioni (attivita_id, utente_id)
  where stato = 'ATTIVA';

create index iscrizioni_utente on public.iscrizioni (utente_id);

alter table public.iscrizioni enable row level security;

comment on table public.iscrizioni is
  'SPEC §15.3.3. Seat uniqueness enforced by iscrizioni_posto_unico. Two states only: there is no waiting list (D22).';
comment on column public.iscrizioni.posto_progressivo is
  'Internal. Never shown to users (SPEC §15.3.3).';

-- ---------------------------------------------------------------------------
-- Is the caller enrolled on this activity, right now?
--
-- The hinge of level 2 (§15.8): cancelling takes telephone and exact address
-- away in the same instant, because the views ask this and nothing is copied
-- anywhere.
-- ---------------------------------------------------------------------------
create function public.iscritto_a(p_attivita_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.iscrizioni i
    where i.attivita_id = p_attivita_id
      and i.utente_id = (select auth.uid())
      and i.stato = 'ATTIVA'
  )
$$;

-- ---------------------------------------------------------------------------
-- Until an activity begins: the moment past which one can no longer sign up
-- and no longer cancel (§15.7, and the reading of 2026-09-12 written into
-- §15.7). Italian wall-clock time, like every other date computation (§8.4).
--
-- Since 2026-09-12 a card may be saved without a date or an hour (§15.3.2),
-- so the comparison can come out unknown. Unknown answers false: a moment we
-- cannot place is not a moment we can say is still ahead. The cost is that
-- the holder of an iscrizione on a card whose date was cleared can no longer
-- cancel it themselves — the amministratore still can, which is exactly the
-- power §15.9 gives them for cases a person cannot close alone.
-- ---------------------------------------------------------------------------
create function public.attivita_non_cominciata(p_attivita_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((a.data + a.ora_inizio) > (now() at time zone 'Europe/Rome'), false)
  from public.attivita a
  where a.id = p_attivita_id
$$;

comment on function public.attivita_non_cominciata(uuid) is
  'SPEC §15.7: signing up and cancelling are possible until the activity begins.';

-- ===========================================================================
-- The three windows over `attivita` — §15.8 "Come i tre livelli si impongono
-- nel database", rule 24.
--
-- security_invoker = false, like every other view in this project: they run
-- as their owner, the base table stays closed, and each exposes a fixed list
-- of columns with its own WHERE clause. Supabase's advisor flags such views;
-- accepted and documented here as it is in the base migration.
-- ===========================================================================

-- Level 1, for anybody holding an active abilitazione. Only PUBBLICATA rows
-- of the active edition, and only activities not already past: §15.6 has them
-- disappear the following day. Counts, never names: who is enrolled is a
-- separate matter and arrives with step 17.
create view public.attivita_elenco
with (security_invoker = false)
as
  select a.id,
         a.edizione_id,
         a.titolo,
         a.descrizione,
         a.abitante_nome,
         a.luogo_generico,
         a.data,
         a.ora_inizio,
         a.ora_fine,
         a.capienza,
         a.cosa_portare,
         a.lingua_attivita,
         (select count(*)::integer
            from public.iscrizioni i
           where i.attivita_id = a.id and i.stato = 'ATTIVA') as iscritti,
         greatest(
           a.capienza - (select count(*)::integer
                           from public.iscrizioni i
                          where i.attivita_id = a.id and i.stato = 'ATTIVA'),
           0
         ) as posti_rimasti
  from public.attivita a
  where a.stato = 'PUBBLICATA'
    and a.edizione_id = public.edizione_attiva()
    and a.data >= public.oggi_roma()
    and public.ha_abilitazione();

comment on view public.attivita_elenco is
  'SPEC §15.8 level 1. Abilitated users, published rows of the active edition. No level 2 column appears here.';

-- Levels 1 + 2, only for the rows the caller is enrolled in. Cancelling an
-- iscrizione removes the row from this view in the same instant (§15.8).
--
-- Deliberately NOT gated on ha_abilitazione() nor on the active edition:
-- §15.12 says an iscrizione survives a deactivated edition and a revoked
-- abilitazione, and stays visible to its holder. Holding an ATTIVA
-- iscrizione is proof the person was entitled when they took the place.
create view public.attivita_iscritto
with (security_invoker = false)
as
  select a.id,
         a.edizione_id,
         a.titolo,
         a.descrizione,
         a.abitante_nome,
         a.abitante_cognome,
         a.abitante_telefono,
         a.luogo_generico,
         a.luogo_esatto,
         a.data,
         a.ora_inizio,
         a.ora_fine,
         a.capienza,
         a.cosa_portare,
         a.lingua_attivita,
         a.stato
  from public.attivita a
  where public.iscritto_a(a.id);

comment on view public.attivita_iscritto is
  'SPEC §15.8 levels 1+2. Only rows the caller holds an ATTIVA iscrizione on. Never abitante_note_interne.';

-- Everything, internal notes included. Amministratore only, and in no export
-- (§15.8 level 3).
create view public.attivita_amministrazione
with (security_invoker = false)
as
  select a.*,
         (select count(*)::integer
            from public.iscrizioni i
           where i.attivita_id = a.id and i.stato = 'ATTIVA') as iscritti
  from public.attivita a
  where public.is_amministratore();

comment on view public.attivita_amministrazione is
  'SPEC §15.8 level 3. Amministratore only.';

-- ===========================================================================
-- Grants and policies, table by table.
-- ===========================================================================

-- edizioni -----------------------------------------------------------------
-- A signed-in person needs to know whether the module is open (§15.5); the
-- amministratore sees every edition. Nothing for a visitor: the entry of
-- §15.5 is shown to signed-in users only. Writes arrive with step 15.
grant select on public.edizioni to authenticated;

create policy edizioni_lettura on public.edizioni
  for select to authenticated
  using (id = public.edizione_attiva() or public.is_amministratore());

-- attivita -----------------------------------------------------------------
-- Nothing. The three views are the only doors (rule 24).
grant select on public.attivita_elenco to authenticated;
grant select on public.attivita_iscritto to authenticated;
grant select on public.attivita_amministrazione to authenticated;

-- abilitazioni -------------------------------------------------------------
-- A person may see their own (§15.11); the amministratore sees all. Writes
-- go through the functions of step 15: no insert, update or delete grant.
grant select on public.abilitazioni to authenticated;

create policy abilitazioni_lettura on public.abilitazioni
  for select to authenticated
  using (utente_id = (select auth.uid()) or public.is_amministratore());

-- iscrizioni ---------------------------------------------------------------
-- Column-level: posto_progressivo is never readable by anybody through the
-- table (§15.3.3), the five stat_ columns belong to the statistics engine
-- alone (rule 16), and creata_da / annullata_da are never shown to the
-- participant (§15.3.3) — the panel reads them through its own view at
-- step 18.
grant select (id, attivita_id, utente_id, stato, creata_il, annullata_il, anonimizzata)
  on public.iscrizioni to authenticated;
grant update (stato) on public.iscrizioni to authenticated;

-- Own rows, or every row for the amministratore. A person without an
-- abilitazione has none to begin with: the only way to create one is
-- iscriviti(), which asks for the abilitazione first (rule 22).
create policy iscrizioni_lettura on public.iscrizioni
  for select to authenticated
  using (utente_id = (select auth.uid()) or public.is_amministratore());

-- Cancelling. The holder may cancel their own active iscrizione until the
-- activity begins (§15.7). The amministratore may cancel somebody else's —
-- the one place in this codebase where a person may act on another person's
-- row, and only for iscrizioni, never for prenotazioni (rule 29, §15.9).
-- The tracking of annullata_da and the email are step 18; this is only the
-- permission. Note what the policy does NOT allow: reviving a cancelled row,
-- or any value of stato other than ANNULLATA.
create policy iscrizioni_annullamento on public.iscrizioni
  for update to authenticated
  using (
    stato = 'ATTIVA'
    and (
      (utente_id = (select auth.uid()) and public.attivita_non_cominciata(attivita_id))
      or public.is_amministratore()
    )
  )
  with check (
    stato = 'ANNULLATA'
    and (utente_id = (select auth.uid()) or public.is_amministratore())
  );

-- The `annullata_il` stamp the check constraint requires. A person updates
-- `stato` and nothing else; the time is the system's.
create function public.iscrizione_annullamento_datato()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stato = 'ANNULLATA' and old.stato <> 'ANNULLATA' then
    new.annullata_il := now();
    if new.annullata_da is null then
      new.annullata_da := (select auth.uid());
    end if;
  end if;
  return new;
end
$$;

create trigger iscrizioni_data_annullamento
  before update of stato on public.iscrizioni
  for each row execute function public.iscrizione_annullamento_datato();

-- ---------------------------------------------------------------------------
-- iscriviti — the only write path for a new iscrizione (§15.7).
--
-- Writes to `attivita` and `iscrizioni` go through functions, not through the
-- tables (§15.8). This one mirrors prenota_posto(): it tries seat numbers
-- 1..capienza and lets the unique index decide who wins a race, so N
-- simultaneous sign-ups on capacity M produce exactly min(N, M) and nothing
-- else — there is no waiting list for the rest to fall into (rule 29).
--
-- SECURITY DEFINER because `attivita` is reachable by nobody: every condition
-- the caller must satisfy is checked here, in order.
--
-- Error codes (the panel and the pages of steps 15-18 map these):
--   IS001  posti esauriti          — every seat number is taken
--   IS002  iscrizione duplicata    — the caller already holds an active one
--   IS003  attivita non disponibile — unknown, not published, not in the
--                                    active edition, or published with no
--                                    capienza typed in yet (§15.3.2): a card
--                                    that offers no places offers none to
--                                    anybody, and says so like any other
--                                    unavailable activity
--   IS004  accesso non abilitato   — no active abilitazione (rule 22)
--   IS005  attivita cominciata     — its start time has passed (§15.7)
-- ---------------------------------------------------------------------------
create function public.iscriviti(p_attivita_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente     uuid := (select auth.uid());
  v_capienza   integer;
  v_id         uuid;
  v_n          integer;
  v_constraint text;
begin
  if v_utente is null then
    raise exception 'accesso richiesto' using errcode = '28000';
  end if;

  if not public.ha_abilitazione() then
    raise exception 'accesso non abilitato' using errcode = 'IS004';
  end if;

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
      values (p_attivita_id, v_utente, v_n, v_utente)
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

revoke execute on function public.iscriviti(uuid) from public, anon;
grant execute on function public.iscriviti(uuid) to authenticated, service_role;

comment on function public.iscriviti(uuid) is
  'SPEC §15.7. The only way an iscrizione is created. Capacity decided by iscrizioni_posto_unico, never by a read-then-write check.';

-- ---------------------------------------------------------------------------
-- Helper functions called from policies and views are not for anybody to
-- call directly. edizione_attiva() is the exception: the availability page
-- of step 20 asks it whether to show the entry of §15.5.
-- ---------------------------------------------------------------------------
revoke execute on function public.edizione_unica_attiva() from public, anon, authenticated;
revoke execute on function public.attivita_dentro_edizione() from public, anon, authenticated;
revoke execute on function public.attivita_consenso_di_sistema() from public, anon, authenticated;
revoke execute on function public.iscrizione_annullamento_datato() from public, anon, authenticated;
