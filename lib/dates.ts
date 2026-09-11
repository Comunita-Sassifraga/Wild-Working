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

/** Every day of the window, in order: today through today + FINESTRA_GIORNI. */
export function giorniFinestra(adesso: Date = new Date()): DataISO[] {
  const giorni: DataISO[] = [];
  const fine = fineFinestra(adesso);
  for (let g = oggiRoma(adesso); g <= fine; g = aggiungiGiorni(g, 1)) giorni.push(g);
  return giorni;
}

/** ISO day of the week: 1 = lunedì … 7 = domenica. Matches the giorno_settimana enum. */
export function giornoSettimana(data: DataISO): number {
  const [anno, mese, giorno] = data.split("-").map(Number);
  const domenicaZero = new Date(Date.UTC(anno, mese - 1, giorno)).getUTCDay();
  return domenicaZero === 0 ? 7 : domenicaZero;
}

/**
 * The calendar of SPEC §6.2: whole weeks, from the Monday of the current
 * week to the Sunday of the week the last bookable day falls in. With
 * FINESTRA_GIORNI at 14 that is always three rows of seven days.
 *
 * Days outside the window are part of the grid on purpose: a calendar that
 * starts mid-week reads badly. The page draws them switched off.
 */
export function settimaneCalendario(adesso: Date = new Date()): DataISO[][] {
  const primo = aggiungiGiorni(oggiRoma(adesso), 1 - giornoSettimana(oggiRoma(adesso)));
  const ultimo = aggiungiGiorni(fineFinestra(adesso), 7 - giornoSettimana(fineFinestra(adesso)));
  const settimane: DataISO[][] = [];
  for (let lunedi = primo; lunedi <= ultimo; lunedi = aggiungiGiorni(lunedi, 7)) {
    settimane.push(Array.from({ length: 7 }, (_, i) => aggiungiGiorni(lunedi, i)));
  }
  return settimane;
}

/** Day of the month, for the calendar cells. */
export function giornoDelMese(data: DataISO): number {
  return Number(data.slice(8, 10));
}

// Noon UTC is the same calendar day everywhere between UTC-11 and UTC+12, so
// an ISO date turned into an instant this way never slips to the day before.
const istante = (data: DataISO) => new Date(`${data}T12:00:00Z`);

/**
 * "09:00" from the "09:00:00" the database returns for a `time` column. The
 * hours of a sede are wall-clock times, not instants: they never move with
 * the daylight saving change (§8.4).
 */
export function ora(orario: string): string {
  return orario.slice(0, 5);
}

const formatoLungo = new Intl.DateTimeFormat("it-IT", {
  timeZone: FUSO_ORARIO,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const formatoBreve = new Intl.DateTimeFormat("it-IT", {
  timeZone: FUSO_ORARIO,
  day: "numeric",
  month: "long",
});

const formatoConAnno = new Intl.DateTimeFormat("it-IT", {
  timeZone: FUSO_ORARIO,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatoMese = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO_ORARIO, month: "short" });

const formatoIstante = new Intl.DateTimeFormat("it-IT", {
  timeZone: FUSO_ORARIO,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * "3 ottobre 2026, 14:05" — for the moderation register (§5.9), the one
 * place that shows an instant rather than a booking day. Read in
 * Europe/Rome like everything else (§8.4).
 */
export function istanteEsteso(istanteIso: string): string {
  return formatoIstante.format(new Date(istanteIso));
}

/**
 * The moment a page was produced, for the notice of §8.4: the machine-
 * readable instant, which the browser compares with its own clock, and the
 * same instant written out for a person to read.
 *
 * Not window logic — nothing is decided from it — but it is read in
 * Europe/Rome like every other hour this app shows.
 */
export function istanteGenerazione(adesso: Date = new Date()): {
  iso: string;
  esteso: string;
} {
  const iso = adesso.toISOString();
  return { iso, esteso: istanteEsteso(iso) };
}

/** "ott" — shown in the calendar on the first of a month, which the window can cross. */
export function meseBreve(data: DataISO): string {
  return formatoMese.format(istante(data));
}

/** "giovedì 10 settembre" — for the heading of the chosen day. */
export function dataEstesa(data: DataISO): string {
  return formatoLungo.format(istante(data));
}

/**
 * "10 settembre", or "1 giugno 2027" when the year is not the current one.
 * A reopening date can be a season away, and "1 giugno" alone would read as
 * a date already past.
 */
export function dataBreve(data: DataISO, adesso: Date = new Date()): string {
  const stessoAnno = data.slice(0, 4) === oggiRoma(adesso).slice(0, 4);
  return (stessoAnno ? formatoBreve : formatoConAnno).format(istante(data));
}
