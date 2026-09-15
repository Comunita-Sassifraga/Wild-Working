# Il passaggio a Cloudflare

Ramo creato da `main` il 13 settembre 2026 per rispondere a una domanda — se
l'applicazione potesse girare su Cloudflare senza essere modificata — e
diventato il passaggio vero e proprio quando la strada Vercel si è chiusa.

**La ragione è l'art. 28 del GDPR, non la tecnica.** Il DPA di Vercel copre
soltanto i piani Pro ed Enterprise e l'account dell'associazione è sul piano
gratuito; quello di Cloudflare copre anche gli account gratuiti. Una condizione
per non profit era stata chiesta a Vercel il 13/09/2026. Vedi SPEC D25 e §14.5.

**Quando questo ramo arriva su `main`, Vercel non è più un'alternativa:**
l'ospite è Cloudflare e la programmazione dei giri notturni è su GitHub. Il
ramo si unisce solo a quella condizione — finché la risposta di Vercel non è
arrivata o non è negativa, resta qui.

Il codice dell'applicazione non è stato toccato. Le uniche modifiche sono due
dipendenze di sviluppo, due comandi nuovi in `package.json`, due file di
configurazione dell'adattatore, due righe in `.gitignore`, le tre azioni
programmate, uno strumento che alleggerisce il programma compilato — e che
non fa parte dell'applicazione — e i documenti che nominavano l'ospite
precedente.

## Come farlo girare

```bash
npm install
npm run cloudflare:build     # compila per il Worker, e lo alleggerisce
npm run cloudflare:preview   # avvia il Worker in locale, su 127.0.0.1:8787
```

Serve lo stack Supabase locale acceso (`npx supabase start`).

Non serve nient'altro. Fino al 15/09/2026 qui c'era un passaggio a mano, ed
è utile sapere perché non c'è più.

**L'adattatore importa `esbuild` ma non lo dichiara**, né fra le proprie
dipendenze né fra le peer: conta sul fatto che npm lo porti da solo alla
radice di `node_modules`, dove `@opennextjs/aws` ne tiene una copia. Qui npm
non può farlo, perché altri due pacchetti ne dichiarano uno diverso, e con
tre pretendenti li annida tutti: `import "esbuild"` non trova più niente e la
compilazione muore con `ERR_MODULE_NOT_FOUND` subito dopo un `npm install`
pulito.

La soluzione è **dichiararlo noi**, ed è in `package.json` fra le dipendenze
di sviluppo. La versione è la `^0.28`, che sembra la scelta sbagliata — la
copia di `@opennextjs/aws` è la `0.25.4` — ed è invece l'unica possibile:
`vite 8`, da cui dipendono tutte le prove automatiche, dichiara
`esbuild@^0.27.0 || ^0.28.0`, e una 0.25 alla radice gliela porta via. Con la
0.28 sono contenti tutti e npm non protesta. Verificato il 15/09/2026: la
compilazione riesce, il programma pesa uguale al millesimo, e le prove
automatiche passano tutte.

Da non fare: `npm install esbuild@0.25.4`, che npm rifiuta; e soprattutto
`--legacy-peer-deps`, che toglie `vite` da `node_modules` e rompe tutte le
prove. Il giorno in cui l'adattatore dichiarerà `esbuild` per conto proprio,
questa riga di `package.json` si può togliere.

## Che cosa resta da fare

- ~~La tabella dei fornitori al §9 di `docs/informativa-privacy.md`.~~ Fatta
  con la fusione del 15/09/2026: la riga nomina Cloudflare, responsabile del
  trattamento a tutti gli effetti — termina il TLS e vede indirizzi IP, cookie
  di sessione e contenuto delle richieste. **GitHub non è stato aggiunto a
  quella tabella**, ed è la scelta giusta: non riceve nessun dato personale,
  solo conteggi (§14.5). **Resta aperto il *[DA VERIFICARE]* sulla regione**,
  che per Cloudflare è una domanda diversa da quella che era per Vercel: lì si
  sceglieva la regione di una funzione, qui il programma gira nel punto di rete
  più vicino a chi si collega mentre la banca dati resta a Francoforte. Va
  sciolto prima del rilascio, non prima di una pubblicazione di prova.
- **Il record DNS** va agganciato come *Custom Domain* del Worker e **resta
  proxato** (nuvoletta arancione), al contrario di quanto valeva prima.
- **Segnalare a monte la dimenticanza di `@vercel/og`**, così che
  `strumenti/alleggerisci-worker.mjs` possa sparire. Vedi qui sotto.
- ~~I due giri notturni.~~ Fatti: tre azioni programmate di GitHub, in
  `.github/workflows/`. Restano i passaggi a mano descritti qui sotto.
