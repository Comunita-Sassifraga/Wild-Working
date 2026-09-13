# Prova di passaggio a Cloudflare

Ramo di sola prova, creato da `main` il 13 settembre 2026. **Non va unito a
`main`**: serve a rispondere a una domanda, non a cambiare l'ospite.

Il codice dell'applicazione non è stato toccato. Le uniche modifiche sono
due dipendenze di sviluppo, due comandi nuovi in `package.json`, due file di
configurazione dell'adattatore e due righe in `.gitignore`.

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

## Che cosa resta da fare, se si decidesse di passare davvero

- ~~I due giri notturni.~~ Fatti: sono tre azioni programmate di GitHub, in
  `.github/workflows/`. Restano i passaggi a mano qui sotto.
- Il record DNS va agganciato come *Custom Domain* e resta proxato (nuvoletta
  arancione), al contrario di quanto vale per Vercel.
- La tabella dei fornitori al §9 di `docs/informativa-privacy.md`, dove oggi
  c'è Vercel.

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

Gli orari sono ricopiati identici da `vercel.json`: GitHub li legge in orario
universale esattamente come Vercel, quindi non cambia niente.

I due giri non scaricano il repository, non usano azioni di terzi e ricevono
`permissions: {}`, cioè nessun diritto sul repository: fanno una sola chiamata
verso l'esterno e si fermano. Il segreto passa da una variabile d'ambiente e non
finisce mai sulla riga di comando; se l'indirizzo non comincia per `https`
l'esecuzione si ferma prima di mandarlo. Una risposta diversa da `2xx` fa
diventare rossa l'esecuzione, e GitHub manda l'email. Nel diario finisce solo il
corpo della risposta, che porta conteggi e nient'altro (regola 4).

### I passaggi a mano, che il software non può fare da sé

1. **Creare due segreti** in *Settings → Secrets and variables → Actions →
   New repository secret*:
   - `CRON_SECRET`: la stessa stringa che l'applicazione ha in produzione;
   - `URL_APP`: l'indirizzo pubblico, per esempio
     `https://wildworking.sassifraga.org`, senza barra finale e **solo `https`**.
2. **Portare i tre file sul ramo predefinito.** Un'azione programmata parte
   **soltanto** dalla versione che sta su `main`: finché restano su
   `prova-cloudflare` non partiranno mai da sole, e non comparirà nemmeno il
   pulsante *Run workflow*. Questo ramo non va unito a `main` per intero: vanno
   portati i soli tre file (un *cherry-pick*, oppure ricopiati a mano).
3. **Provare a mano**, una volta arrivati su `main`: *Actions → Promemoria della
   sera prima → Run workflow*. Deve diventare verde e mostrare i conteggi.
4. **Se `main` è protetto**, verificare che `segno-di-vita.yml` possa scrivere:
   una protezione che vieta le scritture diverse dalle richieste di modifica lo
   farà fallire, in rosso, ogni primo del mese.
5. **Quando si pubblica davvero su Cloudflare**, ricordare che su Vercel non
   deve restare acceso lo stesso programma: i due giri non fanno danni se
   chiamati due volte (§6.3, §5.10), ma è rumore inutile.

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
