/**
 * Query-string helpers for the panel.
 *
 * Every screen is server-rendered and every result travels in the address,
 * the way the rest of the app does it: the panel works with JavaScript
 * switched off, and a refused write comes back as `?errore=…`. Nothing that
 * identifies a person ever goes into an address — never an email, never a
 * refused public name (rule 4).
 */

export type Parametri = Record<string, string | string[] | undefined>;

/** The first value of a query parameter, whichever way the browser sent it. */
export function uno(valore: string | string[] | undefined): string | undefined {
  return Array.isArray(valore) ? valore[0] : valore;
}
