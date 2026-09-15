import type { CartoncinoGenerato } from "@/lib/db/abitanti";

/**
 * What the generation screen and its action share.
 *
 * Their own file because `azioni.ts` is a `"use server"` module, and such a
 * file may export nothing but async functions: a constant declared there is
 * a build error, not a style problem.
 *
 * Nothing here is a parameter of SPEC §10 or §15.13. `MAX_CARTONCINI` is a
 * guard against a typo in the "how many" field — 45 participants are
 * expected (§15) and a hundred is well clear of that, while a thousand
 * asked for by a slipped finger is not something the panel should print.
 */

export const MAX_CARTONCINI = 100;

export type EsitoGenerazione = {
  cartoncini: CartoncinoGenerato[];
  /** A key of `m.amministrazione.errori`, never a code and never an address. */
  errore?: string;
};

export const NESSUNA_GENERAZIONE: EsitoGenerazione = { cartoncini: [] };