- ~~La misura del Worker.~~ Rientrata: **2 175 KiB** contro un tetto di 3 MB,
  col modulo di §15 dentro, spiegata qui sotto. Va comunque **rifatta prima di
  ogni pubblicazione**, con `npm run cloudflare:build` seguito da
  `npx wrangler deploy --dry-run`.

## La misura del Worker

Il piano gratuito non accetta un Worker più grande di **3 MB compressi**, e
non è chiaro se Cloudflare conti 3 072 KiB o 3 000. La prima misura, il
13/09/2026, era **2 967 KiB** — dentro nel primo caso, fuori nel secondo, e
comunque senza «Prenota un abitante».

Due interventi, nessuno dei quali tocca una riga dell'applicazione, l'hanno
portata a **1 920 KiB**, con oltre 1 150 liberi. Poi è arrivato il modulo:

| | KiB compressi |
|---|---|
| prima | 2 967 |
| `"minify": true` in `wrangler.jsonc` | 2 608 |
| più `@vercel/og` rimossa | 1 920 |
| col modulo «Prenota un abitante», 15/09/2026 | **2 175** |

Le immagini non c'entrano: logo, icone e caratteri sono *assets*, che
Cloudflare carica a parte e non conta sul tetto.

**Il modulo è costato 255 KiB**, e la previsione scritta qui il 13/09 — «qualche
decina» — era ottimistica di un fattore cinque. Il ragionamento che c'era sotto
regge però ancora, ed è quello che conta la prossima volta: il codice nostro è
una frazione del totale, l'85% abbondante è Next.js e React, e infatti una
ventina di schermate nuove hanno spostato l'ago di un ottavo. Restano quasi
900 KiB liberi.

### Perché `@vercel/og` va tolta, e non è per il peso

`@vercel/og` è il generatore delle immagini di anteprima che i social
mostrano per un collegamento. **Non è una dipendenza nostra e non ha niente a
che vedere con l'ospite che abbiamo lasciato**: è una libreria che Next si
porta dentro, sotto `next/dist/compiled/@vercel/`, accanto ad altre due con
lo stesso prefisso. Il nome trae in inganno, la cosa no.

Nessuna pagina di questa applicazione genera immagini. Ma dentro quella
libreria c'è **codice che chiama `https://fonts.googleapis.com`**, più sei
riferimenti a `cdn.jsdelivr.net`. È irraggiungibile — nulla costruisce mai un
`ImageResponse`, quindi non viene mai eseguito, e nessun dato è mai partito
verso nessuno — ma CLAUDE.md tiene il carattere ospitato da noi e l'app
libera da terze parti proprio perché l'indirizzo di un visitatore non arrivi
a Google, e una chiamata dormiente a Google Fonts dentro il Worker non è una
cosa che questo progetto debba trovarsi a spiegare. I 731 KiB compressi che
se ne vanno con lei sono il beneficio secondario, non il motivo.

Non va nell'informativa privacy: dopo la rimozione non c'è niente da
dichiarare. Deciso il 13/09/2026.

### È una dimenticanza dell'adattatore, da segnalare

I manutentori di `@opennextjs/cloudflare` hanno scritto **questa identica
correzione nella versione 1.19.4**, per la nostra stessa ragione — il tetto
dei 3 MB — sostituendo la libreria con un guscio che lancia un errore quando
l'applicazione non la usa. La applicano però solo quando compilano la metà
del programma che serve le pagine. La metà che compila `proxy.ts`, quella che
l'adattatore stesso annuncia a ogni compilazione come sperimentale e non
mantenuta ufficialmente, è rimasta scoperta.

Va aperta una segnalazione su
`github.com/opennextjs/opennextjs-cloudflare`, indicando che
`bundle-node-middleware.js` non ha l'`alias` verso `shims/throw.js` che
`bundle-server.js` ha già. **Quando la correzione arriva,
`strumenti/alleggerisci-worker.mjs` si cancella**: alla compilazione
successiva dirà da solo «libreria già assente, niente da fare».

### Perché Turbopack e non webpack

Il vecchio costruttore di Next darebbe un programma di **1 420 KiB**, altri
500 in meno, perché non duplica i pezzi condivisi come fa Turbopack — e per
di più la dimenticanza qui sopra non lo riguarda. È stato comunque scartato
il 13/09/2026, per due ragioni che contano più dei megabyte:

- `--webpack` è dichiarato da Next una via d'uscita temporanea, e **Next 17
  potrebbe toglierlo del tutto**: vorrebbe dire un aggiornamento futuro, in
  una data che non decidiamo noi, in cui l'applicazione non si compila più;
- `npm run dev` usa Turbopack. Costruire per la pubblicazione con webpack
  vorrebbe dire **due costruttori diversi fra la prova in locale e il sito
  vero**, senza nessun ambiente intermedio dove accorgersi della differenza.

