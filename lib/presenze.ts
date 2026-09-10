/**
 * "Chi c'è in Valle" view model — SPEC §6.6.
 *
 * Pure functions over the rows the database already filtered: the names come
 * from `presenze_pubbliche`, the counts from `disponibilita_pubblica`.
 * Nothing here decides who may be seen — that is the view's job (rule 3) —
 * and nothing here decides which days exist, which is the window of §6.2
 * applied inside the database (rule 10).
 *
 * What this module does decide is the shape of the page: which sedi, which
 * days, which fasce are worth a line, and how the line reads.
 */

import type { Cella } from "@/lib/disponibilita";
import type { DataISO } from "@/lib/dates";
import type { SedePubblica } from "@/lib/db/disponibilita";
import { FASCE, type Fascia } from "@/lib/db/prenotazioni";
import type { Presenza } from "@/lib/db/presenze";
import { conValori, m } from "@/lib/messaggi";

/** One fascia of one day: who is named, and how many are not. */
export type FasciaPresente = {
  fascia: Fascia;
  /** The public names, in the order the database returned them. */
  nomi: string[];
  /** Everyone else booked in the slot. A number, never a name (§6.6). */
  senzaNome: number;
};

export type GiornoPresente = {
  data: DataISO;
  /** Only the fasce with somebody in them, MATTINA before POMERIGGIO. */
  fasce: FasciaPresente[];
};

export type SedePresente = {
  sede: SedePubblica;
  /** Only the days with somebody in them, in date order. */
  giorni: GiornoPresente[];
};

/**
 * The line of people of §6.6: first the names, then the tail of those who
 * did not share one, in a single line.
 *
 *   "Pia, Nino + 2 persone che preferiscono non condividere pubblicamente il nome"
 *   "Pia + 1 persona che preferisce non condividere pubblicamente il nome"
 *   "3 persone che preferiscono non condividere pubblicamente il nome"
 *   "Pia, Nino"
 *
 * With no names at all the `+` goes too: a line opening with a plus sign
 * would read as if something had been left out.
 */
export function rigaPersone(nomi: readonly string[], senzaNome: number): string {
  const t = m.chiCe.riga;
  const elenco = nomi.join(t.separatore);
  if (senzaNome <= 0) return elenco;
  const coda = senzaNome === 1 ? t.unSenzaNome : conValori(t.senzaNome, { numero: senzaNome });
  if (nomi.length === 0) return coda;
  return conValori(t.nomiECoda, { nomi: elenco, coda });
}

/** True when a fascia of a day of a sede has at least one person booked. */
const occupata = (cella: Cella | undefined) => (cella?.prenotati ?? 0) > 0;

/**
 * Groups everything the page draws: sede → day → fascia.
 *
 * A sede is listed when it is in season on at least one day of the window,
 * or when somebody is booked in it even though it is not — a sede that goes
 * out of season keeps its bookings (rule 6), and the people who made them
 * are still expected there.
 *
 * The count of who did not share a name is `prenotati` minus the names
 * actually shown, and not the `pubbliche` column of the same row: the line
 * has to add up to the number of people in the room, whatever the two views
 * might one day disagree on.
 */
export function presenzePerSede(
  sedi: readonly SedePubblica[],
  celle: readonly Cella[],
  presenze: readonly Presenza[],
): SedePresente[] {
  const risultato: SedePresente[] = [];

  for (const sede of sedi) {
    const celleSede = celle.filter((c) => c.sedeId === sede.id);
    const inElenco =
      celleSede.some((c) => c.inStagione) || celleSede.some((c) => c.prenotati > 0);
    if (!inElenco) continue;

    const date = [...new Set(celleSede.filter((c) => c.prenotati > 0).map((c) => c.data))].sort();
    const giorni: GiornoPresente[] = [];

    for (const data of date) {
      const fasce: FasciaPresente[] = [];
      for (const fascia of FASCE) {
        const cella = celleSede.find((c) => c.data === data && c.fascia === fascia);
        if (!occupata(cella)) continue;
        const nomi = presenze
          .filter((p) => p.sedeId === sede.id && p.data === data && p.fascia === fascia)
          .map((p) => p.nomePubblico);
        fasce.push({
          fascia,
          nomi,
          senzaNome: Math.max((cella?.prenotati ?? 0) - nomi.length, 0),
        });
      }
      if (fasce.length > 0) giorni.push({ data, fasce });
    }

    risultato.push({ sede, giorni });
  }

  return risultato;
}
