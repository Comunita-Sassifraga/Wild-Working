import { notFound } from "next/navigation";
import { bottoneDistruttivo, bottonePrimario, bottoneSecondario, campo } from "@/components/controlli";
import { m } from "@/lib/messaggi";

// Token sampler — SPEC §13. Every token appears here at least once, so the
// look is checked on one page before a screen uses it. Development only:
// in production the route does not exist (same check as lib/auth/cookie.ts).
// Like every component, this file may use token classes only.

const titoloPagina = "text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande";
const titoloSezione = "mt-12 text-titolo-sezione font-grassetto";
const cella = "flex min-h-tocco items-center border border-linea px-3 py-2";

export default function PaginaStile() {
  if (process.env.NODE_ENV === "production") notFound();
  const t = m.campionario;

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className="mt-6 italic">{t.introduzione}</p>

      <h2 className={titoloSezione}>{t.sezioni.testo}</h2>
      <p className="mt-4">{t.corpo}</p>
      <p className="mt-2 text-nota text-testo-secondario">{t.nota}</p>
      <p className="mt-2 italic">{t.corsivo}</p>

      <hr className="mt-12 border-linea" />

      <h2 className={titoloSezione}>{t.sezioni.collegamenti}</h2>
      <p className="mt-4">
        <a href="/stile">{t.collegamento}</a>
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button type="button" className={bottonePrimario}>
          {t.primario}
        </button>
        <button type="button" className={bottoneSecondario}>
          {t.secondario}
        </button>
        <button type="button" className={bottoneDistruttivo}>
          {t.distruttivo}
        </button>
      </div>

      <h2 className={titoloSezione}>{t.sezioni.campi}</h2>
      <p className="mt-4">
        <label htmlFor="esempio" className="mb-2 block">
          {t.etichettaCampo}
        </label>
        <input id="esempio" name="esempio" type="text" className={campo} />
      </p>

      <h2 className={titoloSezione}>{t.sezioni.griglia}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 grande:grid-cols-4">
        <div className={`${cella} bg-superficie`}>{t.celle.liberi}</div>
        <div className={`${cella} bg-superficie text-avviso`}>{t.celle.ultimi}</div>
        <div className={`${cella} bg-superficie-scura text-testo-secondario`}>{t.celle.esaurito}</div>
        <div className={`${cella} bg-superficie-scura text-testo-secondario`}>{t.celle.chiuso}</div>
      </div>

      <h2 className={titoloSezione}>{t.sezioni.messaggi}</h2>
      <p className="mt-4 text-avviso">{t.avviso}</p>
      <p className="mt-2 text-errore">{t.errore}</p>

      <h2 className={titoloSezione}>{t.sezioni.stile2}</h2>
      <section className="mt-4 bg-verde px-6 py-8 text-testo">
        <h3 className="text-titolo-sezione font-grassetto">{t.stile2Titolo}</h3>
        <p className="mt-4">{t.stile2Testo}</p>
        <p className="mt-4">
          <a href="/stile" className="text-testo">
            {t.stile2Collegamento}
          </a>
        </p>
      </section>
    </>
  );
}
