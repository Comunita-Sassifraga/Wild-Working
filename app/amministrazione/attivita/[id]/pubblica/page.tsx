import Link from "next/link";
import { notFound } from "next/navigation";
import { bottoneDistruttivo, bottonePrimario } from "@/components/controlli";
import { dataEstesa, istanteEsteso, ora } from "@/lib/dates";
import {
  attivitaSingola,
  campiMancanti,
  MODALITA_CONSENSO,
  type Attivita,
} from "@/lib/db/attivita";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "../../../guardia";
import { uno, type Parametri } from "../../../parametri";
import {
  Avvertenza,
  Messaggio,
  Radio,
  Sezione,
  Spunta,
  aiuto,
  introduzione,
  titoloPagina,
  titoloVoce,
} from "../../../parti";
import { annullaAttivitaAzione, pubblicaAttivitaAzione, ritiraAttivitaAzione } from "../azioni";

/**
 * Publishing an activity — SPEC §15.8, §15.9 third bullet.
 *
 * A screen of its own, and the only one in the module where something is
 * signed. It carries four things, in the order §15.9 puts them:
 *
 *   1. the fields still empty. The database refuses none of them (§15.3.2),
 *      so without this warning an unfinished card would go out published and
 *      invisible — with no date it never appears in the elenco, with no
 *      capienza it takes nobody.
 *   2. the reminder to re-read the description. It is a third party's own
 *      words, published to 45 people, and it may hold a telephone number, a
 *      home address, the name of a grandchild without its author having
 *      noticed. No automatic filter can see that, and none is going to be
 *      added (rule 26). The only re-reading is a person's.
 *   3. the consent tick and which of the two forms. The tick is not the
 *      consent: the consent is the paper the Direttivo holds. The tick is the
 *      traced declaration that the paper exists (rule 25).
 *   4. the preview, level 1 then level 2, so that whoever ticks sees exactly
 *      what 45 people are about to see.
 *
 * "Senza la spunta il pulsante non si attiva" is read here as: the browser
 * refuses to send the form without the tick and without a form of consent.
 * That works with JavaScript switched off, which a disabled button would not,
 * and behind it the action refuses again and the database a third time.
 */

const t = m.amministrazione.attivita;

function Riquadro({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-linea pt-4">
      <p className={titoloVoce}>{titolo}</p>
      {children}
    </div>
  );
}

function Voce({ etichetta, valore }: { etichetta: string; valore: string | null }) {
  return (
    <p className="mt-4">
      <span className={titoloVoce}>{etichetta}</span>
      <span className="block">{valore || t.pubblica.anteprima.vuoto}</span>
    </p>
  );
}

/**
 * What the residents will read. Level 1 is what everybody abilitated sees;
 * level 2 only somebody enrolled on this activity, and in the email that
 * concerns them (§15.8). The internal notes are in neither: they are level 3
 * and never leave the panel.
 */
function Anteprima({ attivita }: { attivita: Attivita }) {
  const quando =
    attivita.data && attivita.ora_inizio && attivita.ora_fine
      ? conValori(t.quando, {
          giorno: dataEstesa(attivita.data),
          inizio: ora(attivita.ora_inizio),
          fine: ora(attivita.ora_fine),
        })
      : null;

  return (
    <Sezione titolo={t.pubblica.anteprima.titolo}>
      <Riquadro titolo={t.pubblica.anteprima.livello1}>
        <Voce etichetta={t.campi.titolo} valore={attivita.titolo} />
        <Voce etichetta={t.campi.abitante_nome} valore={attivita.abitante_nome} />
        <Voce etichetta={t.campi.data} valore={quando} />
        <Voce etichetta={t.campi.luogo_generico} valore={attivita.luogo_generico} />
        <Voce
          etichetta={t.campi.capienza}
          valore={attivita.capienza === null ? null : String(attivita.capienza)}
        />
        <Voce etichetta={t.campi.cosa_portare} valore={attivita.cosa_portare} />
        <Voce etichetta={t.campi.lingua_attivita} valore={attivita.lingua_attivita} />
        {/* Whole, never truncated: it is somebody's own account of what they
            are offering (rule 26). */}
        <p className="mt-4">
          <span className={titoloVoce}>{t.campi.descrizione}</span>
          <span className="block whitespace-pre-line">
            {attivita.descrizione || t.pubblica.anteprima.vuoto}
          </span>
        </p>
      </Riquadro>

      <Riquadro titolo={t.pubblica.anteprima.livello2}>
        <Voce etichetta={t.campi.abitante_cognome} valore={attivita.abitante_cognome} />
        <Voce etichetta={t.campi.abitante_telefono} valore={attivita.abitante_telefono} />
        <Voce etichetta={t.campi.luogo_esatto} valore={attivita.luogo_esatto} />
      </Riquadro>
    </Sezione>
  );
}

