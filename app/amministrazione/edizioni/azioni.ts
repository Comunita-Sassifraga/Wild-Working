"use server";

/**
 * Edizioni — SPEC §15.3.1, §15.9 first bullet.
 *
 * Creating one, switching it on, switching it off. "One active at a time" is
 * not enforced here: the trigger in the database turns the others off within
 * the statement, so two editions cannot both be on even for an instant
 * (§15.12). What this file adds is the warning the spec asks for — which is
 * shown on the page, before the click, not reported after it.
 */

import { redirect } from "next/navigation";
import { accendiEdizione, creaEdizione } from "@/lib/db/abitanti";
import { amministratore } from "../guardia";

const PAGINA = "/amministrazione/edizioni";

export async function creaEdizioneAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const nome = String(formData.get("nome") ?? "").trim();
  const inizio = String(formData.get("data_inizio") ?? "").trim();
  const fine = String(formData.get("data_fine") ?? "").trim();
  if (!nome || !inizio || !fine) redirect(`${PAGINA}?errore=datiIncompleti`);
  if (fine < inizio) redirect(`${PAGINA}?errore=dateInvertite`);

  const esito = await creaEdizione(client, { nome, data_inizio: inizio, data_fine: fine });
  redirect(esito.ok ? `${PAGINA}?salvato=creata` : `${PAGINA}?errore=${esito.motivo}`);
}

export async function accendiEdizioneAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const edizioneId = String(formData.get("edizione") ?? "").trim();
  const attiva = formData.get("attiva") === "si";
  if (!edizioneId) redirect(PAGINA);

  const esito = await accendiEdizione(client, edizioneId, attiva);
  if (!esito.ok) redirect(`${PAGINA}?errore=${esito.motivo}`);
  redirect(`${PAGINA}?salvato=${attiva ? "attivata" : "disattivata"}`);
}
