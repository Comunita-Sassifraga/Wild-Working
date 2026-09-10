"use server";

/**
 * Incarichi — SPEC §6.7 fourth bullet, §5.6.
 *
 * A referente is always bound to one sede; an amministratore is global and
 * is not assigned from here (§5.6, §6.7, which names the referente only).
 *
 * The address the panel searches by never reaches an address bar, a log or
 * an error message (rule 4): a failed lookup comes back as a reason code and
 * nothing else.
 */

import { redirect } from "next/navigation";
import { assegnaReferente, cercaUtentePerEmail, revocaIncarico } from "@/lib/db/amministrazione";
import { amministratore } from "../guardia";

const PAGINA = "/amministrazione/incarichi";

export async function assegnaReferenteAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();

  const email = String(formData.get("email") ?? "").trim();
  const sedeId = String(formData.get("sede") ?? "").trim();
  if (!email || !sedeId) redirect(`${PAGINA}?errore=datiIncompleti`);

  const utente = await cercaUtentePerEmail(client, email);
  if (!utente.ok) redirect(`${PAGINA}?errore=${utente.motivo}`);

  const esito = await assegnaReferente(client, utente.valore.id, sedeId);
  redirect(esito.ok ? `${PAGINA}?salvato=assegnato` : `${PAGINA}?errore=${esito.motivo}`);
}

export async function revocaIncaricoAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const incaricoId = String(formData.get("incarico") ?? "").trim();
  if (!incaricoId) redirect(PAGINA);

  const esito = await revocaIncarico(client, incaricoId);
  redirect(esito.ok ? `${PAGINA}?salvato=revocato` : `${PAGINA}?errore=${esito.motivo}`);
}
