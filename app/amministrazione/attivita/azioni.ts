"use server";

/**
 * Attività — SPEC §15.9 second bullet, §15.14 step 16.
 *
 * Creating a card is the only write on the list page. Everything else that
 * can happen to an activity happens on the card's own screen, because
 * everything else needs the card in front of you: what is missing, what the
 * abitante wrote, whether the consent is in a drawer.
 */

import { redirect } from "next/navigation";
import { creaAttivita } from "@/lib/db/attivita";
import { amministratore } from "../guardia";

const PAGINA = "/amministrazione/attivita";

export async function creaAttivitaAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const edizioneId = String(formData.get("edizione") ?? "").trim();
  const titolo = String(formData.get("titolo") ?? "").trim();
  if (!edizioneId) redirect(PAGINA);

  const esito = await creaAttivita(client, edizioneId, titolo);
  if (!esito.ok) redirect(`${PAGINA}?edizione=${edizioneId}&errore=${esito.motivo}`);

  // Straight onto the card: whoever pressed "Crea" has the rest of it in
  // front of them and is not going to want the list back (§15.9).
  redirect(`${PAGINA}/${esito.valore}?salvato=creata`);
}
