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

- I due giri notturni. Su Cloudflare i Cron Triggers chiamano un Worker, non
  un indirizzo qualsiasi: `vercel.json` non ha un equivalente diretto.
- Il record DNS va agganciato come *Custom Domain* e resta proxato (nuvoletta
  arancione), al contrario di quanto vale per Vercel.
- La tabella dei fornitori al §9 di `docs/informativa-privacy.md`, dove oggi
  c'è Vercel.
