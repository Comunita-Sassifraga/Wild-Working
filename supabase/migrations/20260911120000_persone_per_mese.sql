-- Persone distinte per mese — SPEC §6.8, §7, §12 step 11.
--
-- §6.8 chiede fra le statistiche "persone distinte che hanno usato gli spazi
-- in un mese (conteggio, senza elenco)". Quel numero è calcolabile solo
-- finché le prenotazioni portano ancora un utente_id: dopo il giro notturno
-- di §5.3 non c'è più modo di sapere se dieci prenotazioni di marzo fossero
-- di dieci persone o di una venuta dieci volte. Va quindi calcolato adesso —
-- nel momento esatto in cui il legame viene reciso — o non lo sarà mai più.
--
-- Il problema vero è che "distinte" non si somma un pezzo per volta. Per
-- sapere se incrementare il contatore quando si recide una prenotazione di
-- marzo bisognerebbe ricordarsi se quella persona è già stata contata per
-- marzo — e ricordarselo vuol dire tenere da qualche parte una riga "questa
-- persona era qui a marzo", cioè esattamente il dato personale che
-- l'anonimizzazione esiste per distruggere.
--
-- LA REGOLA ADOTTATA: una persona viene contata per un mese nell'istante in
-- cui viene recisa **l'ultima sua prenotazione attiva ancora collegata** di
-- quel mese. In quell'istante tutte le altre sue prenotazioni di quel mese
-- sono già anonime, quindi contarla lì la conta una volta sola. Chi è "in
-- uscita" e chi "resta" si legge dalle prenotazioni stesse: non nasce mai,
-- da nessuna parte e nemmeno per un istante, una riga che dica che una certa
-- persona era in un certo mese.
--
-- Conseguenza da tenere presente al passo 12: il numero di un mese diventa
-- definitivo solo dopo che l'ultimo giorno di quel mese ha passato i 30
-- giorni. Il motore delle statistiche unisce le due fonti come già fa per i
-- dati demografici (§6.8): lo storico da qui, gli ultimi 30 giorni dalle
-- prenotazioni ancora collegate.
--
-- Cosa vuol dire "aver usato gli spazi": avere una prenotazione ATTIVA, non
-- annullata. Il sistema non sa chi si sia davvero presentato — §6.8 mette il
-- tasso di mancata presentazione fra le cose che arriveranno con il check-in
-- di §9.

-- ---------------------------------------------------------------------------
-- La tabella dei conteggi.
--
-- Due livelli, e sono due numeri diversi che non si ricavano l'uno
-- dall'altro: `sede_id` valorizzato conta le persone distinte di quella sede
-- in quel mese, `sede_id` vuoto le conta su tutta la valle. Chi in un mese ha
-- usato due sedi compare in entrambe le righe di sede ma una volta sola nel
-- totale, quindi la somma delle sedi è più alta del totale. Sommare le righe
-- di sede per ottenere il totale sarebbe un errore.
--
-- Nessuna riga corrisponde a una persona (regola 15): qui ci sono un mese,
-- una sede e un numero. Un mese in cui è venuta una persona sola riporta 1,
-- senza soppressioni né arrotondamenti, come §6.8 impone.
--
-- RLS accesa e nessuna politica: la tabella è del mestiere automatico. È il
-- passo 12 ad aprirla all'amministratore, insieme alle altre statistiche.
--
-- La chiave con NULLS NOT DISTINCT fa sì che la riga del totale — quella con
-- sede_id vuoto — sia unica per mese come tutte le altre.
--
-- ON DELETE CASCADE e non RESTRICT: in esercizio una sede con prenotazioni
-- non si può cancellare (prenotazioni.sede_id è RESTRICT) e una sede con
-- conteggi ha per forza avuto prenotazioni, quindi il seguito non scatta mai
-- davvero. Se però una sede sparisse, un conteggio orfano non saprebbe più
-- dire di quale sede parla, e un numero che non si sa leggere è peggio di un
-- numero che non c'è.
-- ---------------------------------------------------------------------------
create table public.persone_per_mese (
  id       uuid primary key default gen_random_uuid(),
  -- Primo giorno del mese a cui il conteggio si riferisce.
  mese     date not null,
  -- Vuoto = tutte le sedi insieme.
  sede_id  uuid references public.sedi (id) on delete cascade,
  persone  integer not null default 0 check (persone >= 0),

  constraint persone_per_mese_unica unique nulls not distinct (mese, sede_id)
);

