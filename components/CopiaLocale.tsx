"use client";

import { useEffect, useState } from "react";
import { MINUTI_COPIA_VECCHIA } from "@/config/limits";
import { conValori, m } from "@/lib/messaggi";

/**
 * The two halves of the local copy of SPEC §8.4 — §12 step 13.
 *
 * These are the only two pieces of this app that run inside the browser
 * rather than on the server, and they are the only two that need to: one
 * hands the browser the file that keeps the copy, the other reads a clock
 * the server does not have. Every other page still works with JavaScript
 * switched off, and so does this one — without JavaScript there is simply
 * no copy and no notice.
 */

const MILLISECONDI_AL_MINUTO = 60_000;

/**
 * Hands public/sw.js to the browser.
 *
 * Only in a real build: a browser holding a copy of the pages while the
 * development server is rewriting them on every save would show yesterday's
 * work and look like a bug. And only where the browser allows it at all —
 * an address that is not https, or localhost, is refused outright, which is
 * why the copy cannot be tried from the phone over the local network.
 */
export function RegistraCopiaLocale() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // Nothing to do if it fails, and nothing to write down either (rule 4):
    // without the copy the app simply needs a connection, as it always did.
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

type Stato = "attuale" | "vecchia" | "senzaCollegamento";

/**
 * Asks public/sw.js whether this very page came out of its copy.
 *
 * It is the one answer that is never a guess. It can be missing — no copy
 * yet, or a worker the browser put to sleep and restarted — and then the
 * question simply returns no and the clock decides.
 */
async function servitaDallaCopia(): Promise<boolean> {
  const copia = navigator.serviceWorker?.controller;
  if (!copia) return false;
  return new Promise((risolvi) => {
    const canale = new MessageChannel();
    const rinuncia = setTimeout(() => risolvi(false), ATTESA_RISPOSTA);
    canale.port1.onmessage = (messaggio) => {
      clearTimeout(rinuncia);
      risolvi(Boolean(messaggio.data?.dallaCopia));
    };
    copia.postMessage({ domanda: "copia", indirizzo: window.location.href }, [canale.port2]);
  });
}

/** Milliseconds waited for that answer before deciding without it. */
const ATTESA_RISPOSTA = 500;

/**
 * "Questa è la disponibilità scaricata il…" — the notice §8.4 asks for.
 *
 * The server writes into the page the instant it produced it; here that is
 * compared with the clock of whoever is reading. A page that has just
 * arrived from the server is seconds old; one the browser took out of its
 * own copy is hours or days old. So the notice needs no way of knowing
 * where the page came from: the distance says it.
 *
 * Two situations, two sentences, both true. Without a connection nothing
 * can be refreshed and the date of the download is what matters. With a
 * connection and a page left open too long, what matters is that reloading
 * it costs one tap.
 */
export function AvvisoCopiaLocale({ generatoIl, quando }: { generatoIl: string; quando: string }) {
  const [stato, setStato] = useState<Stato>("attuale");

  useEffect(() => {
    let vivo = true;
    const valuta = async () => {
      // `onLine` is only trusted when it says no: a phone connected to a
      // wi-fi that leads nowhere still says yes. The copy itself is asked
      // first, because it knows instead of guessing.
      const copia = (await servitaDallaCopia()) || navigator.onLine === false;
      if (!vivo) return;
      if (copia) return setStato("senzaCollegamento");
      const eta = Date.now() - Date.parse(generatoIl);
      setStato(eta >= MINUTI_COPIA_VECCHIA * MILLISECONDI_AL_MINUTO ? "vecchia" : "attuale");
    };
    void valuta();
    const ogniMinuto = setInterval(() => void valuta(), MILLISECONDI_AL_MINUTO);
    const ascolta = () => void valuta();
    window.addEventListener("online", ascolta);
    window.addEventListener("offline", ascolta);
    return () => {
      vivo = false;
      clearInterval(ogniMinuto);
      window.removeEventListener("online", ascolta);
      window.removeEventListener("offline", ascolta);
    };
  }, [generatoIl]);

  if (stato === "attuale") return null;
  const t = m.copiaLocale;

  return (
    <p role="status" className="mb-8 border-b border-linea pb-4 text-avviso">
      {conValori(stato === "senzaCollegamento" ? t.senzaCollegamento : t.vecchia, { quando })}{" "}
      {stato === "vecchia" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-tocco items-center text-verde-testo underline"
        >
          {t.aggiorna}
        </button>
      )}
    </p>
  );
}
