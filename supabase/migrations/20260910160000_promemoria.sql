-- Automatic email — SPEC §6.3, §6.5, §12 step 9.
--
-- Step 9 sends three messages and this migration prepares the database for
-- two of them:
--
--   * the reminder of the evening before (§6.3, decision of 2026-09-10:
--     no confirmation at booking time, a reminder instead);
--   * the moderation notice of §6.5 level 2, which must go out exactly when
--     the text of a public name really changes — so imposta_nome_pubblico()
--     now says whether it did.
--
-- The third, the notice to a person whose name has been cleared, needs
-- nothing here: azzera_nome_pubblico() already does the whole action, and the
-- address is read by the job client alone.

-- ---------------------------------------------------------------------------
-- When the reminder for a booking went out.
--
-- The column is the memory of the job and nothing else: it is left out of the
-- column-level grants of *_politiche_accesso.sql, so no user and no visitor
-- can read it, and out of every view. NULL means "not sent yet".
-- ---------------------------------------------------------------------------
alter table public.prenotazioni add column promemoria_inviato_il timestamptz;

comment on column public.prenotazioni.promemoria_inviato_il is
  'SPEC §6.3. Set by promemoria_da_inviare() when the reminder is taken in charge. Job only: never granted, never in a view.';

-- Only the rows still to be reminded are ever looked up, and only for one day.
create index prenotazioni_promemoria_da_fare
  on public.prenotazioni (data)
  where stato = 'ATTIVA' and promemoria_inviato_il is null;

-- ---------------------------------------------------------------------------
-- promemoria_da_inviare — takes tomorrow's bookings in charge and returns
-- what the message has to say.
--
-- Claiming and reading are one statement on purpose. The UPDATE marks the
-- rows and hands them back; a second run, or two overlapping runs, find
-- nothing left to claim and send nothing. It is the same discipline as §8.1:
-- what must not happen twice is prevented by the database, not by a check in
-- application code (rule 5). The cost of the choice is stated in the spec: a
-- row is marked before the provider confirms, so a failed send is a reminder
-- lost, never a reminder sent twice.
--
-- SECURITY INVOKER, so `current_user` is the role that called: the guard and
-- the EXECUTE grant below say the same thing twice, and a future grant by
-- mistake would still not open the function to a signed-in person.
--
-- p_giorno exists for the tests. In production the job passes nothing and the
-- day is always tomorrow, in Europe/Rome like every other date (§8.4).
--
-- What it deliberately does NOT check: whether the sede is still bookable.
-- A chiusura entered after the booking does not cancel it (rule 6, §8.2), so
-- the reminder for it still goes out — the booking is real until a person
-- acts on it.
-- ---------------------------------------------------------------------------
create function public.promemoria_da_inviare(p_giorno date default null)
returns table (
  prenotazione_id uuid,
  utente_id       uuid,
  email           text,
  data            date,
  fascia          public.fascia,
  sede_nome       text,
  comune          text,
  indirizzo       text,
  note            text,
  ora_inizio      time,
  ora_fine        time
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_giorno date := coalesce(p_giorno, public.oggi_roma() + 1);
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  return query
  with prese as (
    update public.prenotazioni p
       set promemoria_inviato_il = now()
     where p.data = v_giorno
       and p.stato = 'ATTIVA'
       and not p.anonimizzata
       and p.promemoria_inviato_il is null
    returning p.id, p.utente_id, p.sede_id, p.data, p.fascia
  )
  select x.id,
         x.utente_id,
         u.email,
         x.data,
         x.fascia,
         s.nome,
         s.comune,
         s.indirizzo,
         s.note,
         public.ora_inizio(s.id, x.fascia),
         case x.fascia
           when 'MATTINA' then s.ora_fine_mattina
           else s.ora_fine_pomeriggio
         end
    from prese x
    join public.utenti u on u.id = x.utente_id
    join public.sedi s on s.id = x.sede_id
   order by x.utente_id, x.data, x.fascia;
end
$$;

comment on function public.promemoria_da_inviare(date) is
  'SPEC §6.3. Claims tomorrow''s active bookings and returns them once. Backend job only.';

revoke all on function public.promemoria_da_inviare(date) from public, anon, authenticated;
grant execute on function public.promemoria_da_inviare(date) to service_role;

-- ---------------------------------------------------------------------------
-- imposta_nome_pubblico now reports whether the text of the name changed.
--
-- §6.5: "Conta come modifica soltanto un salvataggio che cambia il testo del
-- nome — cioè esattamente ciò che fa partire un'email." The database already
-- knew it, to charge the daily limit; until step 9 there was nobody to tell.
-- Re-saving the same name, or flipping the visibility switch, still sends
-- nothing.
--
-- The body is unchanged except for that column: dropped and recreated because
-- the return type gains a field.
-- ---------------------------------------------------------------------------
drop function public.imposta_nome_pubblico(text, boolean, integer);

create function public.imposta_nome_pubblico(
  p_nome       text,
  p_mostra     boolean,
  p_max_cambi  integer
)
returns table (nome_pubblico text, mostra_nome_pubblico boolean, cambiato boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente   uuid := (select auth.uid());
  v_nome     text := nullif(btrim(p_nome), '');
  v_prima    text;
  v_cambi    integer;
  v_esiste   boolean;
  v_cambiato boolean;
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

  v_cambiato := v_nome is distinct from v_prima;

  if v_cambiato then
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
    select u.nome_pubblico, u.mostra_nome_pubblico, v_cambiato
      from public.utenti u
     where u.id = v_utente;
end
$$;

revoke all on function public.imposta_nome_pubblico(text, boolean, integer) from public;
grant execute on function public.imposta_nome_pubblico(text, boolean, integer) to authenticated;
