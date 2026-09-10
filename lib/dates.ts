/**
 * Date helpers — the single place where "today" and the booking window are
 * computed (CLAUDE.md conventions, SPEC §8.4). Always Europe/Rome, never UTC.
 *
 * Dates are handled as ISO strings "YYYY-MM-DD" to match the `date` column
 * type: a booking slot is a calendar day plus a fascia, never a timestamp.
 */

import { FINESTRA_GIORNI, FUSO_ORARIO } from "@/config/limits";

export type DataISO = string;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_ORARIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date of an instant, as seen from Europe/Rome. */
export function dataRoma(istante: Date): DataISO {
  return formatter.format(istante);
}

/** Today's date in Europe/Rome. Pass `adesso` only from tests. */
export function oggiRoma(adesso: Date = new Date()): DataISO {
  return dataRoma(adesso);
}

/** Adds whole days to an ISO date, without any timezone involvement. */
export function aggiungiGiorni(data: DataISO, giorni: number): DataISO {
  const [anno, mese, giorno] = data.split("-").map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno + giorni));
  return d.toISOString().slice(0, 10);
}

/** Last bookable date: today + FINESTRA_GIORNI, inclusive (D8). */
export function fineFinestra(adesso: Date = new Date()): DataISO {
  return aggiungiGiorni(oggiRoma(adesso), FINESTRA_GIORNI);
}

/** True when `data` lies inside the rolling window [today, today + FINESTRA_GIORNI]. */
export function inFinestra(data: DataISO, adesso: Date = new Date()): boolean {
  return data >= oggiRoma(adesso) && data <= fineFinestra(adesso);
}
