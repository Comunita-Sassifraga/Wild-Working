import Link from "next/link";
import { redirect } from "next/navigation";
import { bottoneDistruttivo, bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { EMAIL_ASSISTENZA_ABITANTI, ORE_DISDETTA } from "@/config/limits";
import { completa, disdettaTardiva } from "@/lib/abitanti/elenco";
import { utenteAttuale } from "@/lib/auth/sessione";
import { dataEstesa, ora } from "@/lib/dates";
import { edizioneAttiva, sonoAbilitato } from "@/lib/db/abitanti";
import {
  attivitaConLivelli,
  mieIscrizioni,
  nomiIscritti,
  type AttivitaElencata,
  type DatiIscritto,
} from "@/lib/db/iscrizioni";
import { clientServer } from "@/lib/db/server";
import { mioProfilo } from "@/lib/db/utenti";
import { conValori, m } from "@/lib/messaggi";
import { rigaPersone } from "@/lib/presenze";
import { annullaAzione, iscrivitiAzione } from "./azioni";

/**
 * `/abitanti/[id]` — the detail of one activity. SPEC §15.6, §15.7, §15.8.
 *
 * The same heading as the list, the description in the abitante's own words,
 * who is coming, and the one button that takes a place or gives it up.
 *
 * **The two levels are not decided here.** Level 1 arrives from
 * `attivita_elenco` and level 2 from `attivita_iscritto`, and the second
 * answers with a row only for somebody holding an ATTIVA iscrizione on this
 * activity (rule 24). Cancelling removes the surname, the telephone and the
 * exact address in the same instant, because nothing was copied into this
 * page's own reasoning: there is no `if (iscritto)` guarding a field, only a
 * box that is drawn when the database returned something to put in it.
 *
 * Somebody without an abilitazione is sent to `/abitanti`, which asks them
 * for their code (§15.12). They read no title, no abitante and no place —
 * not because this file hides them, but because neither view returns a row.
 */

const t = m.abitanti.attivita;

const assistenza = EMAIL_ASSISTENZA_ABITANTI ?? m.pieDiPagina.email;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Day, hour and rough place: level 1, the same three lines as the list. */
function Intestazione({ attivita }: { attivita: AttivitaElencata }) {
  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {attivita.titolo}
      </h1>

      {attivita.abitanteNome && (
        <p className="mt-4">{conValori(t.proposta, { nome: attivita.abitanteNome })}</p>
      )}

      <p className="mt-2 text-testo-secondario">
        {attivita.data && dataEstesa(attivita.data)}
        {attivita.oraInizio &&
          ` · ${ora(attivita.oraInizio)}${attivita.oraFine ? `–${ora(attivita.oraFine)}` : ""}`}
        {attivita.luogoGenerico && ` · ${attivita.luogoGenerico}`}
      </p>
    </>
  );
}

/**
 * Level 2 — SPEC §15.8, §15.6. Surname, telephone, exact address, and the
 * one sentence that says what the number is for. It is drawn only when the
 * level 2 window returned a row, which it does only for somebody enrolled.
 */
function Contatti({
  livello2,
  nome,
}: {
  livello2: DatiIscritto;
  nome: string | null;
}) {
  return (
    <section className="mt-8 border-t border-linea pt-6">
      <h2 className="text-titolo-sezione font-grassetto">{t.contatti.titolo}</h2>
      {/* The first name is level 1 and the surname level 2, but a person has
          one name: read apart they say "Berardo", which is nobody. */}
      <p className="mt-4">{[nome, livello2.abitanteCognome].filter(Boolean).join(" ")}</p>
      {livello2.abitanteTelefono && <p className="mt-2">{livello2.abitanteTelefono}</p>}
      {livello2.luogoEsatto && <p className="mt-2">{livello2.luogoEsatto}</p>}
      {livello2.abitanteTelefono && nome && (
        <p className="mt-4 text-nota text-testo-secondario">
          {conValori(t.contatti.nota, { nome })}
        </p>
      )}
    </section>
  );
}

