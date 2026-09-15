/**
 * «Prenota un abitante» — editions, codes and abilitazioni.
 * SPEC §15.3.1, §15.3.4, §15.3.5, §15.4, §15.9.
 *
 * Nothing here decides who may do what: every call runs under the caller's
 * RLS identity, and the functions of *_codici.sql refuse a non-amministratore
 * inside the database (§8.3). This module turns a refusal into a reason the
 * page can put into Italian.
 *
 * No code in clear is ever logged, returned in an error, or put into an
 * address (rule 23). `generaCodici` is the one function that holds codes at
 * all, and it hands them straight to the screen that prints them.
 */

import { MAX_TENTATIVI_CODICE_ORA } from "@/config/limits";
import { improntaCodice, nuovoCodice } from "@/lib/abitanti/codici";
import type { Client } from "./client";
import type { Database } from "./types";

export type Edizione = Database["public"]["Tables"]["edizioni"]["Row"];
export type CodiceElencato = Database["public"]["Views"]["codici_amministrazione"]["Row"];
export type AbilitazioneElencata =
  Database["public"]["Views"]["abilitazioni_amministrazione"]["Row"];

/** What went wrong, in terms the page can turn into a sentence. */
export type MotivoAbitanti =
  /** No edition switched on and current: the module is shut (§15.3.1). */
  | "NESSUNA_EDIZIONE"
  /** A card that has already been used: revoke the abilitazione instead (§15.4). */
  | "CODICE_GIA_USATO"
  /** Nothing with that id — a card, an edition or an abilitazione. */
  | "NON_TROVATO"
  /** The edition still has attivita or abilitazioni hanging off it. */
  | "EDIZIONE_IN_USO"
  | "NON_AUTORIZZATO"
  | "ERRORE";

export type EsitoAbitanti<T = void> =
  | { ok: true; valore: T }
  | { ok: false; motivo: MotivoAbitanti };

const CHIAVE_ESTERNA = "23503";
const PERMESSO_NEGATO = "42501";

const motiviPerCodice: Record<string, MotivoAbitanti> = {
  [CHIAVE_ESTERNA]: "EDIZIONE_IN_USO",
  [PERMESSO_NEGATO]: "NON_AUTORIZZATO",
  CD001: "ERRORE",
  CD002: "NON_TROVATO",
  CD003: "NON_TROVATO",
  CD004: "CODICE_GIA_USATO",
  CD005: "NESSUNA_EDIZIONE",
  CD006: "NON_TROVATO",
  CD007: "NON_TROVATO",
};

function fallito(codice: string | undefined): EsitoAbitanti<never> {
  return { ok: false, motivo: (codice && motiviPerCodice[codice]) || "ERRORE" };
}

// ---------------------------------------------------------------------------
// Edizioni — §15.3.1, §15.9 first bullet
// ---------------------------------------------------------------------------

/** Every edition, newest first. Only an amministratore sees the inactive ones. */
export async function edizioniTutte(client: Client): Promise<Edizione[]> {
  const { data } = await client.from("edizioni").select("*").order("data_inizio", { ascending: false });
  return data ?? [];
}

/**
 * The edition that is switched on AND current today (§15.3.1). The same
 * answer the database gives its own policies, asked through the same
 * function: a page and a policy can never disagree about whether the module
 * is open.
 */
export async function edizioneAttiva(client: Client): Promise<string | null> {
  const { data, error } = await client.rpc("edizione_attiva");
  return error ? null : (data ?? null);
}

export type DatiEdizione = {
  nome: string;
  data_inizio: string;
  data_fine: string;
};

export async function creaEdizione(
  client: Client,
  dati: DatiEdizione,
): Promise<EsitoAbitanti<string>> {
  const { data, error } = await client.from("edizioni").insert(dati).select("id").single();
  if (error || !data) return fallito(error?.code);
  return { ok: true, valore: data.id };
}

/**
 * The switch of §15.3.1. Turning one on turns every other off — the trigger
 * in the database does it, so two editions cannot both be on even for the
 * length of a statement.
 */
export async function accendiEdizione(
  client: Client,
  edizioneId: string,
  attiva: boolean,
): Promise<EsitoAbitanti<void>> {
  const { data, error } = await client
    .from("edizioni")
    .update({ attiva })
    .eq("id", edizioneId)
    .select("id");
  if (error) return fallito(error.code);
  if (!data || data.length === 0) return { ok: false, motivo: "NON_AUTORIZZATO" };
  return { ok: true, valore: undefined };
}

// ---------------------------------------------------------------------------
// Codici — §15.3.5, §15.4, §15.9 fourth bullet
// ---------------------------------------------------------------------------

/** A card as the print screen shows it: the number, and the code, once. */
export type CartoncinoGenerato = { progressivo: number; codice: string };

