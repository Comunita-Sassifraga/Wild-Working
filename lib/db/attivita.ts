/**
 * «Prenota un abitante» — the activities, as the panel sees them.
 * SPEC §15.3.2, §15.8, §15.9 (first three bullets).
 *
 * Reading goes through `attivita_amministrazione`, the third of the three
 * windows of §15.8: everything, internal notes included, and only for an
 * amministratore. Writing goes through the five functions of
 * *_attivita.sql, because the table itself is reachable by nobody (rule 24).
 *
 * Nothing here decides who may do what. Every call runs under the caller's
 * own identity and the database refuses a non-amministratore inside each
 * function (§8.3). What this module does is turn a refusal into a reason a
 * page can put into Italian.
 */

import type { Client } from "./client";
import type { Database } from "./types";

/** A card with every level of §15.8 on it. Amministratore only. */
export type Attivita = Database["public"]["Views"]["attivita_amministrazione"]["Row"];
export type StatoAttivita = Database["public"]["Enums"]["stato_attivita"];
export type ModalitaConsenso = Database["public"]["Enums"]["modalita_consenso"];

/** The closed list of two, in the order §15.8 writes them. Never widened (rule 25). */
export const MODALITA_CONSENSO = ["MODULO_CARTACEO_FIRMATO", "EMAIL_DI_CONSENSO"] as const;

export type MotivoAttivita =
  /** No card with that id — or it was changed by somebody else meanwhile. */
  | "NON_TROVATO"
  /** §15.3.2: the date must fall inside the edition. */
  | "DATA_FUORI_EDIZIONE"
  /** §15.8: the tick without one of the two forms. */
  | "MODALITA_MANCANTE"
  /** A length of §15.3.2 exceeded: optional does not mean unchecked. */
  | "TROPPO_LUNGO"
  | "NON_AUTORIZZATO"
  | "ERRORE";

export type EsitoAttivita<T = void> =
  | { ok: true; valore: T }
  | { ok: false; motivo: MotivoAttivita };

const motiviPerCodice: Record<string, MotivoAttivita> = {
  "42501": "NON_AUTORIZZATO",
  "23514": "TROPPO_LUNGO",
  AT001: "NON_TROVATO",
  AT002: "DATA_FUORI_EDIZIONE",
  AT003: "NON_TROVATO",
  AT004: "MODALITA_MANCANTE",
};

