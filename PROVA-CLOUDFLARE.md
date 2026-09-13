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
programmate, e i documenti che nominavano l'ospite precedente.

## Come farlo girare

C'è un passaggio a mano da fare **dopo** `npm install`, e senza di lui la
compilazione si ferma subito.

```bash
npm install
# L'adattatore importa esbuild ma non lo dichiara fra le proprie dipendenze:
# conta sul fatto che npm lo porti alla radice di node_modules. Qui npm non
# può farlo, perché vitest 5 (attraverso vite 8) dichiara un esbuild diverso
# e incompatibile. Va quindi messo a mano.
cp -r node_modules/@opennextjs/aws/node_modules/esbuild node_modules/esbuild
mkdir -p node_modules/@esbuild
cp -r node_modules/@opennextjs/aws/node_modules/@esbuild/win32-x64 node_modules/@esbuild/win32-x64
```

Su Linux o macOS l'ultima riga cambia nome di cartella: `linux-x64`,
`darwin-arm64` e così via.

Non si risolve con `npm install esbuild`: npm rifiuta per il conflitto, e
forzarlo con `--legacy-peer-deps` toglie `vite` da `node_modules` e rompe
tutte le prove automatiche.

Poi:

```bash
npm run cloudflare:build     # compila per il Worker
npm run cloudflare:preview   # avvia il Worker in locale, su 127.0.0.1:8787
```

Serve lo stack Supabase locale acceso (`npx supabase start`).

## Che cosa resta da fare

- **La tabella dei fornitori al §9 di `docs/informativa-privacy.md`**, dove
  oggi c'è ancora Vercel. Va sostituito con Cloudflare, che è un responsabile
  del trattamento a tutti gli effetti: termina il TLS e vede indirizzi IP,
  cookie di sessione e contenuto delle richieste. **GitHub non va aggiunto a
  quella tabella**: non riceve nessun dato personale, solo conteggi (§14.5).
  Resta anche da sciogliere il *[DA VERIFICARE]* sulla regione, che per
  Cloudflare è una domanda diversa da quella che era per Vercel.
- **Il record DNS** va agganciato come *Custom Domain* del Worker e **resta
  proxato** (nuvoletta arancione), al contrario di quanto valeva prima.
- **La misura del Worker.** Il piano gratuito si ferma a 3 MB compressi e il
  13/09/2026 eravamo a 2 967 KiB senza «Prenota un abitante». Va rimisurata
  prima di ogni pubblicazione.
- ~~I due giri notturni.~~ Fatti: tre azioni programmate di GitHub, in
  `.github/workflows/`. Restano i passaggi a mano descritti qui sotto.

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
| `.github/workflows/promemoria.yml` | `0 16 * * *` | chiama `/api/mestieri/promemoria` |
| `.github/workflows/pulizie.yml` | `0 1 * * *` | chiama `/api/mestieri/pulizie` |
| `.github/workflows/segno-di-vita.yml` | il 1º di ogni mese | scrive una data, per non farsi spegnere |

Gli orari sono quelli di prima, ricopiati senza toccarli: erano già scritti in
orario universale e GitHub li legge allo stesso modo, quindi il momento in cui
i due giri partono non cambia (§10).

I due giri non scaricano il repository, non usano azioni di terzi e ricevono
`permissions: {}`, cioè nessun diritto sul repository: fanno una sola chiamata
verso l'esterno e si fermano. Il segreto passa da una variabile d'ambiente e non
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
minuti. Per il promemoria è tollerabile e per le pulizie pure. Una notte saltata
si comporta in due modi diversi, ed è voluto: le **pulizie** recuperano da sole
alla ripartenza (§5.10, §7), un **promemoria** mancato resta mancato (§6.3,
§8.4) — meglio perso che doppio.
