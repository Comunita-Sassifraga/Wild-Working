"use server";

/**
 * Cartoncini — SPEC §15.3.5, §15.4, §15.9 fourth bullet.
 *
 * Two actions with two different shapes, and the difference is the point.
 *
 * Revoking redirects, like every other write in the panel: the result is a
 * fact in the database and the address can carry it.
 *
 * Generating cannot. The codes exist for the length of one response and are
 * never stored anywhere (rule 23), so they have to come back inside that
 * response — never through a redirect, which would mean putting them in an
 * address that the browser keeps, the history keeps and a proxy may log.
 * That is why this one returns a value to a client component instead.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { edizioneAttiva, generaCodici, revocaCodice } from "@/lib/db/abitanti";
import { envServer } from "@/lib/env";
import { amministratore } from "../guardia";
import { MAX_CARTONCINI, type EsitoGenerazione } from "./costanti";

const PAGINA = "/amministrazione/codici";

export async function generaCodiciAzione(
  _precedente: EsitoGenerazione,
  formData: FormData,
): Promise<EsitoGenerazione> {
  const { client } = await amministratore();
  const quanti = Number(formData.get("quanti"));
  if (!Number.isInteger(quanti) || quanti < 1 || quanti > MAX_CARTONCINI) {
    return { cartoncini: [], errore: "quantiNonValido" };
  }

  // The edition is read here and not taken from the form: what the panel
  // generates for is the active edition, whatever a request may claim.
  const edizione = await edizioneAttiva(client);
  if (!edizione) return { cartoncini: [], errore: "NESSUNA_EDIZIONE" };

  const esito = await generaCodici(client, edizione, quanti, envServer().chiaveImpronte);
  if (!esito.ok) return { cartoncini: [], errore: esito.motivo };

  // The list below the form is server-rendered: this is what makes the new
  // numbers appear in it. The codes themselves are not in that list and
  // never will be — only their numbers.
  revalidatePath(PAGINA);
  return { cartoncini: esito.valore };
}

export async function revocaCodiceAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const codiceId = String(formData.get("codice") ?? "").trim();
  if (!codiceId) redirect(PAGINA);

  const esito = await revocaCodice(client, codiceId);
  redirect(esito.ok ? `${PAGINA}?salvato=revocato` : `${PAGINA}?errore=${esito.motivo}`);
}
