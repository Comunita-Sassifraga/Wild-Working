/**
 * Booking helpers — SPEC §6.3, §6.4, §8.1.
 *
 * Creating a booking always goes through the database function
 * `prenota_posto`, which assigns the seat number under the unique index of
 * §8.1. There is no other insert path, and no read-then-write check here.
 */

import type { Client } from "./client";
import type { Database } from "./types";

export type Fascia = Database["public"]["Enums"]["fascia"];

export type RichiestaPrenotazione = {
  sedeId: string;
  /** ISO date "YYYY-MM-DD" — see lib/dates.ts. */
  data: string;
  fascia: Fascia;
};

export type MotivoRifiuto =
  | "POSTI_ESAURITI"
  | "PRENOTAZIONE_DUPLICATA"
  | "SEDE_NON_DISPONIBILE"
  | "ACCESSO_RICHIESTO"
  | "ERRORE";

export type EsitoPrenotazione =
  | { ok: true; id: string }
  | { ok: false; motivo: MotivoRifiuto; codice?: string };

// SQLSTATE codes raised by prenota_posto (see the migration).
const motiviPerCodice: Record<string, MotivoRifiuto> = {
  PS001: "POSTI_ESAURITI",
  PS002: "PRENOTAZIONE_DUPLICATA",
  PS003: "SEDE_NON_DISPONIBILE",
  "28000": "ACCESSO_RICHIESTO",
};

/** Books one seat in the caller's own name. Never throws on a refusal. */
export async function prenotaPosto(
  client: Client,
  richiesta: RichiestaPrenotazione,
): Promise<EsitoPrenotazione> {
  const { data, error } = await client.rpc("prenota_posto", {
    p_sede_id: richiesta.sedeId,
    p_data: richiesta.data,
    p_fascia: richiesta.fascia,
  });
  if (error) {
    return { ok: false, motivo: motiviPerCodice[error.code] ?? "ERRORE", codice: error.code };
  }
  return { ok: true, id: data };
}

/**
 * Cancels one of the caller's active bookings. RLS makes it a no-op on
 * anyone else's row, so the result tells whether a row was actually changed.
 */
export async function annullaPrenotazione(
  client: Client,
  prenotazioneId: string,
): Promise<{ ok: boolean }> {
  const { data, error } = await client
    .from("prenotazioni")
    .update({ stato: "ANNULLATA" })
    .eq("id", prenotazioneId)
    .select("id");
  if (error) return { ok: false };
  return { ok: (data?.length ?? 0) === 1 };
}

/** Columns a person may read about their own bookings. posto_progressivo is never among them. */
export const colonnePrenotazione =
  "id, sede_id, data, fascia, gruppo_id, stato, creata_il" as const;

export async function miePrenotazioni(client: Client) {
  return client.from("prenotazioni").select(colonnePrenotazione).order("data");
}
