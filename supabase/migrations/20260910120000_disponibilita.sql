-- Availability — SPEC §5.2, §5.7, §6.2, §12 step 4.
--
-- The five bookability conditions of §5.2 live HERE, in one function
-- (sede_prenotabile), and nowhere else. They govern the availability grid
-- through the view below, the public page (§6.6, step 7) through the same
-- view, and the booking write path (§6.3, step 5) when prenota_posto starts
-- calling this function. The database is the enforcement layer (CLAUDE.md
-- rule 2, SPEC §8.3), so a second copy of the rules in TypeScript would be a
-- second answer waiting to disagree with this one.
--
-- Everything a visitor reads about availability is a COUNT: no name, no
-- identifier and no personal datum leaves the database through these views
-- (rule 8, rule 16). Names live only in presenze_pubbliche, used by the
-- "Chi c'è in Valle" page.

-- ---------------------------------------------------------------------------
-- Weekday of a date, as the giorno_settimana enum — §5.2 condition 5.
-- The enum is declared LUN..DOM, which is exactly ISO day-of-week 1..7, so
-- the mapping is a lookup rather than a second list to keep in step.
-- ---------------------------------------------------------------------------
create function public.giorno_di(p_data date)
returns public.giorno_settimana
language sql
immutable
set search_path = ''
as $$
  select (enum_range(null::public.giorno_settimana))[extract(isodow from p_data)::integer]
$$;

-- ---------------------------------------------------------------------------
-- Recurring periods (§5.7): with ricorre_ogni_anno only day and month count.
-- Encoded as month * 100 + day so the comparison is a single integer one.
-- A period that wraps the new year (1 dicembre – 31 marzo) has inizio > fine
-- in this encoding, which is why the second branch exists.
-- ---------------------------------------------------------------------------
create function public.giorno_mese(p_data date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(month from p_data)::integer * 100 + extract(day from p_data)::integer
$$;

create function public.dentro_giorno_mese(p_data date, p_inizio date, p_fine date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when public.giorno_mese(p_inizio) <= public.giorno_mese(p_fine)
      then public.giorno_mese(p_data)
             between public.giorno_mese(p_inizio) and public.giorno_mese(p_fine)
    else public.giorno_mese(p_data) >= public.giorno_mese(p_inizio)
      or public.giorno_mese(p_data) <= public.giorno_mese(p_fine)
  end
$$;

-- ---------------------------------------------------------------------------
-- §5.2 condition 2: the date falls inside at least one periodo_attivita.
-- Overlapping periods are a union, not an intersection (§5.7): EXISTS gives
-- that for free.
--
-- SECURITY DEFINER, like sede_attiva: anon has no direct access to sedi, and
-- these functions answer only about data that is public anyway (whether a
-- sede is open on a day). search_path is emptied so the body cannot be
-- redirected to another schema.
-- ---------------------------------------------------------------------------
create function public.in_periodo_attivita(p_sede_id uuid, p_data date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.periodi_attivita p
    where p.sede_id = p_sede_id
      and case
        when p.ricorre_ogni_anno
          then public.dentro_giorno_mese(p_data, p.data_inizio, p.data_fine)
        else p_data between p.data_inizio and p.data_fine
      end
  )
$$;

-- ---------------------------------------------------------------------------
-- §5.2 condition 3, per fascia. A chiusura with fascia NULL covers every
-- fascia of the day (§5.4 "tutte"); a chiusura with a fascia closes that
-- fascia only, and leaves the other one bookable.
-- ---------------------------------------------------------------------------
create function public.in_chiusura(p_sede_id uuid, p_data date, p_fascia public.fascia)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chiusure c
    where c.sede_id = p_sede_id
      and p_data between c.data_inizio and c.data_fine
      and (c.fascia is null or c.fascia = p_fascia)
  )
$$;

-- ---------------------------------------------------------------------------
-- Condition 2 on its own, including the sempre_disponibile shortcut. The
-- grid needs it apart from the others: a sede out of season is not merely
-- unbookable, it leaves the grid entirely and is listed under it (§6.2).
-- ---------------------------------------------------------------------------
create function public.sede_in_stagione(p_sede_id uuid, p_data date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sedi s
    where s.id = p_sede_id
      and (s.sempre_disponibile or public.in_periodo_attivita(s.id, p_data))
  )
$$;

-- ---------------------------------------------------------------------------
-- The five conditions of SPEC §5.2, in one place.
--
--   1. attiva
--   2. sempre_disponibile, or inside a periodo_attivita
--   3. date + fascia not inside a chiusura
--   4. date inside the bookable window
--   5. weekday among the sede's giorni_apertura
--
-- This is the function CLAUDE.md calls isSedeBookable. It is written in SQL
-- because it must also hold on the write path, where application code cannot
-- be trusted to have run.
-- ---------------------------------------------------------------------------
create function public.sede_prenotabile(p_sede_id uuid, p_data date, p_fascia public.fascia)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sedi s
    where s.id = p_sede_id
      and s.attiva
      and public.sede_in_stagione(s.id, p_data)
      and not public.in_chiusura(s.id, p_data, p_fascia)
      and p_data between public.oggi_roma() and public.fine_finestra()
      and public.giorno_di(p_data) = any (s.giorni_apertura)
  )
