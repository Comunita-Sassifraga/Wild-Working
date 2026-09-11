/**
 * The local copy — SPEC §8.4 "Sede senza connessione", §12 step 13.
 *
 * The browser keeps this file to one side and runs it between the page and
 * the network. It exists for one situation: someone standing in front of a
 * sede in valle, with no signal, who needs to read the availability they
 * already downloaded. Booking still takes a connection, and says so.
 *
 * What is kept, and nothing else:
 *
 *  - the availability page (`/`, with or without the `?data=` of §6.2);
 *  - the courtesy page that answers every other address while there is no
 *    connection;
 *  - the files those two are drawn with — stylesheets, font, logo, icons.
 *
 * What is never kept, deliberately:
 *
 *  - "Chi c'è in Valle". §6.5 promises that switching the public name off
 *    removes it immediately from every booking; a copy sitting on somebody
 *    else's phone would keep it alive for days, out of everyone's reach.
 *  - anything of a person's own — bookings, settings, the sign-in pages, the
 *    link the email carries, the panel, the nightly jobs. A phone is not a
 *    place this app controls (CLAUDE.md rule 4).
 *
 * Pages are asked of the network first and only fall back to the copy: as
 * long as there is a connection, what is on screen is what the server says.
 * The copy is therefore always behind by definition, and the page itself
 * announces it (components/CopiaLocale.tsx).
 *
 * Plain JavaScript, served as a static file: a service worker is loaded by
 * the browser, not by the app, so it cannot import from the rest of the
 * code. `tests/installabilita.test.ts` runs this file and asks it, address
 * by address, what it would keep.
 */

// Bump this on any change here: the old copies are dropped on activation.
const VERSIONE = "1";
const COPIA_PAGINE = `pagine-${VERSIONE}`;
const COPIA_RISORSE = `risorse-${VERSIONE}`;

/** The availability page of §6.2, and the only thing `start_url` opens. */
const DISPONIBILITA = "/";

/** Shown in place of every page that needs a connection. */
const SENZA_COLLEGAMENTO = "/senza-collegamento";

/** The only two pages that may be stored. Every other one is asked of the network. */
const PAGINE = [DISPONIBILITA, SENZA_COLLEGAMENTO];

/**
 * Files with no personal data in them and a name that changes whenever
 * their content does, so an old copy can never be the wrong one.
 *
 * `/_next/image` is where the header logo comes from: the address carries
 * the hashed name of the file inside it, so it changes with the picture
 * exactly like the others. Without it the header would lose its logo the
 * moment the connection goes, which is the one thing that makes the page
 * look broken rather than merely old.
 */
const RISORSE = ["/_next/static/", "/_next/image", "/icona-", "/logo.png"];

/**
 * What, if anything, this address may be kept as.
 *
 * `navigazione` is true for a request the browser makes to show a page —
 * never for the calls the app makes on its own, which are left alone and
 * simply fail while there is no connection.
 */
function daConservare(indirizzo, navigazione) {
  let url;
  try {
    url = new URL(indirizzo, self.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== self.location.origin) return null;
  if (navigazione) return PAGINE.includes(url.pathname) ? "pagina" : null;
  return RISORSE.some((inizio) => url.pathname.startsWith(inizio)) ? "risorsa" : null;
}

/**
 * Stored under the address alone, ignoring the headers the response varies
 * by: Next varies its pages on headers its own router sends, and a copy
 * that only matched an identical set of headers would never be found again.
 */
const CONFRONTO = { ignoreVary: true };

/** Always the full address: `/` put away and `/` looked up must be one key. */
function chiave(indirizzo) {
  return new URL(indirizzo, self.location.origin).toString();
}

async function conserva(nomeCopia, indirizzo, risposta) {
  const copia = await caches.open(nomeCopia);
  await copia.put(chiave(indirizzo), risposta);
}

async function daCopia(nomeCopia, indirizzo) {
  const copia = await caches.open(nomeCopia);
  return copia.match(chiave(indirizzo), CONFRONTO);
}

/**
 * The addresses last answered out of the copy rather than by the server.
 *
 * The page asks, on opening, whether it is looking at a copy: that is what
 * decides the notice of §8.4, and no clock can answer it as surely. The
 * browser may put this worker to sleep and forget the set — the page then
 * falls back to comparing the hour it was produced with the hour it is now
 * (components/CopiaLocale.tsx), which is right in every case but a copy
 * only minutes old.
 */
const DALLA_COPIA = new Set();

/** Network first, then the copy: online, what is on screen is always the server's. */
async function rispondiPagina(richiesta) {
  const tipo = daConservare(richiesta.url, true);
  try {
    const risposta = await fetch(richiesta);
    if (tipo === "pagina" && risposta.ok) {
      await conserva(COPIA_PAGINE, richiesta.url, risposta.clone());
      DALLA_COPIA.delete(chiave(richiesta.url));
    }
    return risposta;
  } catch {
    if (tipo === "pagina") {
      const conservata = await daCopia(COPIA_PAGINE, richiesta.url);
      if (conservata) {
        DALLA_COPIA.add(chiave(richiesta.url));
        return conservata;
      }
      // A day of §6.2 that was never downloaded: send the browser to the
      // default view rather than draw it under its own address. An address
      // bar that said one day while the page showed another would be
      // telling a lie, and a link shared from there would carry it along.
      const indirizzo = new URL(richiesta.url);
      if (indirizzo.pathname === DISPONIBILITA && indirizzo.search) {
        return Response.redirect(chiave(DISPONIBILITA), 302);
      }
    }
    const cortesia = await daCopia(COPIA_PAGINE, SENZA_COLLEGAMENTO);
    return cortesia ?? Response.error();
  }
}

/** The copy first: these files are named after their content and never change. */
async function rispondiRisorsa(richiesta) {
  const conservata = await daCopia(COPIA_RISORSE, richiesta.url);
  if (conservata) return conservata;
  const risposta = await fetch(richiesta);
  if (risposta.ok) await conserva(COPIA_RISORSE, richiesta.url, risposta.clone());
  return risposta;
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      // One at a time and forgiving: a page that cannot be fetched now — the
      // very first visit happening on a bad line — must not leave the browser
      // without a service worker at all.
      for (const pagina of PAGINE) {
        try {
          const risposta = await fetch(pagina, { cache: "no-store" });
          if (risposta.ok) await conserva(COPIA_PAGINE, pagina, risposta);
        } catch {
          // Nothing to do: the next visit with a connection stores it.
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome !== COPIA_PAGINE && nome !== COPIA_RISORSE) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (evento) => {
  const domanda = evento.data;
  if (!domanda || domanda.domanda !== "copia") return;
  const porta = evento.ports && evento.ports[0];
  if (!porta) return;
  porta.postMessage({ dallaCopia: DALLA_COPIA.has(chiave(domanda.indirizzo)) });
});

self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  // Only reading. Everything that writes — booking, cancelling, saving a
  // name — goes to the network untouched and fails when there is none.
  if (richiesta.method !== "GET") return;
  if (richiesta.mode === "navigate") {
    evento.respondWith(rispondiPagina(richiesta));
    return;
  }
  if (daConservare(richiesta.url, false) === "risorsa") {
    evento.respondWith(rispondiRisorsa(richiesta));
  }
});