function fallito(codice: string | undefined): EsitoAttivita<never> {
  return { ok: false, motivo: (codice && motiviPerCodice[codice]) || "ERRORE" };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Every card of one edition, soonest first, the ones without a date last —
 * an unfinished card is exactly the one somebody has to come back to, so it
 * does not belong at the bottom of a list nobody scrolls (§15.3.2).
 */
export async function attivitaEdizione(client: Client, edizioneId: string): Promise<Attivita[]> {
  const { data } = await client
    .from("attivita_amministrazione")
    .select("*")
    .eq("edizione_id", edizioneId)
    .order("data", { ascending: true, nullsFirst: true })
    .order("ora_inizio", { ascending: true, nullsFirst: true })
    .order("creata_il", { ascending: true });
  return data ?? [];
}

export async function attivitaSingola(client: Client, id: string): Promise<Attivita | null> {
  const { data } = await client
    .from("attivita_amministrazione")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Writing — the five functions of §15.9
// ---------------------------------------------------------------------------

export async function creaAttivita(
  client: Client,
  edizioneId: string,
  titolo: string,
): Promise<EsitoAttivita<string>> {
  const { data, error } = await client.rpc("crea_attivita", {
    p_edizione_id: edizioneId,
    p_titolo: titolo,
  });
  if (error || !data) return fallito(error?.code);
  return { ok: true, valore: data };
}

/** The typed fields of a card. Never `stato`, never the consent tick (rule 25). */
export type DatiAttivita = {
  titolo: string;
  descrizione: string;
  abitante_nome: string;
  abitante_cognome: string;
  abitante_telefono: string;
  abitante_note_interne: string;
  luogo_generico: string;
  luogo_esatto: string;
  data: string | null;
  ora_inizio: string | null;
  ora_fine: string | null;
  capienza: number | null;
  cosa_portare: string;
  lingua_attivita: string;
};

/**
 * Saves the card whole: the form always sends every field, and a box left
 * empty on the screen is emptied in the database. Half a card is a valid
 * card since 2026-09-12 — 25 of them are typed in an evening and finished
 * the next day (§15.3.2).
 */
export async function aggiornaAttivita(
  client: Client,
  id: string,
  dati: DatiAttivita,
): Promise<EsitoAttivita<void>> {
  const { error } = await client.rpc("aggiorna_attivita", {
    p_id: id,
    p_titolo: dati.titolo,
    p_descrizione: dati.descrizione,
    p_abitante_nome: dati.abitante_nome,
    p_abitante_cognome: dati.abitante_cognome,
    p_abitante_telefono: dati.abitante_telefono,
    p_abitante_note_interne: dati.abitante_note_interne,
    p_luogo_generico: dati.luogo_generico,
    p_luogo_esatto: dati.luogo_esatto,
    p_data: dati.data ?? undefined,
    p_ora_inizio: dati.ora_inizio ?? undefined,
    p_ora_fine: dati.ora_fine ?? undefined,
    p_capienza: dati.capienza ?? undefined,
    p_cosa_portare: dati.cosa_portare,
    p_lingua_attivita: dati.lingua_attivita,
  });
  if (error) return fallito(error.code);
  return { ok: true, valore: undefined };
}

/**
 * §15.8: the tick, its form, and PUBBLICATA. The date and the amministratore
 * who ticked are written by the database from the session — a request can
 * neither supply them nor move them.
 */
export async function pubblicaAttivita(
  client: Client,
  id: string,
  modalita: ModalitaConsenso,
): Promise<EsitoAttivita<void>> {
  const { error } = await client.rpc("pubblica_attivita", { p_id: id, p_modalita: modalita });
  if (error) return fallito(error.code);
  return { ok: true, valore: undefined };
}

/** §15.12: the abitante changed his mind. Back to BOZZA; the iscritti stay. */
export async function ritiraAttivita(client: Client, id: string): Promise<EsitoAttivita<void>> {
  const { error } = await client.rpc("ritira_attivita", { p_id: id });
  if (error) return fallito(error.code);
  return { ok: true, valore: undefined };
}

/**
 * §15.12: the activity is off. Its ATTIVA iscrizioni go with it, traced in
 * `annullata_da`, and the count of people to warn comes back — until step 19
 * the panel is what says they must be told by hand.
 */
export async function annullaAttivita(
  client: Client,
  id: string,
): Promise<EsitoAttivita<number>> {
  const { data, error } = await client.rpc("annulla_attivita", { p_id: id });
  if (error) return fallito(error.code);
  return { ok: true, valore: data ?? 0 };
}

// ---------------------------------------------------------------------------
// What is still missing — §15.9 third bullet
// ---------------------------------------------------------------------------

/**
 * The fields a finished card has. The three genuinely optional ones of
 * §15.3.2 — `cosa_portare`, `lingua_attivita`, `abitante_note_interne` — are
 * not here: they may be missing from a card that is done.
 *
 * The database refuses none of these (§15.3.2). The publish screen lists
 * whichever are empty, because without a warning there an unfinished card
 * would go out published and invisible: with no date it never appears in the
 * elenco, with no capienza it takes nobody.
 */
export const CAMPI_DA_FINIRE = [
  "titolo",
  "descrizione",
  "abitante_nome",
  "abitante_cognome",
  "abitante_telefono",
  "luogo_generico",
  "luogo_esatto",
  "data",
  "ora_inizio",
  "ora_fine",
  "capienza",
] as const;

export type CampoDaFinire = (typeof CAMPI_DA_FINIRE)[number];

/** Which of them this card has not got yet, in the order of the form. */
export function campiMancanti(attivita: Attivita): CampoDaFinire[] {
  return CAMPI_DA_FINIRE.filter((campo) => {
    const valore = attivita[campo];
    return valore === null || valore === undefined || valore === "";
  });
}
