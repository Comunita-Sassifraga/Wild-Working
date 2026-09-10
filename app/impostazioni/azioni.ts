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

export async function salvaNomeAzione(formData: FormData): Promise<void> {
  const client = await clientServer();
  const esito = await impostaNomePubblico(client, {
    nome: testo(formData.get("nome")),
    mostra: formData.get("mostra") !== null,
  });

  if (!esito.ok) redirect(`/impostazioni?errore=${esito.motivo}`);
  redirect(`/impostazioni?salvato=${esito.mostra ? "nome" : "spento"}`);
}

/** Saves any subset of the five fields; absent keys are left untouched. */
async function salvaFacoltativi(formData: FormData, utenteId: string): Promise<boolean> {
  const valori: DatiFacoltativi = {
    eta: fraIValori(VALORI_ETA, formData.get("eta")),
    genere: fraIValori(VALORI_GENERE, formData.get("genere")),
    residenza: fraIValori(VALORI_RESIDENZA, formData.get("residenza")),
    professione: testo(formData.get("professione")) || null,
    motivo_visita: testo(formData.get("motivo_visita")) || null,
  };
  const client = await clientServer();
  const { error } = await aggiornaDatiFacoltativi(client, utenteId, valori);
  return error === null;
}

export async function salvaDatiAzione(formData: FormData): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const ok = await salvaFacoltativi(formData, utente.id);
  redirect(ok ? "/impostazioni?salvato=dati" : "/impostazioni?errore=generico");
}

/**
 * The one screen of §6.1 point 5 saves the public name and the five optional
 * fields together. The fields go first: if the name is refused, what the
 * person did fill in is already kept, and only the name is asked again. The
 * refused name is not carried back in the address — an address bar is the
 * one place a rejected name must never end up (rule 4).
 */
export async function salvaBenvenutoAzione(formData: FormData): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const ok = await salvaFacoltativi(formData, utente.id);

  const client = await clientServer();
  const nome = await impostaNomePubblico(client, {
    nome: testo(formData.get("nome")),
    mostra: formData.get("mostra") !== null,
  });

  if (!nome.ok) redirect(`/impostazioni?benvenuto=1&errore=${nome.motivo}`);
  if (!ok) redirect("/impostazioni?benvenuto=1&errore=generico");
  redirect("/");
}

export async function rimuoviDatiAzione(): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  const { error } = await rimuoviDatiFacoltativi(client, utente.id);
  redirect(error ? "/impostazioni?errore=generico" : "/impostazioni?salvato=rimossi");
}
