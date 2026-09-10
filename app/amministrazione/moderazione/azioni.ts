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
 * reads from a view that does not have the column (§6.7).
 */

import { redirect } from "next/navigation";
import { azzeraNomePubblico } from "@/lib/db/amministrazione";
import { amministratore } from "../guardia";

const PAGINA = "/amministrazione/moderazione";

export async function azzeraNomeAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const utenteId = String(formData.get("utente") ?? "").trim();
  if (!utenteId) redirect(PAGINA);

  const esito = await azzeraNomePubblico(client, utenteId);
  if (!esito.ok) redirect(`${PAGINA}?utente=${utenteId}&errore=${esito.motivo}`);
  redirect(`${PAGINA}?salvato=rimosso`);
}