export default async function PaginaPubblicazione({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, { id }, parametri] = await Promise.all([
    amministratore(),
    params,
    searchParams,
  ]);
  const attivita = await attivitaSingola(client, id);
  if (!attivita) notFound();

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);
  const mancanti = campiMancanti(attivita);
  const campi: Record<string, string> = t.campi;
  const forme: Record<string, string> = t.pubblica.consenso;

  const annullata = attivita.stato === "ANNULLATA";
  const pubblicata = attivita.stato === "PUBBLICATA";
  const iscritti = attivita.iscritti ?? 0;

  return (
    <>
      <h1 className={titoloPagina}>{attivita.titolo || t.senzaTitolo}</h1>
      <p className={introduzione}>{t.pubblica.introduzione}</p>

      {errore && <Messaggio testo={errori[errore] ?? errori.ERRORE} errore />}

      {annullata ? (
        <p className="mt-6">{t.scheda.statoAnnullata}</p>
      ) : (
        <>
          <Sezione titolo={t.pubblica.mancanti.titolo}>
            {mancanti.length === 0 ? (
              <p className="mt-4">{t.pubblica.mancanti.completa}</p>
            ) : (
              <>
                <Avvertenza
                  testo={conValori(t.pubblica.mancanti.elenco, {
                    campi: mancanti.map((c) => campi[c] ?? c).join(", "),
                  })}
                />
                {/* The two that are not merely incomplete but consequential
                    (§15.3.2, §15.9). */}
                {mancanti.includes("data") && (
                  <Avvertenza testo={t.pubblica.mancanti.senzaData} />
                )}
                {mancanti.includes("capienza") && (
                  <Avvertenza testo={t.pubblica.mancanti.senzaCapienza} />
                )}
              </>
            )}
          </Sezione>

          <Sezione titolo={t.pubblica.rileggi.titolo}>
            <p className={aiuto}>{t.pubblica.rileggi.avviso}</p>
            <p className="mt-4 whitespace-pre-line">
              {attivita.descrizione || t.pubblica.rileggi.vuota}
            </p>
          </Sezione>

          <form action={pubblicaAttivitaAzione}>
            <input type="hidden" name="attivita" value={attivita.id ?? ""} />

            <Sezione titolo={t.pubblica.consenso.titolo}>
              {pubblicata && attivita.consenso_raccolto_il && (
                <p className="mt-4">
                  {conValori(t.pubblica.consenso.messa, {
                    data: istanteEsteso(attivita.consenso_raccolto_il),
                    forma: forme[attivita.consenso_modalita ?? ""] ?? "",
                  })}
                </p>
              )}
              <Spunta
                nome="consenso"
                testo={t.pubblica.consenso.spunta}
                acceso={attivita.consenso_raccolto ?? false}
                richiesto
              />
              <Radio
                nome="modalita"
                testo={t.pubblica.consenso.forma}
                valore={attivita.consenso_modalita}
                opzioni={MODALITA_CONSENSO.map((v) => ({ valore: v, testo: forme[v] }))}
                nota={t.pubblica.consenso.nota}
                richiesto
              />
            </Sezione>

            <Anteprima attivita={attivita} />

            <p className="mt-10">
              <button type="submit" className={bottonePrimario}>
                {pubblicata ? t.pubblica.ripubblica : t.pubblica.pulsante}
              </button>
            </p>
          </form>

          {/* §15.12: the abitante changed his mind. Only offered once there is
              something to withdraw. */}
          {pubblicata && (
            <Sezione titolo={t.ritira.titolo}>
              <p className="mt-4">{t.ritira.avviso}</p>
              {iscritti > 0 && (
                <Avvertenza testo={conValori(t.ritira.conIscritti, { quanti: iscritti })} />
              )}
              <form action={ritiraAttivitaAzione} className="mt-4">
                <input type="hidden" name="attivita" value={attivita.id ?? ""} />
                <button type="submit" className={bottoneDistruttivo}>
                  {t.ritira.pulsante}
                </button>
              </form>
            </Sezione>
          )}

          <Sezione titolo={t.annulla.titolo}>
            <p className="mt-4">{t.annulla.avviso}</p>
            {iscritti > 0 && (
              <Avvertenza testo={conValori(t.annulla.conIscritti, { quanti: iscritti })} />
            )}
            <form action={annullaAttivitaAzione} className="mt-4">
              <input type="hidden" name="attivita" value={attivita.id ?? ""} />
              <button type="submit" className={bottoneDistruttivo}>
                {t.annulla.pulsante}
              </button>
            </form>
          </Sezione>
        </>
      )}

      <p className="mt-10">
        <Link href={`/amministrazione/attivita/${attivita.id}`}>{t.pubblica.torna}</Link>
      </p>
    </>
  );
}
