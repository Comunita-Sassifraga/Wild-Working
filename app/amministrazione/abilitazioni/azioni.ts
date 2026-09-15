"use server";

/**
 * Abilitazioni — SPEC §15.4, §15.9 fifth bullet.
 *
 * Enabling somebody already registered, and revoking one access without
 * touching any other.
 *
 * The person is found by their exact address, the way a referente is (§6.7):
 * the panel has no list of everybody who ever signed in, and building one
 * would be the first step towards the screen rule 15 forbids. §15.4 was
 * worded to say so on 2026-09-12.
 *
 * The address is used to find the row and then dropped. It never reaches an
 * address bar, a message or a log (rule 4): what travels back is the reason,
 * never who it was about.
 */

import { redirect } from "next/navigation";
import { abilitaUtente, revocaAbilitazione } from "@/lib/db/abitanti";
import { cercaUtentePerEmail } from "@/lib/db/amministrazione";
import { amministratore } from "../guardia";

const PAGINA = "/amministrazione/abilitazioni";

export async function abilitaUtenteAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect(`${PAGINA}?errore=datiIncompleti`);

  const utente = await cercaUtentePerEmail(client, email);
  if (!utente.ok) redirect(`${PAGINA}?errore=${utente.motivo}`);

  const esito = await abilitaUtente(client, utente.valore.id);
  redirect(esito.ok ? `${PAGINA}?salvato=abilitata` : `${PAGINA}?errore=${esito.motivo}`);
}

export async function revocaAbilitazioneAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const abilitazioneId = String(formData.get("abilitazione") ?? "").trim();
  if (!abilitazioneId) redirect(PAGINA);

  const esito = await revocaAbilitazione(client, abilitazioneId);
  redirect(esito.ok ? `${PAGINA}?salvato=revocata` : `${PAGINA}?errore=${esito.motivo}`);
}