Il margine che abbiamo non vale quei due rischi.

## I due giri notturni, fatti partire da GitHub

Su Cloudflare i Cron Triggers chiamano un Worker, non un indirizzo qualsiasi, e
il programma generato dall'adattatore espone soltanto la gestione delle
richieste web: `vercel.json` non ha un equivalente diretto. Scrivere un file
d'ingresso proprio che avvolga il programma generato è stato scartato dal
direttivo il 13 settembre 2026. I due giri partono quindi da GitHub, che c'è già
e non aggiunge un fornitore.

Tre file, ognuno con un compito solo:

| File | Quando | Che cosa fa |
|---|---|---|
| `.github/workflows/promemoria.yml` | `26 16 * * *` | chiama `/api/mestieri/promemoria` |
| `.github/workflows/pulizie.yml` | `41 1 * * *` | chiama `/api/mestieri/pulizie` |
| `.github/workflows/segno-di-vita.yml` | il 1º di ogni mese | scrive una data, per non farsi spegnere |

Gli orari sono quelli di prima, spostati di poco: erano già scritti in orario
universale e GitHub li legge allo stesso modo, ma le azioni programmate partono
in ritardo quando GitHub è carico, e i momenti peggiori sono gli inizi d'ora —
dove per di più si accalca quasi ogni programmazione scritta a mano. I due giri
stanno quindi a metà ora, 26 e 41 minuti più tardi di prima, su minuti che
nessuno sceglie per abitudine. Restano dentro l'ora di scarto che §10 dichiara
come intenzione (§10).

I due giri non scaricano il repository, non usano azioni di terzi e ricevono
`permissions: {}`, cioè nessun diritto sul repository: fanno una sola chiamata
verso l'esterno e si fermano. Il solo a usare un componente altrui è il segno di
vita, che ha bisogno di una copia del repository per scriverci la data: usa
quello ufficiale di GitHub, agganciato al numero esatto della versione e non
all'etichetta `v5`, che il suo proprietario potrebbe spostare. Il segreto passa da una variabile d'ambiente e non
finisce mai sulla riga di comando; se l'indirizzo non comincia per `https`
l'esecuzione si ferma prima di mandarlo. Una risposta diversa da `2xx` fa
diventare rossa l'esecuzione, e GitHub manda l'email. Nel diario finisce solo il
corpo della risposta, che porta conteggi e nient'altro (regola 4).

### I passaggi a mano, che il software non può fare da sé

**L'ordine conta**, perché appena i file arrivano su `main` le azioni cominciano
a partire da sole al primo orario utile, che l'applicazione sia pubblicata o no.

1. **Pubblicare l'applicazione su Cloudflare**, così che esista un indirizzo
   pubblico definitivo da mettere nel segreto del passo 2.
2. **Creare due segreti** in *Settings → Secrets and variables → Actions →
   New repository secret*. **Non serve aspettare il merge**: i segreti sono del
   repository, non di un ramo, e vanno anzi messi prima, perché se mancano al
   primo orario utile l'esecuzione diventa rossa (si ferma da sola, senza
   chiamare niente e senza mandare il segreto).
   - `CRON_SECRET`: la stessa stringa che l'applicazione ha in produzione;
   - `URL_APP`: l'indirizzo pubblico, per esempio
     `https://wildworking.sassifraga.org`, senza barra finale e **solo `https`**.
3. **Unire il ramo in `main`.** Un'azione programmata parte **soltanto** dalla
   versione che sta sul ramo predefinito: finché i file restano qui non
   partiranno mai da sole, e non comparirà nemmeno il pulsante *Run workflow*.
4. **Provare a mano**, solo dopo il merge: *Actions → Promemoria della sera
   prima → Run workflow*. Deve diventare verde e mostrare i conteggi.
5. **Se `main` è protetto**, verificare che `segno-di-vita.yml` possa scrivere:
   una protezione che vieta le scritture diverse dalle richieste di modifica lo
   farà fallire, in rosso, ogni primo del mese.

### Quello che non si può verificare da qui

La programmazione non può scattare da un ramo diverso da `main`: in questa
sessione si è potuto controllare che i file siano validi e che i due indirizzi
rispondano come devono, non vederli partire da soli. Non è un guasto.

### I ritardi, e che cosa comportano

Le azioni programmate di GitHub partono spesso in ritardo, anche di parecchi
minuti — ed è il motivo per cui gli orari stanno lontani dagli inizi d'ora. Per il promemoria è tollerabile e per le pulizie pure. Una notte saltata
si comporta in due modi diversi, ed è voluto: le **pulizie** recuperano da sole
alla ripartenza (§5.10, §7), un **promemoria** mancato resta mancato (§6.3,
§8.4) — meglio perso che doppio.