export default async function PaginaAttivita({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ esito?: string | string[] }>;
}) {
  const [utente, { id }, parametri] = await Promise.all([utenteAttuale(), params, searchParams]);
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  const [attiva, abilitato] = await Promise.all([edizioneAttiva(client), sonoAbilitato(client)]);

  const trovata = attiva || abilitato ? await attivitaConLivelli(client, id) : null;
  // Nothing of the activity leaks on the way out: somebody without an
  // abilitazione and somebody who typed an id by hand read the same page,
  // which is the code form (§15.12).
  if (!trovata) redirect(abilitato ? "/abitanti?attivita=non-trovata" : "/abitanti");

  const { attivita, livello2 } = trovata;
  const [nomi, iscrizioni, profilo] = await Promise.all([
    nomiIscritti(client, attivita.id),
    mieIscrizioni(client),
    mioProfilo(client, utente.id),
  ]);
  const mia = iscrizioni.find((i) => i.attivitaId === attivita.id);
  // The invitation of §15.6 is for whoever has not switched the name on.
  // Shown to somebody who already did, it would be a line telling them to do
  // what they have done — which is the recurring banner rule 17 forbids.
  const invitaAlNome = profilo.data?.mostra_nome_pubblico !== true;

  const esito = uno(parametri.esito);
  const esiti: Record<string, string> = t.esiti;
  const messaggio = esito ? esiti[esito] : undefined;
  const errore = messaggio !== undefined && esito !== "iscritto" && esito !== "annullata";

  // Same formula as "Chi c'è in Valle" (§6.6): the named first, then the tail
  // of those who did not share a name. The count is the difference, so the
  // line always adds up to the number of people who will be in the room.
  const senzaNome = Math.max(attivita.iscritti - nomi.length, 0);

  return (
    <>
      <Intestazione attivita={attivita} />

      {messaggio && (
        <p
          role={errore ? "alert" : "status"}
          className={errore ? "mt-6 text-errore" : "mt-6"}
        >
          {conValori(messaggio, { indirizzo: assistenza })}
        </p>
      )}

      {/* A third party's own words: whole, never rewritten, never cut (rule 26). */}
      {attivita.descrizione && (
        <p className="mt-6 whitespace-pre-line">{attivita.descrizione}</p>
      )}

      {attivita.cosaPortare && (
        <p className="mt-6">
          <span className="font-grassetto">{t.cosaPortare}: </span>
          {attivita.cosaPortare}
        </p>
      )}

      {attivita.linguaAttivita && (
        <p className="mt-2">
          <span className="font-grassetto">{t.lingua}: </span>
          {attivita.linguaAttivita}
        </p>
      )}

      <section className="mt-8 border-t border-linea pt-6">
        <h2 className="text-titolo-sezione font-grassetto">{t.chiViene}</h2>
        <p className="mt-4">
          {nomi.length === 0 && senzaNome === 0 ? t.nessuno : rigaPersone(nomi, senzaNome)}
        </p>
      </section>

      {livello2 && <Contatti livello2={livello2} nome={attivita.abitanteNome} />}

      <section className="mt-8 border-t border-linea pt-6">
        {mia ? (
          <>
            <p>{t.iscritto}</p>
            {attivita.ancoraAperta ? (
              <>
                {disdettaTardiva(attivita) && (
                  <p className="mt-4 text-avviso">
                    {conValori(t.avvisoDisdetta, { ore: ORE_DISDETTA })}
                  </p>
                )}
                <form action={annullaAzione} className="mt-4">
                  <input type="hidden" name="attivita" value={attivita.id} />
                  <input type="hidden" name="iscrizione" value={mia.id} />
                  <button type="submit" className={bottoneDistruttivo}>
                    {t.annulla}
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-4 text-testo-secondario">{t.cominciata}</p>
            )}
          </>
        ) : !attivita.ancoraAperta ? (
          <p className="text-testo-secondario">{t.cominciata}</p>
        ) : completa(attivita) ? (
          /* No waiting list (D22, rule 29): the word, and what to do instead. */
          <>
            <h2 className="text-titolo-sezione font-grassetto">{t.completa.titolo}</h2>
            <p className="mt-4">{conValori(t.completa.testo, { indirizzo: assistenza })}</p>
          </>
        ) : (
          <>
            {/* The invitation of §15.6, here and nowhere else. Not blocking,
                not repeated: whoever leaves it off signs up all the same and
                appears in the count without a name (rule 17). */}
            {invitaAlNome && (
              <>
                <p>{t.nomePubblico.invito}</p>
                <p className="mt-2">
                  <Link href="/impostazioni">{t.nomePubblico.collegamento}</Link>
                </p>
              </>
            )}
            <form action={iscrivitiAzione} className={invitaAlNome ? "mt-6" : ""}>
              <input type="hidden" name="attivita" value={attivita.id} />
              <button type="submit" className={bottonePrimario}>
                {t.iscriviti}
              </button>
            </form>
          </>
        )}
      </section>

      <p className="mt-10">
        <Link href="/abitanti" className={bottoneSecondario}>
          {t.torna}
        </Link>
      </p>
    </>
  );
}