/**
 * Generates `quanti` cards for an edition and gives them back in clear —
 * the only moment they exist outside somebody's pocket (§15.3.5).
 *
 * The codes are made here, fingerprinted here, and only the fingerprints go
 * to the database, which answers with the number it gave each one. The
 * pairing back is by fingerprint: the order of the numbers is the database's
 * business, not ours.
 *
 * A repeat within one call would silently give two people the same card, so
 * duplicates are drawn again rather than sent; across calls the unique index
 * on `impronta` is what refuses.
 *
 * The key is passed in rather than read from the environment here, the same
 * way `richiediLink` takes it (lib/auth/accesso.ts): this module stays a
 * translator between the database and a page, and the secret is the caller's
 * to produce.
 */
export async function generaCodici(
  client: Client,
  edizioneId: string,
  quanti: number,
  chiave: string,
): Promise<EsitoAbitanti<CartoncinoGenerato[]>> {
  const perImpronta = new Map<string, string>();
  while (perImpronta.size < quanti) {
    const codice = nuovoCodice();
    perImpronta.set(improntaCodice(codice, chiave), codice);
  }

  const { data, error } = await client.rpc("genera_codici", {
    p_edizione_id: edizioneId,
    p_impronte: [...perImpronta.keys()],
  });
  if (error || !data) return fallito(error?.code);

  const cartoncini = data
    .map((riga) => ({
      progressivo: riga.progressivo,
      codice: perImpronta.get(riga.impronta) ?? "",
    }))
    .sort((a, b) => a.progressivo - b.progressivo);
  return { ok: true, valore: cartoncini };
}

/** The cards of an edition, by number. Never their fingerprints, never a code. */
export async function codiciEdizione(
  client: Client,
  edizioneId: string,
): Promise<CodiceElencato[]> {
  const { data } = await client
    .from("codici_amministrazione")
    .select("*")
    .eq("edizione_id", edizioneId)
    .order("progressivo");
  return data ?? [];
}

/** §15.4: revoking a card that was lost. Only one not yet used. */
export async function revocaCodice(
  client: Client,
  codiceId: string,
): Promise<EsitoAbitanti<void>> {
  const { error } = await client.rpc("revoca_codice", { p_codice_id: codiceId });
  if (error) return fallito(error.code);
  return { ok: true, valore: undefined };
}

// ---------------------------------------------------------------------------
// Abilitazioni — §15.3.4, §15.4, §15.9 fifth bullet
// ---------------------------------------------------------------------------

export async function abilitazioniEdizione(
  client: Client,
  edizioneId: string,
): Promise<AbilitazioneElencata[]> {
  const { data } = await client
    .from("abilitazioni_amministrazione")
    .select("*")
    .eq("edizione_id", edizioneId)
    .order("attivata_il", { ascending: false });
  return data ?? [];
}

/**
 * §15.4: enabling somebody already registered, by hand. Re-enabling a person
 * who was revoked switches their existing row back on (§15.3.4).
 */
export async function abilitaUtente(
  client: Client,
  utenteId: string,
): Promise<EsitoAbitanti<string>> {
  const { data, error } = await client.rpc("abilita_utente", { p_utente_id: utenteId });
  if (error || !data) return fallito(error?.code);
  return { ok: true, valore: data };
}

/**
 * §15.4: the punctual revocation. It never cancels an iscrizione — those
 * stay, and stop being changeable by the person concerned.
 */
export async function revocaAbilitazione(
  client: Client,
  abilitazioneId: string,
): Promise<EsitoAbitanti<void>> {
  const { error } = await client.rpc("revoca_abilitazione", {
    p_abilitazione_id: abilitazioneId,
  });
  if (error) return fallito(error.code);
  return { ok: true, valore: undefined };
}

/** Does the caller hold an active abilitazione for the active edition? (rule 22) */
export async function sonoAbilitato(client: Client): Promise<boolean> {
  const { data, error } = await client.rpc("ha_abilitazione");
  return !error && data === true;
}

// ---------------------------------------------------------------------------
// Consumo del codice — §15.4
// ---------------------------------------------------------------------------

/**
 * What happened, in the words the database answers with. The page of §15.6
 * turns each into one sentence, and `RIFIUTATO` covers unknown, already used
 * by somebody else, revoked and belonging to another edition — one refusal,
 * one message.
 */
export type EsitoCodice =
  | "ABILITATO"
  | "GIA_ABILITATO"
  | "RIFIUTATO"
  | "TROPPI_TENTATIVI"
  | "MODULO_CHIUSO"
  | "ERRORE";

/**
 * Turns a code somebody typed into an abilitazione (§15.4).
 *
 * The code is fingerprinted here and never leaves this function in clear:
 * not into the database, not into an address, not into an error. What comes
 * back is a word, never the code and never which of the refusals it was.
 */
export async function consumaCodice(
  client: Client,
  scritto: string,
  chiave: string,
): Promise<EsitoCodice> {
  const { data, error } = await client.rpc("consuma_codice", {
    p_impronta: improntaCodice(scritto, chiave),
    p_max_tentativi: MAX_TENTATIVI_CODICE_ORA,
  });
  if (error || !data) return "ERRORE";
  return data as EsitoCodice;
}
