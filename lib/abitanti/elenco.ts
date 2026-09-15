/**
 * «Prenota un abitante» — the shape of the list and of one card.
 * SPEC §15.6, §15.7, §15.2.
 *
 * Pure functions over the rows the database already decided: which
 * activities exist at all is the business of `attivita_elenco`, which names
 * come out is the business of `iscritti_attivita`, and neither is asked
 * again here (§8.3). What this module decides is how the page reads — which
 * weeks are worth a heading, whether a card offers a place or says
 * "Completa", and when giving one up deserves a sentence.
 *
 * The rolling window is absent on purpose: an edition runs 29 days and the
 * whole programme is shown on arrival (rule 21). Nothing here knows what
 * FINESTRA_GIORNI is.
 */

import { ORE_DISDETTA } from "@/config/limits";
import type { AttivitaElencata } from "@/lib/db/iscrizioni";
import { aggiungiGiorni, inizioSettimana, oreDaAdesso, type DataISO } from "@/lib/dates";

/** One heading of the list and the activities under it, in date order. */
export type SettimanaAttivita = {
  /** The Monday the week starts on, whether or not anything happens that day. */
  lunedi: DataISO;
  /** The Sunday it ends on, for the heading that names the span. */
  domenica: DataISO;
  attivita: AttivitaElencata[];
};

/**
 * The programme grouped by week — §15.6. Empty weeks do not appear, and
 * neither do empty days: with twenty-five entries the list is scrolled with
 * one thumb, and a heading with nothing under it is a line that costs a
 * reader something and gives them nothing.
 *
 * A published card with no date is skipped. It never reaches here — the view
 * leaves it out, because §15.6 shows what is from today onwards and a card
 * without a day is not — but the type allows one, and a card without a day
 * has no week to go under.
 */
export function perSettimana(attivita: readonly AttivitaElencata[]): SettimanaAttivita[] {
  const settimane = new Map<DataISO, AttivitaElencata[]>();

  for (const riga of attivita) {
    if (!riga.data) continue;
    const lunedi = inizioSettimana(riga.data);
    const gruppo = settimane.get(lunedi);
    if (gruppo) gruppo.push(riga);
    else settimane.set(lunedi, [riga]);
  }

  return [...settimane.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lunedi, righe]) => ({
      lunedi,
      domenica: aggiungiGiorni(lunedi, 6),
      attivita: righe,
    }));
}

/**
 * Whether a card still offers a place — §15.7, D22.
 *
 * A card published before its capienza was typed in counts as full. §15.3.2
 * is explicit about it: one that offers no places offers none to anybody,
 * and it answers the way every other unavailable activity does. Saying
 * "Completa" is exactly that answer, and it is also true.
 */
export function completa(attivita: AttivitaElencata): boolean {
  return attivita.capienza === null || attivita.postiRimasti <= 0;
}

/**
 * Fewer than ORE_DISDETTA hours to go — §15.7.
 *
 * The button stays: no penalty, no score, no block, they are neighbours.
 * What changes is that the page says plainly what giving up now costs
 * somebody who is already getting ready.
 */
export function disdettaTardiva(attivita: AttivitaElencata, adesso: Date = new Date()): boolean {
  if (!attivita.inizio || !attivita.ancoraAperta) return false;
  return oreDaAdesso(attivita.inizio, adesso) < ORE_DISDETTA;
}
