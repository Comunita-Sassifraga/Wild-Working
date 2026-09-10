"use server";

/**
 * Server Actions for the personal settings — SPEC §6.5, §6.1 point 5.
 *
 * Nothing here decides whether a name is acceptable or whether a consent was
 * given: the rules are in the database and these functions only carry the
 * refusal back to the page (§8.3). No email address is ever logged (rule 4).
 */

import { redirect } from "next/navigation";
import { clientServer } from "@/lib/db/server";
import {
  aggiornaDatiFacoltativi,
  impostaNomePubblico,
  rimuoviDatiFacoltativi,
  VALORI_ETA,
  VALORI_GENERE,
  VALORI_RESIDENZA,
  type DatiFacoltativi,
} from "@/lib/db/utenti";
import { utenteAttuale } from "@/lib/auth/sessione";

/** A value the form offered, or nothing. Never what the browser sent unchecked. */
function fraIValori<T extends string>(valori: T[], inviato: FormDataEntryValue | null): T | null {
  const testo = String(inviato ?? "");
  return valori.find((v) => v === testo) ?? null;
}

function testo(inviato: FormDataEntryValue | null): string {
  return String(inviato ?? "").trim();
}

/**
 * The welcome screen of §6.1 point 5 leads to the availability page, whether
 * the person saved or skipped; the ordinary page comes back to itself. Only
 * these two destinations exist: an address sent by the browser is never
 * followed.
 */
function destinazione(formData: FormData, coda: string): string {
  return formData.get("benvenuto") ? "/" : `/impostazioni${coda}`;
}

export async function salvaNomeAzione(formData: FormData): Promise<void> {
  const client = await clientServer();
  const esito = await impostaNomePubblico(client, {
    nome: testo(formData.get("nome")),
    mostra: formData.get("mostra") !== null,
  });

  if (!esito.ok) redirect(`/impostazioni?errore=${esito.motivo}`);
  redirect(`/impostazioni?salvato=${esito.mostra ? "nome" : "spento"}`);
}

export async function salvaDatiAzione(formData: FormData): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const valori: DatiFacoltativi = {
    eta: fraIValori(VALORI_ETA, formData.get("eta")),
    genere: fraIValori(VALORI_GENERE, formData.get("genere")),
    residenza: fraIValori(VALORI_RESIDENZA, formData.get("residenza")),
    professione: testo(formData.get("professione")) || null,
    motivo_visita: testo(formData.get("motivo_visita")) || null,
  };

  const client = await clientServer();
  const { error } = await aggiornaDatiFacoltativi(client, utente.id, valori);
  redirect(destinazione(formData, error ? "?errore=generico" : "?salvato=dati"));
}

export async function rimuoviDatiAzione(formData: FormData): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  const { error } = await rimuoviDatiFacoltativi(client, utente.id);
  redirect(destinazione(formData, error ? "?errore=generico" : "?salvato=rimossi"));
}
