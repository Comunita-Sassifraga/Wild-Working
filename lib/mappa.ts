/**
 * Where a sede is — SPEC §6.2, §5.2, §11.B.
 *
 * Pure functions around the `coordinate` column, which has existed since the
 * first migration for exactly this ("Per il link a mappe e indicazioni
 * stradali") and which nothing read until the decision of 15/09/2026.
 *
 * A link, never a map drawn inside the page. An embedded map is a third
 * party that writes cookies, and the whole app is built so that no consent
 * banner is needed (rule 7, §14.3). Nothing leaves for Google until somebody
 * touches the link, and the page it starts from does not travel with it —
 * the link carries `rel="noreferrer"`.
 *
 * A sede with neither coordinates nor an address gets no link at all: one
 * that opens the wrong place is worse than none (§11.A, where the six
 * addresses are still missing).
 */

/** Latitude and longitude, in the order a person reads and writes them. */
export type Posizione = { latitudine: number; longitudine: number };

const LIMITE = { latitudine: 90, longitudine: 180 };

function dentroIlMondo(p: Posizione): boolean {
  return (
    Number.isFinite(p.latitudine) &&
    Number.isFinite(p.longitudine) &&
    Math.abs(p.latitudine) <= LIMITE.latitudine &&
    Math.abs(p.longitudine) <= LIMITE.longitudine
  );
}

/**
 * Reads the column back. Postgres `point` is (x, y) = (longitude, latitude),
 * and PostgREST hands it over as the text `(7.5512,45.5123)`. The value is
 * typed `unknown` by the type generator, which has no mapping for `point`,
 * so this is also where that uncertainty stops.
 */
export function posizioneDaColonna(valore: unknown): Posizione | null {
  if (typeof valore !== "string") return null;
  const numeri = valore.trim().replace(/^\(|\)$/g, "").split(",");
  if (numeri.length !== 2) return null;
  const posizione = { longitudine: Number(numeri[0]), latitudine: Number(numeri[1]) };
  return dentroIlMondo(posizione) ? posizione : null;
}

/**
 * Reads what an administrator pasted into the panel: the two numbers Google
 * Maps copies when you hold down on a point, `45.5123, 7.5512` — latitude
 * first, as everywhere a person writes them. A comma, spaces, or both.
 */
export function posizioneDaTesto(testo: string): Posizione | null {
  const numeri = testo.trim().split(/[,\s]+/).filter(Boolean);
  if (numeri.length !== 2) return null;
  const posizione = { latitudine: Number(numeri[0]), longitudine: Number(numeri[1]) };
  return dentroIlMondo(posizione) ? posizione : null;
}

/** The value the column wants: (longitude,latitude). */
export function colonnaDaPosizione(p: Posizione): string {
  return `(${p.longitudine},${p.latitudine})`;
}

/** The two numbers as the panel shows them back, latitude first. */
export function testoDaPosizione(p: Posizione): string {
  return `${p.latitudine}, ${p.longitudine}`;
}

/** What the link needs to know. A sede may have one, both or neither. */
export type LuogoSede = {
  coordinate?: unknown;
  indirizzo?: string | null;
  comune?: string | null;
};

/**
 * The address of the map, or nothing.
 *
 * The coordinates come first because they are exact. Without them an address
 * is the next best thing, and the comune goes with it so that "via Roma 1"
 * is looked for in the right valley. A comune on its own is not enough: it
 * would open the middle of a village and claim to be the sede.
 */
export function collegamentoMappa(sede: LuogoSede): string | null {
  const posizione = posizioneDaColonna(sede.coordinate);
  const query = posizione
    ? `${posizione.latitudine},${posizione.longitudine}`
    : sede.indirizzo
      ? [sede.indirizzo, sede.comune].filter(Boolean).join(", ")
      : null;
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
