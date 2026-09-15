"use server";

/**
 * The two actions that replace the waiting list — SPEC §15.9 («Iscrivere e
 * annullare per conto di qualcuno»), §15.7, D22.
 *
 * They exist because there is no waiting list and there is not going to be
 * one (rule 29): without one, the swap between somebody who gives a place up
 * and somebody who takes it can only be closed by a person who signs for it.
 * Rule 6 is intact — it forbids an *automatic* cancellation, not a decision
 * somebody takes.
 *
 * The three conditions of §15.9 are met here and can be read off the code:
 *
 *   **Only iscrizioni.** Neither action names a `prenotazione`, and neither
 *   of the two database functions they call can reach one. For desks §8.2
 *   still holds: a list to look at, and no button that cancels.
 *
 *   **Traced.** `creata_da` and `annullata_da` are written by the database
 *   from the session, so they say for ever who acted and when.
 *
 *   **The person is told.** Both actions send the email of §15.10 before
 *   they redirect. The address is read inside lib/posta/abitanti.ts with the
 *   backend client: it never travels through here, never reaches whoever
 *   pressed the button, and never appears in a URL (rule 4).
 *
 * The email is sent after the write and its outcome does not undo it: a
 * cancellation that happened has happened, and telling somebody it failed
 * when the place is already gone would be worse than the silence. What the
 * screen says is what was done.
 */

import { redirect } from "next/navigation";
import { attivitaSingola } from "@/lib/db/attivita";
import { cercaUtentePerEmail } from "@/lib/db/amministrazione";
import { annullaPerConto, iscriviPerConto } from "@/lib/db/iscritti";
import {
  avvisaAnnullamentoDaAmministratore,
  avvisaIscrizioneAlDirettivo,
  avvisaIscrizioneDaAmministratore,
} from "@/lib/posta/abitanti";
import { amministratore } from "../../../guardia";

const ELENCO = "/amministrazione/attivita";

const testo = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function pagina(attivitaId: string, coda = ""): string {
  return `${ELENCO}/${attivitaId}/iscritti${coda}`;
}

/**
 * Signs somebody up — §15.9. The second half of a swap, and never the first:
 * a full activity is refused by the same capacity constraint that refuses
 * everybody (§15.12), so the one who gives up is cancelled first.
 *
 * The person is found by their exact address, the way a referente and an
 * abilitazione are (§6.7, §15.4): the panel has no directory of everybody
 * who ever signed in, and building one would be the first step towards the
 * screen rule 15 forbids. The address is used to find the row and dropped.
 */
export async function iscriviPerContoAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const attivitaId = testo(formData.get("attivita"));
  if (!attivitaId) redirect(ELENCO);

  const email = testo(formData.get("email"));
  if (!email) redirect(pagina(attivitaId, "?errore=datiIncompleti"));

  const utente = await cercaUtentePerEmail(client, email);
  if (!utente.ok) redirect(pagina(attivitaId, `?errore=${utente.motivo}`));

  const esito = await iscriviPerConto(client, attivitaId, utente.valore.id);
  if (!esito.ok) redirect(pagina(attivitaId, `?errore=${esito.motivo}`));

  // Read after the write, so the message carries the card as it is now.
  const attivita = await attivitaSingola(client, attivitaId);
  if (attivita) {
    await avvisaIscrizioneDaAmministratore(utente.valore.id, attivita);
    // And the same notice the Direttivo gets for a sign-up somebody made
    // themselves (§15.10), with the line that says this one came from the
    // panel. It goes out here too because the mailbox is read by more than
    // one person: whoever did not press the button has no other way of
    // knowing a place changed hands.
    await avvisaIscrizioneAlDirettivo(utente.valore.id, attivita, {
      // A card saved half-way has no capienza yet (§15.3.2), and then there
      // is no number of free places to report — not a zero, which would read
      // as "full".
      postiRimasti:
        attivita.capienza === null ? null : attivita.capienza - (attivita.iscritti ?? 0),
      perConto: true,
    });
  }

  redirect(pagina(attivitaId, "?salvato=iscritta"));
}

/**
 * Cancels somebody else's place — §15.9. The first half of a swap, and the
 * only way to close the cases a person cannot close alone: a revoked
 * abilitazione, a card whose date was cleared (§15.12).
 *
 * The reason is optional and is stored nowhere: §15.3.3 has no column for it
 * and none is being added (rule 20). It is typed here, it goes into the one
 * email, and it stops there.
 */
export async function annullaPerContoAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const attivitaId = testo(formData.get("attivita"));
  if (!attivitaId) redirect(ELENCO);

  const iscrizioneId = testo(formData.get("iscrizione"));
  if (!iscrizioneId) redirect(pagina(attivitaId));

  const esito = await annullaPerConto(client, iscrizioneId);
  if (!esito.ok) redirect(pagina(attivitaId, `?errore=${esito.motivo}`));

  const attivita = await attivitaSingola(client, attivitaId);
  if (esito.valore && attivita) {
    await avvisaAnnullamentoDaAmministratore(esito.valore, attivita, testo(formData.get("motivo")));
  }

  redirect(pagina(attivitaId, "?salvato=annullata"));
}
