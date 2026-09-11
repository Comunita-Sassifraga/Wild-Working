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
npm run dev               # http://127.0.0.1:3000
```

Apri l'app su `127.0.0.1`, non su `localhost`: i link nelle email di accesso
puntano lì e il cookie di sessione vale per quell'indirizzo. Le email in
locale non partono: finiscono in Mailpit, <http://127.0.0.1:54324>.

Copia `.env.local.example` in `.env.local` e riempilo con i valori di
`npx supabase status -o env`. `CHIAVE_IMPRONTE_ACCESSO` è una stringa lunga
a piacere, inventata: non va presa da Supabase. Il file è ignorato da git.

Su Windows, se PowerShell rifiuta `npm` ("L'esecuzione di script è
disabilitata"), usa `npm.cmd` al posto di `npm`, oppure abilita una volta gli
script locali con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
I comandi vanno lanciati dalla cartella del progetto.

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
app/                  Next.js (App Router): layout, pagine, CSS di base
app/font.ts           Inclusive Sans, ospitato in app/fonts/ (mai da Google)
components/           intestazione, piè di pagina, classi dei controlli
config/limits.ts      parametri di SPEC §10 — unica fonte di verità
config/tokens.ts      identità visiva di SPEC §13 — unica fonte di verità
tailwind.config.ts    tema Tailwind generato da config/tokens.ts
public/logo.png       logo ufficiale, in attesa della versione SVG (SPEC §13.10)
public/icona-*.png    icone per la schermata Home, provvisorie: le rifà
                      strumenti/genera-icone.mjs partendo dal logo
public/sw.js          la copia locale: cosa resta leggibile senza collegamento
app/manifest.ts       come l'app si presenta al telefono che la installa
lib/auth/             accesso via link email (SPEC §6.1): richiesta, verifica,
                      uscita, limite delle richieste, cookie di sessione
lib/dates.ts          "oggi" e finestra prenotabile, sempre in Europe/Rome
lib/db/               accesso al database, tipizzato. Nessuna chiamata Supabase altrove
lib/env.ts            variabili d'ambiente lette dal server
lib/messaggi.ts       lettura tipizzata di messages/it.json
messages/it.json      tutti i testi letti dagli utenti
proxy.ts              rinfresca il cookie di sessione a ogni richiesta
supabase/migrations/  schema, vincoli, politiche di accesso (RLS) e viste
supabase/templates/   email di accesso, in italiano
supabase/seed.sql     sedi di SPEC §11.A, solo per lo sviluppo locale
tests/                test richiesti da CLAUDE.md
```

## Accesso via link email (SPEC §6.1)

- Nessun codice Supabase gira nel browser: le chiavi restano sul server e le
  variabili d'ambiente non hanno il prefisso `NEXT_PUBLIC_`.
- Un solo cookie, di sessione, non leggibile dagli script. Dura
  `DURATA_SESSIONE_GIORNI` dall'ultimo utilizzo.
- Il profilo in `utenti` nasce quando il link viene **aperto**, non quando
  viene richiesto. Un indirizzo che non apre mai il link resta un residuo in
  Supabase Auth senza profilo: lo rimuove la pulizia notturna del passo 11.
- Il limite di richieste (`MAX_LINK_PER_EMAIL_ORA`, `MAX_LINK_PER_RETE_ORA`)
  vive nella tabella `richieste_link`, che conserva solo impronte calcolate
  con `CHIAVE_IMPRONTE_ACCESSO` e cancellate dopo un'ora. Nessun indirizzo,
  di posta o di rete, viene scritto nel database.
- In locale le email arrivano a Mailpit: <http://127.0.0.1:54324>.
- **Per la produzione**, da fare una volta prima del rilascio: impostare
  `site_url = "https://prenota.sassifraga.org"` e il mittente SMTP di Resend
  (`noreply@coworking.sassifraga.org`, SPEC §14.2) nel progetto Supabase, poi
  `supabase config push` per caricare durata del link e modelli email. Le
  modifiche a `config.toml` in locale richiedono `supabase stop` e
  `supabase start`, non basta `db reset`.
- I link vengono verificati con un'apertura diretta. Alcuni sistemi di posta
  aziendali aprono i link in anticipo per controllarli e consumerebbero il
  link al posto della persona: se dovesse capitare, si aggiunge una pagina
  intermedia con un pulsante "Entra".

## Installazione sul telefono e lettura senza collegamento (SPEC §12 passo 13)

- La copia locale (`public/sw.js`) **non parte in `npm run dev`**: il browser
  la accetta solo su `https://…` o su `localhost`, e in sviluppo terrebbe da
  parte pagine che stai ancora cambiando. Per provarla:

  ```bash
  npm run build
  npm start            # poi apri http://localhost:3000
  ```

  Chrome propone di installare l'app dalla barra degli indirizzi; a server
  spento, ricaricando, la disponibilità resta con l'avviso di §8.4 e ogni
  altra pagina risponde con `/senza-collegamento`.
- Dal telefono sulla rete locale (`http://192.168.…`) l'installazione e la
  copia **non funzionano**: non è un indirizzo sicuro. Si provano una volta
  pubblicata l'app.
- Le icone si rifanno con `node strumenti/genera-icone.mjs` dopo aver
  sostituito `public/logo.png`. Servono `sharp`, che arriva con Next.
- Cambiando `public/sw.js` va alzato `VERSIONE` in cima al file: è così che
  le copie vecchie vengono buttate.

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
