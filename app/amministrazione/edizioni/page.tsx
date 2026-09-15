import Link from "next/link";
import { bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { dataEstesa, oggiRoma } from "@/lib/dates";
import { edizioniTutte, type Edizione } from "@/lib/db/abitanti";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "../guardia";
import { uno, type Parametri } from "../parametri";
import {
  Avvertenza,
  Campo,
  Elenco,
  Messaggio,
  Riga,
  Sezione,
  Vuoto,
  aiuto,
  introduzione,
  titoloPagina,
} from "../parti";
import { accendiEdizioneAzione, creaEdizioneAzione } from "./azioni";

/**
 * Edizioni — SPEC §15.3.1, §15.9.
 *
 * The time switch of the module, and the same idea as the periodi_attivita of
 * a sede: seasonality is a row somebody edits from here, never a condition in
 * the code (rule 11). Making the module appear next year is two dates, not a
 * deploy.
 *
 * The warning of §15.3.1 — "attivarne una ne disattiva un'altra, con avviso
 * esplicito" — is written beside the button that would do it, with the name
 * of the edition that would go out. After the click it would be a fact, not
 * a warning.
 *
 * An edition switched on whose dates have passed is shown as such: `attiva`
 * is true and the module is still shut, and somebody looking for the reason
 * should find it here rather than in the code.
 */

const t = m.amministrazione.edizioni;

function corrente(e: Edizione, oggi: string): boolean {
  return e.data_inizio <= oggi && oggi <= e.data_fine;
}

export default async function PaginaEdizioni({
  searchParams,
}: {
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);
  const edizioni = await edizioniTutte(client);
  const oggi = oggiRoma();
  const accesa = edizioni.find((e) => e.attiva);

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);
  const conferme: Record<string, string> = {
    creata: t.crea.creata,
    attivata: t.attivata,
    disattivata: t.disattivata,
  };

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className={introduzione}>{t.introduzione}</p>

      {salvato && conferme[salvato] && <Messaggio testo={conferme[salvato]} />}
      {errore && <Messaggio testo={errori[errore] ?? errori.ERRORE} errore />}

      <Sezione titolo={t.elenco}>
        {edizioni.length === 0 ? (
          <Vuoto testo={t.vuoto} />
        ) : (
          <Elenco>
            {edizioni.map((e) => (
              <Riga key={e.id}>
                <span className="font-grassetto">{e.nome}</span>
                <span className={`${aiuto} block`}>
                  {conValori(t.periodo, {
                    inizio: dataEstesa(e.data_inizio),
                    fine: dataEstesa(e.data_fine),
                  })}
                  {" · "}
                  {e.attiva ? t.attiva : t.nonAttiva}
                </span>

                {e.attiva && !corrente(e, oggi) && <Avvertenza testo={t.fuoriDate} />}

                {/* §15.3.1: the explicit warning, before the click and never
                    after it. Shown only when there is something to lose. */}
                {!e.attiva && accesa && (
                  <Avvertenza testo={conValori(t.avvisoCambio, { nome: accesa.nome })} />
                )}

                <form action={accendiEdizioneAzione} className="mt-4">
                  <input type="hidden" name="edizione" value={e.id} />
                  <input type="hidden" name="attiva" value={e.attiva ? "no" : "si"} />
                  <button type="submit" className={bottoneSecondario}>
                    {e.attiva ? t.disattivaPulsante : t.attivaPulsante}
                  </button>
                </form>
              </Riga>
            ))}
          </Elenco>
        )}
      </Sezione>

      <Sezione titolo={t.crea.titolo}>
        <form action={creaEdizioneAzione}>
          <Campo nome="nome" testo={t.crea.nome} nota={t.crea.nomeNota} massimo={80} richiesto />
          <Campo nome="data_inizio" testo={t.crea.inizio} tipo="date" richiesto />
          <Campo
            nome="data_fine"
            testo={t.crea.fine}
            tipo="date"
            nota={t.crea.fineNota}
            richiesto
          />
          <p className="mt-6">
            <button type="submit" className={bottonePrimario}>
              {t.crea.pulsante}
            </button>
          </p>
        </form>
      </Sezione>

      <p className="mt-10">
        <Link href="/amministrazione" className={bottoneSecondario}>
          {m.amministrazione.torna}
        </Link>
      </p>
    </>
  );
}
