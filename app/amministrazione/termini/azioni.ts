"use server";

/**
 * The blocklist — SPEC §6.5 level 1, §6.7 sixth bullet: "aggiungere e
 * rimuovere voci senza toccare il codice".
 *
 * The list is only ever read by the write-time check inside the database, in
 * a definer function: knowing the list is knowing how to skirt it, so no
 * term is ever put into an address, a message or a log.
 */

import { redirect } from "next/navigation";
import { aggiungiTermine, rimuoviTermine } from "@/lib/db/amministrazione";
import { amministratore } from "../guardia";

const PAGINA = "/amministrazione/termini";

export async function aggiungiTermineAzione(formData: FormData): Promise<void> {
  const { client, id } = await amministratore();
  const termine = String(formData.get("termine") ?? "").trim();
  if (!termine) redirect(`${PAGINA}?errore=datiIncompleti`);

  const esito = await aggiungiTermine(client, termine, id);
  redirect(esito.ok ? `${PAGINA}?salvato=aggiunto` : `${PAGINA}?errore=${esito.motivo}`);
}

export async function rimuoviTermineAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const termineId = String(formData.get("termine") ?? "").trim();
  if (!termineId) redirect(PAGINA);

  const esito = await rimuoviTermine(client, termineId);
  redirect(esito.ok ? `${PAGINA}?salvato=rimosso` : `${PAGINA}?errore=${esito.motivo}`);
}
