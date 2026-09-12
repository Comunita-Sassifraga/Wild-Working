import Link from "next/link";
import { redirect } from "next/navigation";
import { bottonePrimario, campo } from "@/components/controlli";
import { EMAIL_ASSISTENZA_ABITANTI } from "@/config/limits";
import { completa, perSettimana } from "@/lib/abitanti/elenco";
import { utenteAttuale } from "@/lib/auth/sessione";
import { dataBreve, dataEstesa, ora } from "@/lib/dates";
import { edizioneAttiva, sonoAbilitato } from "@/lib/db/abitanti";
import {
  attivitaPubblicate,
  mieIscrizioni,
  type AttivitaElencata,
} from "@/lib/db/iscrizioni";
import { clientServer } from "@/lib/db/server";
import { conValori, m } from "@/lib/messaggi";
import { inserisciCodiceAzione } from "./azioni";

/**
 * `/abitanti` — SPEC §15.6, §15.4.
 *
 * One address that shows two things (rule 27): the code form to somebody
 * without an abilitazione, the list of activities to somebody with one.
 * There is no second address, because the button of §15.5 is one button and
 * cannot know in advance who will press it.
 *
 * With an abilitazione it is the programme of §15.6: the published
 * activities of the active edition, in chronological order, grouped by week,
 * bounded by the edizione and never by the rolling window (rule 21). Until
 * the amministratore publishes the first card it is still the one line
 * saying the programme is not out yet — which is what somebody who has just
 * typed in their code will read on the day they arrive.
 *
 * Somebody signed out is sent to the sign-in page, which is the whole of the
 * QR mechanism (§15.5): they sign in normally and land on the availability
 * page, where the button of §15.5 will be at the top. Nothing travels in the
 * sign-in link and nothing here needs it to (rule 28).
 *
 * This version of the page exists for somebody without an abilitazione too:
 * it does not answer "pagina non trovata" (§15.6). A page that is not there
 * makes people write for help; one that explains does not. But it shows
 * nothing of the activities — not even the titles, which carry the names of
 * the abitanti.
 */

const t = m.abitanti;

/**
 * Where somebody writes when their card will not work. Until the board
 * mailbox of §15.13 is decided, the association's own address — the one
 * already in the footer — rather than a gap in a sentence.
 */
const assistenza = EMAIL_ASSISTENZA_ABITANTI ?? m.pieDiPagina.email;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Codice({ esito }: { esito?: string }) {
  const esiti: Record<string, string> = t.codice.esiti;
  const messaggio = esito ? (esiti[esito] ?? esiti.ERRORE) : undefined;

  return (
    <>
      <p className="mt-6">{t.codice.introduzione}</p>
      <p className="mt-4">{t.codice.riservato}</p>

      {messaggio && (
        <p role="alert" className="mt-6 text-errore">
          {conValori(messaggio, { indirizzo: assistenza })}
        </p>
      )}

      <form action={inserisciCodiceAzione} className="mt-10 border-t border-linea pt-6">
        <p>
          <label htmlFor="codice" className="mb-2 block">
            {t.codice.etichetta}
          </label>
          <input
            id="codice"
            name="codice"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            aria-describedby="codice-nota"
            className={campo}
          />
          <span id="codice-nota" className="mt-2 block text-nota text-testo-secondario">
            {t.codice.nota}
          </span>
        </p>
        <p className="mt-6">
          <button type="submit" className={bottonePrimario}>
            {t.codice.invia}
          </button>
        </p>
      </form>

      <p className="mt-10 text-nota text-testo-secondario">
        {conValori(t.codice.assistenza, { indirizzo: assistenza })}
      </p>
    </>
  );
}

/**
 * One activity as the list shows it — SPEC §15.6.
 *
 * Level 1 and nothing else: title, the proposer's first name, day and hour,
 * the rough place, and how many places are left or "Completa". The
 * description, which is level 1 too, stays for the detail: twenty-five cards
 * of four thousand characters are not a list.
 *
 * "Ci sei già iscritto" is not in §15.6. It is here because without it a
 * list of twenty-five entries does not say where one already has a place,
 * and the only way to find out would be to open each one. It is a count of
 * the reader's own rows, never anybody else's.
 */
