import Link from "next/link";
import { redirect } from "next/navigation";
import { bottonePrimario, campo } from "@/components/controlli";
import { EMAIL_ASSISTENZA_ABITANTI } from "@/config/limits";
import { utenteAttuale } from "@/lib/auth/sessione";
import { edizioneAttiva, sonoAbilitato } from "@/lib/db/abitanti";
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
 * At this step the list does not exist yet — it arrives with step 17 — so
 * what an enabled person reads is one line saying the programme is not
 * published. §15.14 puts it exactly that way: "si può generare un
 * cartoncino, inserirne il codice, e diventare abilitati, anche se non c'è
 * ancora niente da vedere".
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

export default async function PaginaAbitanti({
  searchParams,
}: {
  searchParams: Promise<{ esito?: string | string[] }>;
}) {
  const [utente, parametri] = await Promise.all([utenteAttuale(), searchParams]);
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  const [attiva, abilitato] = await Promise.all([edizioneAttiva(client), sonoAbilitato(client)]);
  const esito = Array.isArray(parametri.esito) ? parametri.esito[0] : parametri.esito;

  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {t.titolo}
      </h1>

      {!attiva ? (
        <>
          <p className="mt-6">{t.chiuso.introduzione}</p>
          <p className="mt-4">{t.chiuso.testo}</p>
        </>
      ) : abilitato ? (
        <>
          <p className="mt-6">{t.abilitato.benvenuto}</p>
          <p className="mt-4">{t.abilitato.inArrivo}</p>
        </>
      ) : (
        <Codice esito={esito} />
      )}

      <p className="mt-10">
        <Link href="/">{t.abilitato.torna}</Link>
      </p>
    </>
  );
}
