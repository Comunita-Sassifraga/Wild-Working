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
import { fineFinestra, oggiRoma, ora, type DataISO } from "@/lib/dates";
import type { SedePubblica } from "@/lib/db/disponibilita";
import type { Fascia } from "@/lib/db/prenotazioni";
import { conValori, m } from "@/lib/messaggi";

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

/**
 * "09:00–13:00" for one fascia of a sede, composed from the two times of
 * §5.2. Composed, and not stored as a sentence, because the start of the
 * fascia is also the moment after which a booking can no longer be cancelled
 * (§6.4) and the database has to compare it with the clock.
 */
export function orarioTesto(inizio: string, fine: string): string {
  return conValori(m.disponibilita.orario, { inizio: ora(inizio), fine: ora(fine) });
}

export function orarioDi(sede: SedePubblica, fascia: Fascia): string {
  const { inizio, fine } = sede.orari[fascia];
  return orarioTesto(inizio, fine);
}

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

/**
 * A day carries its state and nothing else. The calendar says whether the
 * day is open, not how open: the counts belong to the table of the chosen
 * day, sede by sede (§6.2).
 */
export type Giorno = {
  data: DataISO;
  stato: StatoGiorno;
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
      giorni.set(data, { data, stato: "PASSATO" });
      continue;
    }
    if (data > fine) {
      giorni.set(data, { data, stato: "OLTRE" });
      continue;
    }
    // Open if at least one fascia of one sede still has room; sold out when
    // every open fascia is full; closed when no sede is open at all.
    const aperte = (perData.get(data) ?? []).filter((c) => c.prenotabile);
    const stato: StatoGiorno =
      aperte.length === 0
        ? "CHIUSO"
        : aperte.some((c) => c.liberi > 0)
          ? "LIBERO"
          : "ESAURITO";
    giorni.set(data, { data, stato });
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
