"use server";

/**
 * One activity: saving it, publishing it, withdrawing it, calling it off.
 * SPEC §15.3.2, §15.8, §15.9 (second and third bullets), §15.12.
 *
 * Four writes, and the difference between them is the point:
 *
 *   salva     the typed fields, and nothing else. Never the state, never the
 *             consent tick — a typo corrected in a title does not re-date an
 *             attestation somebody signed (rule 25).
 *   pubblica  the tick, its form, and PUBBLICATA. The one act here that
 *             carries weight outside the software.
 *   ritira    the tick off: back to BOZZA. The abitante changed his mind, and
 *             he has no account to do it from (§15.12).
 *   annulla   the activity is off, the iscrizioni go with it, and everybody
 *             who held a place is told (§15.10, §15.12).
 *
 * None of the four can be reached by anyone who is not an amministratore: the
 * guard here sends them to "pagina non trovata", and the database refuses
 * them anyway (§8.3, rule 2).
 */

import { redirect } from "next/navigation";
import {
  aggiornaAttivita,
  annullaAttivita,
  attivitaSingola,
  MODALITA_CONSENSO,
  pubblicaAttivita,
  ritiraAttivita,
  type ModalitaConsenso,
} from "@/lib/db/attivita";
import { avvisaAttivitaAnnullata } from "@/lib/posta/abitanti";
import { amministratore } from "../../guardia";

const ELENCO = "/amministrazione/attivita";

const testo = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** An empty box is "not yet", never an empty value in a date or time column. */
const oNiente = (v: FormDataEntryValue | null) => testo(v) || null;

function schedaDi(id: string, coda = ""): string {
  return `${ELENCO}/${id}${coda}`;
}

export async function salvaAttivitaAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const id = testo(formData.get("attivita"));
  if (!id) redirect(ELENCO);

  const posti = testo(formData.get("capienza"));

  const esito = await aggiornaAttivita(client, id, {
    titolo: testo(formData.get("titolo")),
    descrizione: testo(formData.get("descrizione")),
    abitante_nome: testo(formData.get("abitante_nome")),
    abitante_cognome: testo(formData.get("abitante_cognome")),
    abitante_telefono: testo(formData.get("abitante_telefono")),
    abitante_note_interne: testo(formData.get("abitante_note_interne")),
    luogo_generico: testo(formData.get("luogo_generico")),
    luogo_esatto: testo(formData.get("luogo_esatto")),
    data: oNiente(formData.get("data")),
    ora_inizio: oNiente(formData.get("ora_inizio")),
    ora_fine: oNiente(formData.get("ora_fine")),
    capienza: posti ? Number(posti) : null,
    cosa_portare: testo(formData.get("cosa_portare")),
    lingua_attivita: testo(formData.get("lingua_attivita")),
  });

  redirect(schedaDi(id, esito.ok ? "?salvato=salvata" : `?errore=${esito.motivo}`));
}

export async function pubblicaAttivitaAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const id = testo(formData.get("attivita"));
  if (!id) redirect(ELENCO);

  // The tick and the form travel together or not at all (§15.8). The browser
  // refuses to send the form without them, this refuses it a second time, and
  // the database a third: the omission harms a person who has no way of
  // noticing it, so it is checked wherever it can be.
  const modalita = testo(formData.get("modalita"));
  if (formData.get("consenso") === null) {
    redirect(schedaDi(id, "/pubblica?errore=datiIncompleti"));
  }
  if (!MODALITA_CONSENSO.some((v) => v === modalita)) {
    redirect(schedaDi(id, "/pubblica?errore=MODALITA_MANCANTE"));
  }

  const esito = await pubblicaAttivita(client, id, modalita as ModalitaConsenso);
  if (!esito.ok) redirect(schedaDi(id, `/pubblica?errore=${esito.motivo}`));
  redirect(`${ELENCO}?salvato=pubblicata`);
}

export async function ritiraAttivitaAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const id = testo(formData.get("attivita"));
  if (!id) redirect(ELENCO);

  const esito = await ritiraAttivita(client, id);
  if (!esito.ok) redirect(schedaDi(id, `/pubblica?errore=${esito.motivo}`));
  redirect(`${ELENCO}?salvato=ritirata`);
}

/**
 * Calling an activity off — §15.12, and since step 19 the email that goes
 * with it (§15.10 row six).
 *
 * The card is read BEFORE the cancellation, because the message describes the
 * activity that is not happening and `annulla_attivita()` is what makes it
 * stop being one. The people, on the other hand, come back FROM the
 * cancellation: reading the iscritti first and cancelling after would leave a
 * gap in which somebody takes the last place and is never told.
 *
 * The reason is optional and is stored nowhere — §15.3.2 has no column for it
 * and none is being added (rule 20). It is typed on the screen, it goes into
 * the messages, and it stops there.
 */
export async function annullaAttivitaAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const id = testo(formData.get("attivita"));
  if (!id) redirect(ELENCO);

  const scheda = await attivitaSingola(client, id);
  const esito = await annullaAttivita(client, id);
  if (!esito.ok) redirect(schedaDi(id, `/pubblica?errore=${esito.motivo}`));

  const motivo = testo(formData.get("motivo"));
  if (scheda) {
    for (const persona of esito.valore) {
      await avvisaAttivitaAnnullata(persona, scheda, motivo);
    }
  }

  // How many people have just lost a place. A count, never a name and never
  // an address (rule 4) — the panel says what was done, and the people have
  // been told by the messages above.
  redirect(`${ELENCO}?salvato=annullata&iscritti=${esito.valore.length}`);
}