$$;

comment on function public.sede_prenotabile(uuid, date, public.fascia) is
  'The five bookability conditions of SPEC §5.2. Single source of truth: the availability view, the public page and prenota_posto all go through this.';

-- ---------------------------------------------------------------------------
-- occupazione_pubblica gains the count of people who made their presence
-- public (§6.2). The grid shows that NUMBER and never the names: the names
-- are in presenze_pubbliche, which only the "Chi c'è in Valle" page reads
-- (rule 8). The existing columns keep their name, type and order.
--
-- The join to utenti is a LEFT join: an anonymised booking has no user, and
-- must still be counted among `prenotati`.
-- ---------------------------------------------------------------------------
create or replace view public.occupazione_pubblica
with (security_invoker = false)
as
  select p.sede_id, p.data, p.fascia,
         count(*)::integer as prenotati,
         count(*) filter (
           where u.mostra_nome_pubblico and u.nome_pubblico is not null
         )::integer as pubbliche
  from public.prenotazioni p
  join public.sedi s on s.id = p.sede_id
  left join public.utenti u on u.id = p.utente_id
  where p.stato = 'ATTIVA'
    and s.attiva
    and p.data between public.oggi_roma() and public.fine_finestra()
  group by p.sede_id, p.data, p.fascia;

-- ---------------------------------------------------------------------------
-- The availability grid, in one view — SPEC §6.2.
--
-- One row per active sede, per day of the window, per fascia: about 180 rows
-- with the sedi of §11.A. The page asks once and receives counts.
--
-- The window is the one of §10, read from the database functions, so the
-- grid, the public page and the booking check cannot drift apart.
-- ---------------------------------------------------------------------------
create view public.disponibilita_pubblica
with (security_invoker = false)
as
  select
    s.id as sede_id,
    g.data::date as data,
    f.fascia,
    s.capienza,
    coalesce(o.prenotati, 0)::integer as prenotati,
    greatest(s.capienza - coalesce(o.prenotati, 0), 0)::integer as liberi,
    coalesce(o.pubbliche, 0)::integer as pubbliche,
    public.sede_in_stagione(s.id, g.data::date) as in_stagione,
    public.sede_prenotabile(s.id, g.data::date, f.fascia) as prenotabile
  from public.sedi s
  cross join generate_series(
    public.oggi_roma()::timestamp,
    public.fine_finestra()::timestamp,
    interval '1 day'
  ) as g(data)
  cross join unnest(enum_range(null::public.fascia)) as f(fascia)
  left join public.occupazione_pubblica o
    on o.sede_id = s.id and o.data = g.data::date and o.fascia = f.fascia
  where s.attiva;

comment on view public.disponibilita_pubblica is
  'SPEC §6.2. Counts only — never a name, an email or an identifier.';

-- ---------------------------------------------------------------------------
-- Next reopening of a seasonal sede — SPEC §6.2, "con l'etichetta del
-- prossimo periodo e la data di riapertura, se nota".
--
-- One row per sede: the earliest period that has yet to start. For a
-- recurring period the year is ignored, so the date is the next anniversary
-- of its start. A sede with no future opening has no row: "se nota".
-- ---------------------------------------------------------------------------
create view public.aperture_future
with (security_invoker = false)
as
  select distinct on (s.id)
    s.id as sede_id,
    p.etichetta,
    a.data_apertura
  from public.sedi s
  join public.periodi_attivita p on p.sede_id = s.id
  cross join lateral (
    select case
      when p.ricorre_ogni_anno then
        (select min(d)
         from (values
           (make_date(extract(year from public.oggi_roma())::integer,
                      extract(month from p.data_inizio)::integer,
                      extract(day from p.data_inizio)::integer)),
           (make_date(extract(year from public.oggi_roma())::integer + 1,
                      extract(month from p.data_inizio)::integer,
                      extract(day from p.data_inizio)::integer))
         ) as anniversari(d)
         where d >= public.oggi_roma())
      else p.data_inizio
    end as data_apertura
  ) as a
  where s.attiva
    and not s.sempre_disponibile
    and a.data_apertura >= public.oggi_roma()
  order by s.id, a.data_apertura;

comment on view public.aperture_future is
  'SPEC §6.2. Next opening of a seasonal sede, for the list under the grid.';

-- ---------------------------------------------------------------------------
-- Grants. Both views are readable without signing in: the availability view
-- is public (§6.2, §12 step 4). They expose no personal datum.
-- ---------------------------------------------------------------------------
grant select on public.disponibilita_pubblica to anon, authenticated;
grant select on public.aperture_future to anon, authenticated;