function Voce({ attivita, iscritto }: { attivita: AttivitaElencata; iscritto: boolean }) {
  const e = t.elenco;
  const piena = completa(attivita);

  return (
    <li className="border-b border-linea py-6">
      <h3 className="text-titolo-sezione font-grassetto">
        <Link href={`/abitanti/${attivita.id}`}>{attivita.titolo}</Link>
      </h3>

      {attivita.abitanteNome && (
        <p className="mt-2">{conValori(t.attivita.proposta, { nome: attivita.abitanteNome })}</p>
      )}

      <p className="mt-2 text-testo-secondario">
        {attivita.data && dataEstesa(attivita.data)}
        {attivita.oraInizio && ` · ${conValori(e.orario, { orario: ora(attivita.oraInizio) })}`}
        {attivita.luogoGenerico && ` · ${attivita.luogoGenerico}`}
      </p>

      {/* Colour never carries this on its own (rule 14): the words say it. */}
      <p className="mt-2">
        {!attivita.ancoraAperta
          ? e.cominciata
          : piena
            ? e.completa
            : attivita.postiRimasti === 1
              ? e.unPosto
              : conValori(e.posti, { numero: attivita.postiRimasti })}
        {iscritto && ` · ${e.giaIscritto}`}
      </p>
    </li>
  );
}

/**
 * The programme — SPEC §15.6. Chronological, grouped by week, days with
 * nothing in them absent. Bounded by the edition and never by
 * FINESTRA_GIORNI (rule 21): a resident arriving on the first day must be
 * able to plan the whole stay.
 */
function Elenco({
  attivita,
  iscrizioni,
}: {
  attivita: AttivitaElencata[];
  iscrizioni: Set<string>;
}) {
  const e = t.elenco;
  if (attivita.length === 0) {
    return (
      <>
        <p className="mt-6">{t.abilitato.benvenuto}</p>
        <p className="mt-4">{t.abilitato.inArrivo}</p>
      </>
    );
  }

  return (
    <>
      <p className="mt-6">{e.introduzione}</p>
      {perSettimana(attivita).map((settimana) => (
        <section key={settimana.lunedi} className="mt-10">
          <h2 className="text-titolo-sezione font-grassetto">
            {conValori(e.settimana, {
              da: dataBreve(settimana.lunedi),
              a: dataBreve(settimana.domenica),
            })}
          </h2>
          <ul className="mt-4 border-t border-linea">
            {settimana.attivita.map((riga) => (
              <Voce key={riga.id} attivita={riga} iscritto={iscrizioni.has(riga.id)} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export default async function PaginaAbitanti({
  searchParams,
}: {
  searchParams: Promise<{ esito?: string | string[]; attivita?: string | string[] }>;
}) {
  const [utente, parametri] = await Promise.all([utenteAttuale(), searchParams]);
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  const [attiva, abilitato] = await Promise.all([edizioneAttiva(client), sonoAbilitato(client)]);
  const esito = Array.isArray(parametri.esito) ? parametri.esito[0] : parametri.esito;
  const persa = uno(parametri.attivita) === "non-trovata";

  // Asked for only where it can be answered. Without an abilitazione the two
  // views return nothing anyway (rule 22); not asking is one less round trip,
  // not the thing that keeps the programme out of sight.
  const [attivita, iscrizioni] =
    attiva && abilitato
      ? await Promise.all([attivitaPubblicate(client), mieIscrizioni(client)])
      : [[], []];

  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {t.titolo}
      </h1>

      {persa && (
        <p role="status" className="mt-6">
          {t.elenco.nonTrovata}
        </p>
      )}

      {!attiva ? (
        <>
          <p className="mt-6">{t.chiuso.introduzione}</p>
          <p className="mt-4">{t.chiuso.testo}</p>
        </>
      ) : abilitato ? (
        <Elenco attivita={attivita} iscrizioni={new Set(iscrizioni.map((i) => i.attivitaId))} />
      ) : (
        <Codice esito={esito} />
      )}

      <p className="mt-10">
        <Link href="/">{t.abilitato.torna}</Link>
      </p>
    </>
  );
}
