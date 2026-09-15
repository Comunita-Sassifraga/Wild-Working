"use client";

import { useActionState } from "react";
import { bottonePrimario, bottoneSecondario, campo } from "@/components/controlli";
import { conValori, m } from "@/lib/messaggi";
import { aiuto, etichetta, titoloSezione } from "../parti";
import { generaCodiciAzione } from "./azioni";
import { MAX_CARTONCINI, NESSUNA_GENERAZIONE, type EsitoGenerazione } from "./costanti";

/**
 * Generating the cards, and the sheet that prints them — SPEC §15.3.5, §15.9.
 *
 * This is a client component for one reason: the codes cannot survive a
 * redirect. Only their fingerprints are stored (rule 23), so what the
 * database holds cannot be turned back into a code by anybody, ourselves
 * included. They exist in this response and nowhere else — which is why the
 * form returns them in place instead of sending the browser to an address
 * carrying them.
 *
 * The warning above the sheet says exactly that, because it is the one thing
 * whoever is printing has to know before closing the tab.
 *
 * `window.print()` is the whole of the printing: the sheet is laid out with
 * the same tokens as every other screen, and the rule in globals.css takes
 * the header, the footer and the rest of this page off the paper.
 */

const t = m.amministrazione.codici;

function Cartoncino({ progressivo, codice }: { progressivo: number; codice: string }) {
  return (
    <li className="flex flex-col items-center justify-center gap-2 border border-linea px-4 py-8">
      <span className="text-titolo-sezione font-grassetto">{codice}</span>
      <span className="text-nota text-testo-secondario">
        {conValori(t.riga, { numero: progressivo })}
      </span>
    </li>
  );
}

export function Generatore() {
  const [esito, azione, inCorso] = useActionState<EsitoGenerazione, FormData>(
    generaCodiciAzione,
    NESSUNA_GENERAZIONE,
  );

  const errori: Record<string, string> = m.amministrazione.errori;
  const messaggioErrore = esito.errore
    ? conValori(errori[esito.errore] ?? errori.ERRORE, { massimo: MAX_CARTONCINI })
    : undefined;

  return (
    <>
      <section className="mt-10 border-t border-linea pt-6 print:hidden">
        <h2 className={titoloSezione}>{t.genera.titolo}</h2>
        <form action={azione}>
          <p className="mt-6">
            <label htmlFor="quanti" className={etichetta}>
              {t.genera.quanti}
            </label>
            <input
              id="quanti"
              name="quanti"
              type="number"
              min={1}
              max={MAX_CARTONCINI}
              defaultValue={1}
              aria-describedby="quanti-nota"
              className={campo}
            />
            <span id="quanti-nota" className={`${aiuto} block`}>
              {t.genera.quantiNota}
            </span>
          </p>
          {messaggioErrore && (
            <p role="alert" className="mt-6 text-errore">
              {messaggioErrore}
            </p>
          )}
          <p className="mt-6">
            <button type="submit" className={bottonePrimario} disabled={inCorso}>
              {t.genera.pulsante}
            </button>
          </p>
        </form>
      </section>

      {esito.cartoncini.length > 0 && (
        <section className="mt-10">
          {/* The section's hairline lives inside the part that does not
              print: on paper it would come out as a rule across the top of
              the sheet of cards. */}
          <div className="border-t border-linea pt-6 print:hidden">
            <h2 className={titoloSezione}>{t.stampa.titolo}</h2>
            <p role="alert" className="mt-4 text-avviso">
              {t.stampa.avviso}
            </p>
            <p className={aiuto}>{t.stampa.annota}</p>
            <p className="mt-6">
              <button type="button" onClick={() => window.print()} className={bottoneSecondario}>
                {t.stampa.pulsante}
              </button>
            </p>
          </div>

          {/* `data-stampa` is what globals.css looks for: on paper, this
              block and nothing else. */}
          <ul data-stampa className="mt-6 grid grid-cols-2 gap-4">
            {esito.cartoncini.map((c) => (
              <Cartoncino key={c.progressivo} progressivo={c.progressivo} codice={c.codice} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
