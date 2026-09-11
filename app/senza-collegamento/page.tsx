import type { Metadata } from "next";
import Link from "next/link";
import { bottonePrimario } from "@/components/controlli";
import { m } from "@/lib/messaggi";

/**
 * The courtesy page — SPEC §8.4 "Prenotare richiede connessione", §12 step 13.
 *
 * public/sw.js keeps a copy of this page and answers with it, while there
 * is no connection, for every address it does not keep: booking, "Le mie
 * prenotazioni", the settings, "Chi c'è in Valle", the panel. Without it a
 * person would meet the browser's own error page, which talks about servers
 * and DNS and blames the app for being broken.
 *
 * It says what to do next and nothing about what went wrong inside (§13.9):
 * no "offline", no "cache", no "connessione al server".
 */

export const metadata: Metadata = { title: m.senzaCollegamento.titolo };

export default function SenzaCollegamento() {
  const t = m.senzaCollegamento;
  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {t.titolo}
      </h1>
      <p className="mt-6">{t.testo}</p>
      <p className="mt-4">{t.residuo}</p>
      <p className="mt-8">
        <Link href="/" className={bottonePrimario}>
          {t.torna}
        </Link>
      </p>
    </>
  );
}
