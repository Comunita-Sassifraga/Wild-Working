/**
 * Availability view model — SPEC §6.2.
 *
 * Pure functions over the rows of `disponibilita_pubblica`: they turn counts
 * into the states the page draws. Nothing here decides whether a sede is
 * bookable — that is `sede_prenotabile()` in the database, the single source
 * of truth for the five conditions of §5.2 (CLAUDE.md conventions). This
 * module only chooses what to say about a slot the database already judged.
 *
 * Every state has a text label in the page: colour never carries meaning
 * alone (rule 14).
 */

import { SOGLIA_ULTIMI_POSTI } from "@/config/limits";
import { fineFinestra, oggiRoma, type DataISO } from "@/lib/dates";
import type { Fascia } from "@/lib/db/prenotazioni";

/** One sede, one day, one fascia. Counts only: no name ever reaches here. */
export type Cella = {
  sedeId: string;
  data: DataISO;
  fascia: Fascia;
  capienza: number;
  prenotati: number;
  liberi: number;
  /** How many of them made their presence public. The number, never the names. */
  pubbliche: number;
  /** §5.2 condition 2 on its own: a sede out of season leaves the grid. */
  inStagione: boolean;
  /** All five conditions of §5.2, as decided by the database. */
  prenotabile: boolean;
};

export type StatoCella = "CHIUSA" | "ESAURITA" | "ULTIMI" | "LIBERA";

export function statoCella(cella: Cella): StatoCella {
  if (!cella.prenotabile) return "CHIUSA";
  if (cella.liberi === 0) return "ESAURITA";
  if (cella.liberi <= SOGLIA_ULTIMI_POSTI) return "ULTIMI";
  return "LIBERA";
}

/**
 * A day of the calendar. `PASSATO` and `OLTRE` are days the calendar shows
 * only to keep the weeks whole; `CHIUSO` is a day inside the window on which
 * no sede is open at all.
 */
export type StatoGiorno = "PASSATO" | "OLTRE" | "CHIUSO" | "ESAURITO" | "LIBERO";

export type Giorno = {
  data: DataISO;
  stato: StatoGiorno;
  /** Free seats across every sede and fascia of that day. */
  liberi: number;
};

/** True for the states a visitor can open. */
export function giornoApribile(stato: StatoGiorno): boolean {
  return stato === "LIBERO" || stato === "ESAURITO";
}

/** Groups the cells of the window by day, and gives each day its state. */
export function giorniDelCalendario(
  celle: readonly Cella[],
  settimane: readonly (readonly DataISO[])[],
  adesso: Date = new Date(),
): Map<DataISO, Giorno> {
  const oggi = oggiRoma(adesso);
  const fine = fineFinestra(adesso);
  const perData = new Map<DataISO, Cella[]>();
  for (const cella of celle) {
    const gruppo = perData.get(cella.data);
    if (gruppo) gruppo.push(cella);
    else perData.set(cella.data, [cella]);
  }

  const giorni = new Map<DataISO, Giorno>();
  for (const data of settimane.flat()) {
    if (data < oggi) {
      giorni.set(data, { data, stato: "PASSATO", liberi: 0 });
      continue;
    }
    if (data > fine) {
      giorni.set(data, { data, stato: "OLTRE", liberi: 0 });
      continue;
    }
    const aperte = (perData.get(data) ?? []).filter((c) => c.prenotabile);
    const liberi = aperte.reduce((somma, c) => somma + c.liberi, 0);
    const stato: StatoGiorno =
      aperte.length === 0 ? "CHIUSO" : liberi === 0 ? "ESAURITO" : "LIBERO";
    giorni.set(data, { data, stato, liberi });
  }
  return giorni;
}

/**
 * The day the page opens on: the one asked for, when it is a day a visitor
 * can open, otherwise today, otherwise the first open day of the window.
 * A date arriving from the address bar is never trusted.
 */
export function giornoScelto(
  giorni: ReadonlyMap<DataISO, Giorno>,
  richiesta: string | undefined,
  adesso: Date = new Date(),
): DataISO {
  const apribile = (data: DataISO | undefined) =>
    data !== undefined && giornoApribile(giorni.get(data)?.stato ?? "OLTRE");

  if (richiesta !== undefined && apribile(richiesta)) return richiesta;
  const oggi = oggiRoma(adesso);
  if (apribile(oggi)) return oggi;
  for (const [data, giorno] of giorni) if (giornoApribile(giorno.stato)) return data;
  return oggi;
}

/** The cells of one day, sede by sede, in the order the sedi are given. */
export function celleDelGiorno(celle: readonly Cella[], data: DataISO): Cella[] {
  return celle.filter((c) => c.data === data);
}
