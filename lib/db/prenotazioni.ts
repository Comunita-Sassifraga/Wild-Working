/**
 * Booking helpers — SPEC §6.3, §6.4, §8.1.
 *
 * Creating a booking always goes through the database functions
 * `prenota_posto` and `prenota_giornata`, which assign the seat number under
 * the unique index of §8.1 and apply the five conditions of §5.2 through
 * `sede_prenotabile()`. There is no other insert path, and no read-then-write
 * check here (rule 5): nothing in this file decides whether a slot is free.
 *
 * Cancelling is an update of `stato` alone. The deadline of §6.4 — until the
 * fascia begins — is part of the access policy, so a late cancellation
 * changes no row and comes back as a refusal.
 */

import type { DataISO } from "@/lib/dates";
import type { Client } from "./client";
import type { Database } from "./types";

export type Fascia = Database["public"]["Enums"]["fascia"];

/** The two fasce, in the order they are shown. Never a third value (§3). */
export const FASCE: Fascia[] = ["MATTINA", "POMERIGGIO"];

export type RichiestaPrenotazione = {
  sedeId: string;
  /** ISO date "YYYY-MM-DD" — see lib/dates.ts. */
  data: DataISO;
  fascia: Fascia;
};

export type MotivoRifiuto =
  | "POSTI_ESAURITI"
  | "PRENOTAZIONE_DUPLICATA"
  | "SEDE_NON_DISPONIBILE"
  | "FUORI_FINESTRA"
  | "SEDE_CHIUSA"
  | "GIORNATA_INCOMPLETA"
  | "ACCESSO_RICHIESTO"
  | "ERRORE";

export type EsitoPrenotazione =
  | { ok: true; id: string }
  | {
      ok: false;
      motivo: MotivoRifiuto;
      codice?: string;
      /** For GIORNATA_INCOMPLETA: the fascia that was full (§6.3). */
      fasciaPiena?: Fascia;
    };

// SQLSTATE codes raised by prenota_slot (see the migrations).
const motiviPerCodice: Record<string, MotivoRifiuto> = {
  PS001: "POSTI_ESAURITI",
  PS002: "PRENOTAZIONE_DUPLICATA",
  PS003: "SEDE_NON_DISPONIBILE",
  PS004: "FUORI_FINESTRA",
  PS005: "SEDE_CHIUSA",
  PS006: "GIORNATA_INCOMPLETA",
  "28000": "ACCESSO_RICHIESTO",
};

type ErroreDb = { code: string; hint?: string | null };

function rifiuto(error: ErroreDb): EsitoPrenotazione {
  const motivo = motiviPerCodice[error.code] ?? "ERRORE";
  const fasciaPiena = FASCE.find((f) => f === error.hint);
  return { ok: false, motivo, codice: error.code, ...(fasciaPiena ? { fasciaPiena } : {}) };
}

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
  if (error) return rifiuto(error);
  return { ok: true, id: data };
}

/**
 * Books both fasce of a day, sharing one `gruppo_id` (§3). All or nothing:
 * if one fascia is full nothing is created, and the refusal says which
 * (§6.3). The returned id is the gruppo_id.
 */
export async function prenotaGiornata(
  client: Client,
  richiesta: Omit<RichiestaPrenotazione, "fascia">,
): Promise<EsitoPrenotazione> {
  const { data, error } = await client.rpc("prenota_giornata", {
    p_sede_id: richiesta.sedeId,
    p_data: richiesta.data,
  });
  if (error) return rifiuto(error);
  return { ok: true, id: data };
}

/**
 * Cancels one of the caller's active bookings. The policy makes it a no-op on
 * anyone else's row and on a fascia that has already begun, so the result
 * tells whether a row was actually changed.
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

/**
 * Cancels both fasce of a giornata intera (§6.4). Cancelling a single fascia
 * of a whole day stays possible through annullaPrenotazione: the page offers
 * both, and the whole day is what the button does by default.
 */
export async function annullaGiornata(
  client: Client,
  gruppoId: string,
): Promise<{ ok: boolean; annullate: number }> {
  const { data, error } = await client
    .from("prenotazioni")
    .update({ stato: "ANNULLATA" })
    .eq("gruppo_id", gruppoId)
    .eq("stato", "ATTIVA")
    .select("id");
  const annullate = data?.length ?? 0;
  if (error) return { ok: false, annullate: 0 };
  return { ok: annullate > 0, annullate };
}

/** One booking as "Le mie prenotazioni" shows it (§6.4). */
export type MiaPrenotazione = {
  id: string;
  sedeId: string;
  data: DataISO;
  fascia: Fascia;
  gruppoId: string | null;
  sedeNome: string;
  comune: string;
  indirizzo: string | null;
  note: string | null;
  oraInizio: string;
  oraFine: string;
  /** False once the fascia has begun: the row is shown without its button (§6.4). */
  annullabile: boolean;
};

/**
 * The caller's active bookings, today through the end of the window. The view
 * pins the rows to the caller inside the database: no filter here is what
 * keeps another person's booking out (rule 3, §8.3).
 */
export async function miePrenotazioni(client: Client): Promise<MiaPrenotazione[]> {
  const { data, error } = await client
    .from("mie_prenotazioni")
    // One literal: the client reads the column list at compile time to type the rows.
    // prettier-ignore
    .select("id, sede_id, data, fascia, gruppo_id, sede_nome, comune, indirizzo, note, ora_inizio, ora_fine, annullabile")
    .order("data")
    .order("fascia");
  if (error || !data) return [];
  return data.flatMap((r) =>
    r.id === null || r.data === null || r.fascia === null || r.sede_id === null
      ? []
      : [
          {
            id: r.id,
            sedeId: r.sede_id,
            data: r.data,
            fascia: r.fascia,
            gruppoId: r.gruppo_id,
            sedeNome: r.sede_nome ?? "",
            comune: r.comune ?? "",
            indirizzo: r.indirizzo,
            note: r.note,
            oraInizio: r.ora_inizio ?? "",
            oraFine: r.ora_fine ?? "",
            annullabile: r.annullabile ?? false,
          },
        ],
  );
}
