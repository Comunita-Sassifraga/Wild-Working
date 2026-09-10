# prenota.sassifraga.org

Sistema di prenotazione delle postazioni di coworking della Valle Soana,
realizzato da Comunità Sassifraga APS. La specifica è in `docs/SPEC.md`;
le regole per chi lavora sul codice sono in `CLAUDE.md`.

## Requisiti

- Node.js 24, npm
- Docker Desktop (per Supabase locale)
- Supabase CLI (`npx supabase` funziona senza installazione globale)

## Avvio

```bash
npm install
npx supabase start        # avvia Postgres, Auth e API in locale
npm run db:reset          # applica le migration e i dati di partenza
npm run dev               # http://localhost:3000
```

Copia `.env.local.example` in `.env.local` e riempilo con i valori di
`npx supabase status -o env`. Il file è ignorato da git.

## Comandi

```bash
npm run typecheck    # tsc --noEmit — deve passare prima di ogni commit
npm run lint
npm run test         # tutti i test (richiede Supabase locale avviato)
npm run test:rls     # solo i test sulle politiche di accesso — prima di ogni commit
npm run db:reset     # ricrea il database locale da migration + seed
npm run db:types     # rigenera lib/db/types.ts dopo una migration
```

## Struttura

```
app/                  Next.js (App Router). Nessuna schermata finché i token
                      visivi non sono collegati a Tailwind (SPEC §12, passo 3)
config/limits.ts      parametri di SPEC §10 — unica fonte di verità
config/tokens.ts      identità visiva di SPEC §13 — unica fonte di verità
lib/dates.ts          "oggi" e finestra prenotabile, sempre in Europe/Rome
lib/db/               accesso al database, tipizzato. Nessuna chiamata Supabase altrove
messages/it.json      tutti i testi letti dagli utenti
supabase/migrations/  schema, vincoli, politiche di accesso (RLS) e viste
supabase/seed.sql     sedi di SPEC §11.A, solo per lo sviluppo locale
tests/                test richiesti da CLAUDE.md
```

## Note per chi modifica il database

- Ogni tabella nasce **chiusa**: nessun permesso a `anon` e `authenticated`
  finché una migration non lo concede esplicitamente, e RLS è sempre attiva.
- Le viste `sedi_pubbliche`, `occupazione_pubblica`, `presenze_pubbliche`,
  `prenotazioni_referente` e `utenti_amministrazione` girano con i permessi
  del proprietario (`security_invoker = false`) di proposito: sono le uniche
  porte verso i dati altrui, e ognuna espone un elenco fisso di colonne.
  Il pannello Supabase le segnala come avviso: è voluto.
- `FINESTRA_GIORNI` ha una copia nel database (`finestra_giorni()`). Un test
  verifica che coincida con `config/limits.ts`: cambiarli insieme.
- Docker deve essere nel `PATH` per `supabase db reset` e per i test. Su
  Windows, se non lo è, imposta `DOCKER_BIN_DIR` oppure aggiungi
  `C:\Program Files\Docker\Docker\resources\bin` al PATH.
