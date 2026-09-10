-- Opening hours become comparable times — SPEC §5.2, §6.4.
--
-- Until now a sede carried its hours as free text ('09:00–13:00'). SPEC §6.4
-- allows cancelling "fino all'orario di inizio della fascia", and that limit
-- has to hold in the database (CLAUDE.md rule 2), which cannot compare a
-- sentence with the current time. The two texts are replaced by four real
-- times; the string people read is composed from them, so nothing changes on
-- screen and there is a single truth to keep.
--
-- SPEC §5.2 has been reworded accordingly, together with this migration.

-- sedi_pubbliche selects the two text columns, so it goes first and comes
-- back at the end with the new ones.
drop view public.sedi_pubbliche;

alter table public.sedi
  add column ora_inizio_mattina     time not null default '09:00',
  add column ora_fine_mattina       time not null default '13:00',
  add column ora_inizio_pomeriggio  time not null default '14:00',
  add column ora_fine_pomeriggio    time not null default '18:00',
  drop column orario_mattina,
  drop column orario_pomeriggio,
  add constraint sedi_orario_mattina check (ora_fine_mattina > ora_inizio_mattina),
  add constraint sedi_orario_pomeriggio check (ora_fine_pomeriggio > ora_inizio_pomeriggio);

comment on column public.sedi.ora_inizio_mattina is
  'SPEC §5.2. Also the moment from which a MATTINA booking can no longer be cancelled (§6.4).';
comment on column public.sedi.ora_inizio_pomeriggio is
  'SPEC §5.2. Also the moment from which a POMERIGGIO booking can no longer be cancelled (§6.4).';

-- ---------------------------------------------------------------------------
-- When a fascia begins, for a given sede. One place, used by the cancellation
-- limit of §6.4 and by the views that show the hours.
--
-- SECURITY DEFINER like the other functions over sedi: anon has no direct
-- access to the table, and this answers only about hours, which are public.
-- ---------------------------------------------------------------------------
create function public.ora_inizio(p_sede_id uuid, p_fascia public.fascia)
returns time
language sql
stable
security definer
set search_path = ''
as $$
  select case p_fascia
    when 'MATTINA' then s.ora_inizio_mattina
    else s.ora_inizio_pomeriggio
  end
  from public.sedi s
  where s.id = p_sede_id
$$;

comment on function public.ora_inizio(uuid, public.fascia) is
  'Start of a fascia at a sede. The cancellation deadline of SPEC §6.4.';

-- Same view as before, with the four times in place of the two texts. The
-- page composes '09:00–13:00' from them.
create view public.sedi_pubbliche
with (security_invoker = false)
as
  select s.id, s.nome, s.comune, s.indirizzo, s.coordinate, s.capienza,
         s.ora_inizio_mattina, s.ora_fine_mattina,
         s.ora_inizio_pomeriggio, s.ora_fine_pomeriggio,
         s.giorni_apertura, s.sempre_disponibile
  from public.sedi s
  where s.attiva;

grant select on public.sedi_pubbliche to anon, authenticated;
