"use server";

/**
 * Clearing a public name — SPEC §6.5 level 3, §6.7 fifth bullet.
 *
 * The whole action happens inside one database function: the name is
 * emptied, the visibility switched off, the register written and the notice
 * to the person raised, all together or not at all. This file only carries
 * the answer back.
 *
 * What it does not do, and must never do: touch a prenotazione, or close the
 * account (§6.5, §8.4). No email address passes through here — the screen
 * reads from a view that does not have the column (§6.7), and the notice the
 * person receives is addressed by the mail layer, which reads the address
 * with the backend client and never hands it back.
 */

import { redirect } from "next/navigation";
import { after } from "next/server";
import { azzeraNomePubblico } from "@/lib/db/amministrazione";
import { avvisaNomeRimosso } from "@/lib/posta/avvisi";
import { amministratore } from "../guardia";

const PAGINA = "/amministrazione/moderazione";

export async function azzeraNomeAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const utenteId = String(formData.get("utente") ?? "").trim();
  if (!utenteId) redirect(PAGINA);

  const esito = await azzeraNomePubblico(client, utenteId);
  if (!esito.ok) redirect(`${PAGINA}?utente=${utenteId}&errore=${esito.motivo}`);

  // "L'azione invia in automatico l'avviso all'utente" (§6.5). After the
  // answer: the name is already gone, and the same message waits for the
  // person in their settings whatever the mail provider does.
  after(async () => {
    await avvisaNomeRimosso(utenteId);
  });

  redirect(`${PAGINA}?salvato=rimosso`);
}
