"use server";

/**
 * Adding a sede — SPEC §6.7 first bullet, rule 11: a sede is a row, never a
 * line of code, and adding one must take a minute and no deploy.
 *
 * The refusal comes from the database (only an amministratore may insert);
 * this file turns it into a reason the page puts into Italian.
 */

import { redirect } from "next/navigation";
import { creaSede } from "@/lib/db/amministrazione";
import { amministratore } from "../guardia";

export async function creaSedeAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();

  const nome = String(formData.get("nome") ?? "").trim();
  const comune = String(formData.get("comune") ?? "").trim();
  const capienza = Number(formData.get("capienza"));

  if (!nome || !comune || !Number.isInteger(capienza) || capienza < 0) {
    redirect("/amministrazione/sedi?errore=datiIncompleti");
  }

  const esito = await creaSede(client, { nome, comune, capienza });
  if (!esito.ok) redirect(`/amministrazione/sedi?errore=${esito.motivo}`);
  redirect(`/amministrazione/sedi/${esito.valore}?salvato=creata`);
}