alter table public.persone_per_mese enable row level security;

comment on table public.persone_per_mese is
  'SPEC §6.8. Persone distinte per mese, per sede e in totale. Solo conteggi: nessuna riga corrisponde a una persona (regola 15).';
comment on column public.persone_per_mese.sede_id is
  'Vuoto = tutte le sedi. La somma delle righe di sede è più alta del totale: chi usa due sedi conta in entrambe.';

-- ---------------------------------------------------------------------------
-- conta_persone_in_uscita — il conteggio, nell'unico istante in cui si può.
--
-- Va chiamata PRIMA di recidere i legami, e descrive ciò che sta per essere
-- reciso in uno dei due modi possibili:
--
--   * p_soglia valorizzata e p_utente_id vuoto — il giro notturno: escono
--     tutte le prenotazioni più vecchie della soglia;
--   * p_utente_id valorizzato — la chiusura di un account: escono tutte le
--     prenotazioni ancora collegate a quella persona, qualunque sia la data.
--
-- In entrambi i casi "restano" sono le prenotazioni attive ancora collegate
-- che NON stanno uscendo, e una persona viene contata per un mese solo se di
-- quel mese non le resta più niente. Le prenotazioni annullate non entrano né
-- fra quelle che escono né fra quelle che restano: quella presenza non c'è
-- stata, e non deve nemmeno trattenere il conteggio di un'altra.
--
-- Chiamarla due volte sulla stessa uscita conterebbe due volte. È chiamata da
-- due posti soli, entrambi qui sotto, e sempre una volta.
-- ---------------------------------------------------------------------------
create function public.conta_persone_in_uscita(
  p_soglia     date default null,
  p_utente_id  uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  with in_uscita as (
    select p.utente_id,
           date_trunc('month', p.data)::date as mese,
           p.sede_id
      from public.prenotazioni p
     where not p.anonimizzata
       and p.stato = 'ATTIVA'
       and case
             when p_utente_id is not null then p.utente_id = p_utente_id
             else p.data < p_soglia
           end
  ),
  restano as (
    select p.utente_id,
           date_trunc('month', p.data)::date as mese,
           p.sede_id
      from public.prenotazioni p
     where not p.anonimizzata
       and p.stato = 'ATTIVA'
       and not case
                 when p_utente_id is not null then p.utente_id = p_utente_id
                 else p.data < p_soglia
               end
  ),
  -- Per sede: si conta chi di quella sede, in quel mese, non ha più niente.
  per_sede as (
    select u.mese, u.sede_id, count(distinct u.utente_id) as persone
      from in_uscita u
     where not exists (
             select 1 from restano r
              where r.utente_id = u.utente_id
                and r.mese = u.mese
                and r.sede_id = u.sede_id
           )
     group by u.mese, u.sede_id
  ),
  -- In totale: si conta chi di quel mese non ha più niente da nessuna parte.
  in_totale as (
    select u.mese, null::uuid as sede_id, count(distinct u.utente_id) as persone
      from in_uscita u
     where not exists (
             select 1 from restano r
              where r.utente_id = u.utente_id
                and r.mese = u.mese
           )
     group by u.mese
  )
  insert into public.persone_per_mese as ppm (mese, sede_id, persone)
  select mese, sede_id, persone from per_sede
  union all
  select mese, sede_id, persone from in_totale
  on conflict on constraint persone_per_mese_unica
  do update set persone = ppm.persone + excluded.persone;
$$;

comment on function public.conta_persone_in_uscita(date, uuid) is
  'SPEC §6.8. Conta le persone distinte dei mesi che si chiudono, subito prima che il legame venga reciso. Chiamata una volta per uscita.';

revoke all on function public.conta_persone_in_uscita(date, uuid) from public, anon, authenticated;
grant execute on function public.conta_persone_in_uscita(date, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Il giro notturno conta prima di recidere.
--
-- Unica differenza rispetto alla versione del passo 11: la chiamata in testa.
-- Il corpo dell'UPDATE è identico, e la soglia è la stessa espressione usata
-- dall'UPDATE, così le due non possono divergere.
-- ---------------------------------------------------------------------------
create or replace function public.anonimizza_prenotazioni(p_giorni integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_soglia date;
  v_n      integer;
begin
  if current_user <> 'service_role' then
    raise exception 'riservata ai mestieri automatici' using errcode = '42501';
  end if;

  v_soglia := public.oggi_roma() - p_giorni;

  -- §6.8: il conteggio si può fare solo finché il legame c'è ancora.
  perform public.conta_persone_in_uscita(p_soglia => v_soglia);

  update public.prenotazioni p
     set utente_id = null,
         anonimizzata = true,
         stat_eta = u.eta,
         stat_genere = u.genere,
         stat_professione = u.professione,
         stat_motivo_visita = u.motivo_visita,
         stat_residenza = u.residenza
    from public.utenti u
   where u.id = p.utente_id
     and not p.anonimizzata
     and p.data < v_soglia;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- ---------------------------------------------------------------------------
-- La chiusura di un account conta i mesi che porta via con sé.
--
-- Quando un account si chiude — per richiesta della persona (art. 17) o
-- perché dormiente — tutte le sue prenotazioni vengono anonimizzate in blocco
-- fuori dal giro notturno. Senza questa chiamata quei mesi perderebbero una
-- persona per sempre.
--
-- Va dopo il passo 1 e non prima: le prenotazioni future vengono annullate lì,
-- e una prenotazione annullata non è una presenza. Quelle la cui fascia è già
-- cominciata restano attive e contano, com'è giusto (§8.4).
--
-- Il resto della funzione è identico alla versione del passo 11.
-- ---------------------------------------------------------------------------
create or replace function public.esegui_cancellazione(
  p_utente_id  uuid,
  p_copia_stat boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Free the seats that can still be freed (§6.4, §8.4).
  update public.prenotazioni p
     set stato = 'ANNULLATA'
   where p.utente_id = p_utente_id
     and p.stato = 'ATTIVA'
     and public.annullabile(p.sede_id, p.data, p.fascia);

  -- 2. §6.8: the months this account takes away with it, counted while the
  --    link is still there. After step 1, so a cancelled future booking does
  --    not count as a presence.
  perform public.conta_persone_in_uscita(p_utente_id => p_utente_id);

  -- 3. Only for a closing the person did not ask for: the snapshot of §5.3,
  --    taken here because step 4 is about to empty the fields it reads. An
  --    absent or revoked consent leaves all five NULL, so this copies
  --    nothing — exactly the test the consent register itself uses (§5.5).
  if p_copia_stat then
    update public.prenotazioni p
       set utente_id = null,
           anonimizzata = true,
           stat_eta = u.eta,
           stat_genere = u.genere,
           stat_professione = u.professione,
           stat_motivo_visita = u.motivo_visita,
           stat_residenza = u.residenza
      from public.utenti u
     where u.id = p.utente_id
       and p.utente_id = p_utente_id;
  end if;

  -- 4. Revoke what was consented, through the state itself (§5.5).
  update public.utenti u
     set nome_pubblico = null,
         mostra_nome_pubblico = false,
         eta = null,
         genere = null,
         professione = null,
         motivo_visita = null,
         residenza = null
   where u.id = p_utente_id;

  -- 5. Cut every link still standing, copying nothing (§5.3, rule 19).
  --    On an art. 17 erasure this is every booking of the person; after
  --    step 3 there is nothing left to do.
  update public.prenotazioni p
     set utente_id = null,
         anonimizzata = true
   where p.utente_id = p_utente_id;

  -- 6. The daily name-change counter has no foreign key to follow.
  delete from public.cambi_nome c where c.utente_id = p_utente_id;

  -- 7. When this account ended, for the retention of §7. Written before the
  --    account goes, so the two cannot come apart.
  insert into public.account_chiusi (utente_id)
  values (p_utente_id)
  on conflict (utente_id) do nothing;

  -- 8. The account itself. Cascades to utenti, and from there to incarichi
  --    and moderazioni.
  delete from auth.users a where a.id = p_utente_id;
end
$$;
