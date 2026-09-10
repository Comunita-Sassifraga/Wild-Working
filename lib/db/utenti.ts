/**
 * Profile helpers — SPEC §5.1, §6.5.
 *
 * The five optional fields are edited only here. Consent rows are written
 * by the database (trigger registra_consensi), never by this module.
 */

import type { Client } from "./client";
import type { Database } from "./types";

type RigaUtente = Database["public"]["Tables"]["utenti"]["Row"];

/** The closed list of consent-based statistical fields (dati_facoltativi). */
export const CAMPI_FACOLTATIVI = [
  "eta",
  "genere",
  "professione",
  "motivo_visita",
  "residenza",
] as const;

export type CampoFacoltativo = (typeof CAMPI_FACOLTATIVI)[number];
export type DatiFacoltativi = Pick<RigaUtente, CampoFacoltativo>;

/** Columns of the caller's own profile. */
export const colonneProfilo =
  "id, email, nome_pubblico, eta, genere, professione, motivo_visita, residenza, mostra_nome_pubblico, lingua, creato_il, ultimo_accesso" as const;

export async function mioProfilo(client: Client, utenteId: string) {
  return client.from("utenti").select(colonneProfilo).eq("id", utenteId).single();
}

/** Saves any subset of the five fields. Absent keys are left untouched. */
export async function aggiornaDatiFacoltativi(
  client: Client,
  utenteId: string,
  valori: Partial<DatiFacoltativi>,
) {
  const consentiti: Partial<DatiFacoltativi> = {};
  for (const campo of CAMPI_FACOLTATIVI) {
    if (campo in valori) {
      // Each key is assigned from the same key of `valori`: types line up.
      (consentiti as Record<string, unknown>)[campo] = valori[campo] ?? null;
    }
  }
  return client.from("utenti").update(consentiti).eq("id", utenteId).select(colonneProfilo).single();
}

/**
 * "Rimuovi i miei dati facoltativi" (§6.5): empties all five fields at once.
 * The database records the DATI_FACOLTATIVI revocation.
 */
export async function rimuoviDatiFacoltativi(client: Client, utenteId: string) {
  return aggiornaDatiFacoltativi(client, utenteId, {
    eta: null,
    genere: null,
    professione: null,
    motivo_visita: null,
    residenza: null,
  });
}

/** Turns the public-name switch on or off (§6.5). Name validation and moderation arrive at step 6. */
export async function impostaMostraNomePubblico(
  client: Client,
  utenteId: string,
  mostra: boolean,
) {
  return client
    .from("utenti")
    .update({ mostra_nome_pubblico: mostra })
    .eq("id", utenteId)
    .select("id, mostra_nome_pubblico")
    .single();
}
