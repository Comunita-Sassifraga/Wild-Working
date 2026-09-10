"use server";

/**
 * Server Actions for the personal settings — SPEC §6.5, §6.1 point 5.
 *
 * Nothing here decides whether a name is acceptable or whether a consent was
 * given: the rules are in the database and these functions only carry the
 * refusal back to the page (§8.3). No email address is ever logged (rule 4).
 */

import { redirect } from "next/navigation";
import { after } from "next/server";
import { clientServer } from "@/lib/db/server";
import { avvisaModerazione } from "@/lib/posta/avvisi";
import {
  aggiornaDatiFacoltativi,
  impostaNomePubblico,
  rimuoviDatiFacoltativi,
  segnaAvvisoModerazioneLetto,
  VALORI_ETA,
  VALORI_GENERE,
  VALORI_RESIDENZA,
  type DatiFacoltativi,
  type EsitoNomePubblico,
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
 * One save for the whole page — the public name and the five optional
 * fields together, from the settings and from the first-access screen alike.
 *
 * The fields go first, and on purpose. The name can be refused (too long, a
 * link, a blocklisted term, one change too many today); the five fields never
 * can. Saving them first means a refused name never takes with it what the
 * person had already filled in: only the name is asked again.
 *
 * The refused name is not carried back in the address — an address bar is the
 * one place a rejected name must never end up (rule 4).
 *
 * Re-saving costs nothing: the database counts a change of the name only when
 * the text really differs (§6.5), and writes a consent row only when the five
 * fields cross between empty and filled (§5.5). So pressing Salva after
 * touching one field does not consume a daily change, and does not log a
 * consent that was already given.
 */
async function salva(
  formData: FormData,
  utenteId: string,
): Promise<{ datiOk: boolean; nome: EsitoNomePubblico }> {
  const valori: DatiFacoltativi = {
    eta: fraIValori(VALORI_ETA, formData.get("eta")),
    genere: fraIValori(VALORI_GENERE, formData.get("genere")),
    residenza: fraIValori(VALORI_RESIDENZA, formData.get("residenza")),
    professione: testo(formData.get("professione")) || null,
    motivo_visita: testo(formData.get("motivo_visita")) || null,
  };

  const client = await clientServer();
  const { error } = await aggiornaDatiFacoltativi(client, utenteId, valori);
  const nome = await impostaNomePubblico(client, {
    nome: testo(formData.get("nome")),
    mostra: formData.get("mostra") !== null,
  });

  // Moderation notice, §6.5 level 2. Only when the text of the name really
  // changed — the database says so, this file does not guess — and only when
  // a name is left: clearing one's own name warns nobody.
  //
  // After the answer, not before it: the save is done, and nobody has to wait
  // on a mail provider to be told so. A notice that does not go out changes
  // nothing for the person, and level 3 stays available to the amministratore.
  if (nome.ok && nome.cambiato && nome.nome) {
    const avviso = { nomePubblico: nome.nome, utenteId };
    after(async () => {
      await avvisaModerazione(avviso);
    });
  }

  return { datiOk: error === null, nome };
}

export async function salvaImpostazioniAzione(formData: FormData): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const { datiOk, nome } = await salva(formData, utente.id);

  // `restoSalvato` tells the person, in the same sentence as the refusal,
  // that only the name is left to fix.
  if (!nome.ok) {
    redirect(`/impostazioni?errore=${nome.motivo}${datiOk ? "&restoSalvato=1" : ""}`);
  }
  if (!datiOk) redirect("/impostazioni?errore=generico");
  redirect("/impostazioni?salvato=tutto");
}

export async function salvaBenvenutoAzione(formData: FormData): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const { datiOk, nome } = await salva(formData, utente.id);

  if (!nome.ok) {
    redirect(`/impostazioni?benvenuto=1&errore=${nome.motivo}${datiOk ? "&restoSalvato=1" : ""}`);
  }
  if (!datiOk) redirect("/impostazioni?benvenuto=1&errore=generico");
  redirect("/");
}

/**
 * Closes the notice of §6.5 — the message a person reads when an
 * amministratore has removed their public name. It stays until they close
 * it: shown once and gone would mean shown to nobody if they were not
 * looking at this page that day.
 */
export async function chiudiAvvisoModerazioneAzione(): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  await segnaAvvisoModerazioneLetto(client, utente.id);
  redirect("/impostazioni");
}

export async function rimuoviDatiAzione(): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  const { error } = await rimuoviDatiFacoltativi(client, utente.id);
  redirect(error ? "/impostazioni?errore=generico" : "/impostazioni?salvato=rimossi");
}
