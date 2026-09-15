import type { ReactNode } from "react";
import { campo } from "@/components/controlli";

/**
 * The pieces every screen of the panel is built from — SPEC §13.
 *
 * The panel is an operational surface, so it is Stile 1 throughout: cream
 * background, hairline rules, no cards and no green blocks (§13.2). Nothing
 * here carries a literal value: only token classes (rule 12).
 */

export const titoloPagina = "text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande";
export const titoloSezione = "text-titolo-sezione font-grassetto";
export const titoloVoce = "text-nota text-testo-secondario";
export const aiuto = "mt-2 text-nota text-testo-secondario";
export const etichetta = "mb-2 block";
export const introduzione = "mt-6 italic";

/** A block of the page, separated by whitespace and one hairline rule (§13.5). */
export function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section className="mt-10 border-t border-linea pt-6">
      <h2 className={titoloSezione}>{titolo}</h2>
      {children}
    </section>
  );
}

/** One row of a list, with the same hairline separation as everywhere else. */
export function Riga({ children }: { children: ReactNode }) {
  return <li className="border-b border-linea py-4">{children}</li>;
}

export function Elenco({ children }: { children: ReactNode }) {
  return <ul className="mt-4 border-t border-linea">{children}</ul>;
}

export function Vuoto({ testo }: { testo: string }) {
  return <p className="mt-4 text-testo-secondario">{testo}</p>;
}

/**
 * A confirmation or a refusal. Refusals are `errore`; they say what to do
 * next and never why the machine is unhappy (§13.9).
 */
export function Messaggio({ testo, errore = false }: { testo: string; errore?: boolean }) {
  return (
    <p role={errore ? "alert" : "status"} className={errore ? "mt-6 text-errore" : "mt-6"}>
      {testo}
    </p>
  );
}

/** A non-blocking warning, in `avviso` with its own words (§13.7, rule 14). */
export function Avvertenza({ testo }: { testo: string }) {
  return <p className="mt-4 text-avviso">{testo}</p>;
}

type CampoProprieta = {
  nome: string;
  testo: string;
  valore?: string | number | null;
  tipo?: "text" | "date" | "time" | "number";
  nota?: string;
  massimo?: number;
  minimo?: number;
  richiesto?: boolean;
  /** Visible lines of a text area. The description of §15.3.2 is a long read. */
  righe?: number;
};

export function Campo({
  nome,
  testo,
  valore,
  tipo = "text",
  nota,
  massimo,
  minimo,
  richiesto,
}: CampoProprieta) {
  const idNota = nota ? `${nome}-nota` : undefined;
  return (
    <p className="mt-6">
      <label htmlFor={nome} className={etichetta}>
        {testo}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        defaultValue={valore ?? ""}
        maxLength={tipo === "text" ? massimo : undefined}
        min={tipo === "number" ? minimo : undefined}
        required={richiesto}
        aria-describedby={idNota}
        className={campo}
      />
      {nota && (
        <span id={idNota} className={`${aiuto} block`}>
          {nota}
        </span>
      )}
    </p>
  );
}

export function AreaTesto({ nome, testo, valore, nota, massimo, righe = 3 }: CampoProprieta) {
  const idNota = nota ? `${nome}-nota` : undefined;
  return (
    <p className="mt-6">
      <label htmlFor={nome} className={etichetta}>
        {testo}
      </label>
      <textarea
        id={nome}
        name={nome}
        defaultValue={valore ?? ""}
        rows={righe}
        maxLength={massimo}
        aria-describedby={idNota}
        className={campo}
      />
      {nota && (
        <span id={idNota} className={`${aiuto} block`}>
          {nota}
        </span>
      )}
    </p>
  );
}

export function Scelta({
  nome,
  testo,
  valore,
  opzioni,
  nota,
}: {
  nome: string;
  testo: string;
  valore?: string | null;
  opzioni: ReadonlyArray<{ valore: string; testo: string }>;
  nota?: string;
}) {
  const idNota = nota ? `${nome}-nota` : undefined;
  return (
    <p className="mt-6">
      <label htmlFor={nome} className={etichetta}>
        {testo}
      </label>
      <select
        id={nome}
        name={nome}
        defaultValue={valore ?? ""}
        aria-describedby={idNota}
        className={campo}
      >
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.testo}
          </option>
        ))}
      </select>
      {nota && (
        <span id={idNota} className={`${aiuto} block`}>
          {nota}
        </span>
      )}
    </p>
  );
}

export function Spunta({
  nome,
  testo,
  acceso,
  valore,
  nota,
  richiesto,
}: {
  nome: string;
  testo: string;
  acceso?: boolean;
  valore?: string;
  nota?: string;
  /**
   * A box the form will not go without. Used by the consent tick of §15.8,
   * where the browser's own refusal is what stands in for "senza la spunta il
   * pulsante non si attiva" — and works with JavaScript switched off, which a
   * disabled button would not.
   */
  richiesto?: boolean;
}) {
  return (
    <div className="mt-6">
      <label className="flex min-h-tocco items-center gap-3">
        <input
          type="checkbox"
          name={nome}
          value={valore}
          defaultChecked={acceso}
          required={richiesto}
          className="accent-verde"
        />
        <span>{testo}</span>
      </label>
      {nota && <p className={aiuto}>{nota}</p>}
    </div>
  );
}

/**
 * A closed list of a few mutually exclusive options, drawn as §15.8 draws the
 * two forms of consent: ○ one ○ the other. A `Scelta` would hide behind a
 * menu what has to be read before it is answered.
 */
export function Radio({
  nome,
  testo,
  valore,
  opzioni,
  nota,
  richiesto,
}: {
  nome: string;
  testo: string;
  valore?: string | null;
  opzioni: ReadonlyArray<{ valore: string; testo: string }>;
  nota?: string;
  richiesto?: boolean;
}) {
  return (
    <fieldset className="mt-6">
      <legend className={etichetta}>{testo}</legend>
      {opzioni.map((o) => (
        <label key={o.valore} className="flex min-h-tocco items-center gap-3">
          <input
            type="radio"
            name={nome}
            value={o.valore}
            defaultChecked={valore === o.valore}
            required={richiesto}
            className="accent-verde"
          />
          <span>{o.testo}</span>
        </label>
      ))}
      {nota && <p className={aiuto}>{nota}</p>}
    </fieldset>
  );
}
