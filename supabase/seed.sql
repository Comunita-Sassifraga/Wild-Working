-- Development seed — SPEC §11.A (data collected 2026-09-10).
--
-- Local development only: `supabase db reset` loads it after the migrations.
-- Production sedi are created from the admin panel (SPEC §6.7): a sede is a
-- row, never code (CLAUDE.md rule 11).
--
-- Addresses and coordinates are still "ND" in §11.A and stay NULL. Opening
-- hours use the defaults of §5.2 (09:00–13:00 / 14:00–18:00, lun–sab).
-- Fixed ids so local scripts and manual checks can refer to a sede.

insert into public.sedi (id, nome, comune, capienza, sempre_disponibile) values
  ('a1000000-0000-4000-8000-000000000001', 'Ronco Coworking',    'Ronco Canavese', 6, true),
  ('a1000000-0000-4000-8000-000000000002', 'Valprato Coworking', 'Valprato Soana', 4, false),
  ('a1000000-0000-4000-8000-000000000003', 'Valprato Comune',    'Valprato Soana', 8, false),
  ('a1000000-0000-4000-8000-000000000004', 'Ingria Coworking',   'Ingria',         4, false),
  ('a1000000-0000-4000-8000-000000000005', 'Pigna',              'Valprato Soana', 6, false),
  ('a1000000-0000-4000-8000-000000000006', 'Bar Soana',          'Ronco Canavese', 6, false);

-- Placeholder season for the seasonal sedi. The real periods are not known
-- yet (§11.A): an administrator replaces this from the panel.
insert into public.periodi_attivita (sede_id, data_inizio, data_fine, etichetta, ricorre_ogni_anno)
select s.id, date '2026-06-01', date '2026-09-30', 'Stagione estiva (da confermare)', true
from public.sedi s
where not s.sempre_disponibile;
