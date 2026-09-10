/**
 * Profile helpers — SPEC §5.1, §6.5.
 *
 * The five optional fields are edited only here. Consent rows are written
 * by the database (trigger registra_consensi), never by this module, and so
 * is every rule about the public name: this file translates refusals into
 * reasons, it does not decide them (§8.3).
 */

import { MAX_CAMBI_NOME_GIORNO } from "@/config/limits";
import type { Client } from "./client";
import type { Database } from "./types";

type RigaUtente = Database["public"]["Tables"]["utenti"]["Row"];

/** The values each of the three closed optional fields may take (§5.1). */
export const VALORI_ETA: Database["public"]["Enums"]["fascia_eta"][] = [
  "18-25",
  "26-35",
  "36-50",
  "51-65",
  "Oltre 65",
];
export const VALORI_GENERE: Database["public"]["Enums"]["genere"][] = [
  "M",
  "F",
  "Preferisco non rispondere",
];
export const VALORI_RESIDENZA: Database["public"]["Enums"]["residenza"][] = [
  "Valle Soana",
  "Canavese",
  "Piemonte",
  "Italia",
  "Altro",
];

/** Field lengths of §5.1, mirrored by check constraints in the database. */
export const MAX_CARATTERI_NOME = 40;
export const MAX_CARATTERI_PROFESSIONE = 100;
export const MAX_CARATTERI_MOTIVO = 200;

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
  "id, email, nome_pubblico, eta, genere, professione, motivo_visita, residenza, mostra_nome_pubblico, lingua, creato_il, ultimo_accesso, avviso_moderazione" as const;

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

/**
 * Clears the notice of §6.5 — "Lo stesso messaggio compare nelle
 * impostazioni personali al primo accesso successivo" — once the person has
 * read it. Only their own row: the update policy on `utenti` scopes every
 * write to auth.uid(), so nobody can silence somebody else's notice.
 */
export async function segnaAvvisoModerazioneLetto(client: Client, utenteId: string) {
  return client
    .from("utenti")
    .update({ avviso_moderazione: null })
    .eq("id", utenteId)
    .select("id")
    .single();
}

/**
 * Turns the public-name switch on or off (§6.5), without touching the name.
 * A plain update: the switch sends no notice and consumes no daily change.
 */
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

export type MotivoRifiutoNome =
  /** More than MAX_CARATTERI_NOME characters. */
  | "TROPPO_LUNGO"
  /** Carries a link, an email address or a phone number (§6.5). */
  | "CONTIENE_CONTATTO"
  /** Matches the blocklist. The person is told nothing more (§6.5). */
  | "NON_CONSENTITO"
  /** Over MAX_CAMBI_NOME_GIORNO for today (§6.5, §10). */
  | "TROPPI_CAMBI"
  | "ACCESSO_RICHIESTO"
  | "ERRORE";

export type EsitoNomePubblico =
  | {
      ok: true;
      nome: string | null;
      mostra: boolean;
      /**
       * True when the save really changed the text of the name — exactly when
       * the moderation notice of §6.5 goes out. Re-saving the same name, or
       * flipping the switch, leaves it false and sends nothing.
       */
      cambiato: boolean;
    }
  | { ok: false; motivo: MotivoRifiutoNome; codice?: string };

// SQLSTATE codes raised by the database (see *_nome_pubblico.sql).
const motiviPerCodice: Record<string, MotivoRifiutoNome> = {
  NP001: "TROPPO_LUNGO",
  NP002: "CONTIENE_CONTATTO",
  NP003: "NON_CONSENTITO",
  NP004: "TROPPI_CAMBI",
  "28000": "ACCESSO_RICHIESTO",
};

/**
 * Saves the public name and the switch together — the single write path for
 * the name (§6.5). The daily limit lives in the database and is told the
 * value from config/limits.ts: one source of truth, no mirror.
 */
export async function impostaNomePubblico(
  client: Client,
  scelta: { nome: string; mostra: boolean },
): Promise<EsitoNomePubblico> {
  const { data, error } = await client.rpc("imposta_nome_pubblico", {
    p_nome: scelta.nome,
    p_mostra: scelta.mostra,
    p_max_cambi: MAX_CAMBI_NOME_GIORNO,
  });
  if (error) return { ok: false, motivo: motiviPerCodice[error.code] ?? "ERRORE", codice: error.code };
  const riga = data?.[0];
  return {
    ok: true,
    nome: riga?.nome_pubblico ?? null,
    mostra: riga?.mostra_nome_pubblico ?? false,
    cambiato: riga?.cambiato ?? false,
  };
}

/**
 * The address of one person, for the mail layer alone (§6.5: the clear action
 * "invia in automatico l'avviso all'utente"). Takes the backend client,
 * because the amministratore's own session cannot read another person's
 * email, and must not — the moderation screen reads a view without the
 * column (§6.7).
 *
 * The value goes straight into an envelope: it is never returned to a page,
 * never put in an address bar, never logged (rule 4).
 */
export async function emailPerAvviso(client: Client, utenteId: string): Promise<string | null> {
  const { data } = await client.from("utenti").select("email").eq("id", utenteId).maybeSingle();
  return data?.email ?? null;
}
