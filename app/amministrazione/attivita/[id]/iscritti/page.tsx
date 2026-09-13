import Link from "next/link";
import { notFound } from "next/navigation";
import { bottoneDistruttivo, bottonePrimario, campo } from "@/components/controlli";
import { frasePerProponente } from "@/lib/abitanti/proponente";
import type { DataISO } from "@/lib/dates";
import { attivitaSingola } from "@/lib/db/attivita";
import { iscrittiAttivita, type Iscritto } from "@/lib/db/iscritti";
import { m } from "@/lib/messaggi";
import { amministratore } from "../../../guardia";
import { uno, type Parametri } from "../../../parametri";
import {
  Campo,
  Elenco,
  Messaggio,
  Riga,
  Sezione,
  Vuoto,
  aiuto,
  etichetta,
  introduzione,
  titoloPagina,
} from "../../../parti";
import { annullaPerContoAzione, iscriviPerContoAzione } from "./azioni";

/**
 * Who is coming to one activity — SPEC §15.9, §15.14 step 18.
 *
 * §15.9 calls this an apparent exception to §4 and then settles it: Maria
 * needs to know how many people are arriving at her house, and whoever looks
 * after the service needs to be able to write to them if something changes.
 * The email address is the only handle this application has on a person.
 *
 * So the screen shows two different things, and the difference is the point:
 *
 *   the **list**, with addresses, which stays inside the panel and which the
 *   view itself stops returning the day after the activity;
 *   the **sentence for the proponente**, which carries no address at all —
 *   how many are coming, and the names of those who chose to leave one. That
 *   is what is handed over, and it is shown here before it is handed over,
 *   because somebody passing a third party's data to another person should
 *   see exactly what they are passing.
 *
 * The two actions are the ones that replace the waiting list (D22). They are
 * the only place in this application where a person acts on somebody else's
 * row, they exist for `iscrizioni` and never for `prenotazioni`, and both
 * tell the person concerned (§15.9).
 */

const t = m.amministrazione.attivita.iscritti;

/**
 * One person, and the button that takes their place away.
 *
 * The reason travels with the form and is written nowhere: §15.3.3 has no
 * column for it and none is being added (rule 20). It reaches the one email
 * and stops there — which is also why the field says so out loud.
 */
function Persona({ iscritto, attivitaId }: { iscritto: Iscritto; attivitaId: string }) {
  const idMotivo = `motivo-${iscritto.id}`;
  return (
    <Riga>
      <span className="font-grassetto">{iscritto.email}</span>
      {(iscritto.perContoDiAltri || iscritto.annullataDaAltri) && (
        <span className={`${aiuto} block`}>
          {[
            iscritto.perContoDiAltri ? t.perConto : "",
            iscritto.annullataDaAltri ? t.annullataDaVoi : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
      {iscritto.stato === "ATTIVA" && (
        <form action={annullaPerContoAzione}>
          <input type="hidden" name="attivita" value={attivitaId} />
          <input type="hidden" name="iscrizione" value={iscritto.id} />
          {/*
            Written out rather than through <AreaTesto>, which ties the field
            id to its name: every row needs its own id for its own label, and
            every row sends the same name, because each row is its own form.
          */}
          <p className="mt-6">
            <label htmlFor={idMotivo} className={etichetta}>
              {t.annulla.motivo}
            </label>
            <textarea
              id={idMotivo}
              name="motivo"
              rows={2}
              maxLength={300}
              aria-describedby={`${idMotivo}-nota`}
              className={campo}
            />
            <span id={`${idMotivo}-nota`} className={`${aiuto} block`}>
              {t.annulla.motivoNota}
            </span>
          </p>
          <p className="mt-6">
            <button type="submit" className={bottoneDistruttivo}>
              {t.annulla.pulsante}
            </button>
          </p>
        </form>
      )}
    </Riga>
  );
}

export default async function PaginaIscritti({
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
  const attivitaId = attivita?.id;
  if (!attivita || !attivitaId) notFound();

  const iscritti = await iscrittiAttivita(client, attivitaId);
  const attivi = iscritti.filter((i) => i.stato === "ATTIVA");
  const annullate = iscritti.filter((i) => i.stato === "ANNULLATA");

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);
  const conferme: Record<string, string> = {
    iscritta: t.iscrivi.fatta,
    annullata: t.annulla.fatta,
  };

  return (
    <>
      <h1 className={titoloPagina}>
        {attivita.titolo ?? m.amministrazione.attivita.senzaTitolo}
      </h1>
      <p className={introduzione}>{t.introduzione}</p>

      {salvato && conferme[salvato] && <Messaggio testo={conferme[salvato]} />}
      {errore && <Messaggio testo={errori[errore] ?? errori.ERRORE} errore />}

      <Sezione titolo={t.titolo}>
        {attivi.length === 0 ? (
          <Vuoto testo={t.vuoto} />
        ) : (
          <Elenco>
            {attivi.map((i) => (
              <Persona key={i.id} iscritto={i} attivitaId={attivitaId} />
            ))}
          </Elenco>
        )}
      </Sezione>

      {/*
        What leaves the application, and §15.9 says exactly what it may be:
        the sentence, never the addresses. The real names of everybody are
        matched on the association's own VIHTA list, outside this software —
        which is why no name field is being added here to avoid it (rule 1).
      */}
      <Sezione titolo={t.proponente.titolo}>
        <p className={aiuto}>{t.proponente.nota}</p>
        <p className="mt-6">
          {frasePerProponente(iscritti, (attivita.data as DataISO | null) ?? null)}
        </p>
        <p className="mt-6">
          <Link href={`/amministrazione/attivita/${attivitaId}/iscritti/elenco`}>
            {t.proponente.scarica}
          </Link>
        </p>
      </Sezione>

      <Sezione titolo={t.iscrivi.titolo}>
        <p className={aiuto}>{t.iscrivi.nota}</p>
        <form action={iscriviPerContoAzione}>
          <input type="hidden" name="attivita" value={attivitaId} />
          <Campo nome="email" testo={t.iscrivi.email} tipo="text" richiesto />
          <p className="mt-6">
            <button type="submit" className={bottonePrimario}>
              {t.iscrivi.pulsante}
            </button>
          </p>
        </form>
      </Sezione>

      {annullate.length > 0 && (
        <Sezione titolo={t.annullate}>
          <Elenco>
            {annullate.map((i) => (
              <Persona key={i.id} iscritto={i} attivitaId={attivitaId} />
            ))}
          </Elenco>
        </Sezione>
      )}

      <p className="mt-10">
        <Link href={`/amministrazione/attivita/${attivitaId}`}>{t.torna}</Link>
      </p>
    </>
  );
}
