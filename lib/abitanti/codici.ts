/**
 * Invite codes — SPEC §15.3.5, §15.4.
 *
 * Making a code, writing it the way a card shows it, and reducing what
 * somebody typed to the one form the fingerprint is computed over.
 *
 * The clear code exists here and in the printing screen, and nowhere else:
 * only its fingerprint ever reaches the database (rule 23), computed with
 * the same keyed hash and the same secret as the request limit of §6.1.
 * Nothing in this file logs, returns or stores a code by itself.
 */

import { randomInt } from "node:crypto";
import { PREFISSO_CODICE } from "@/config/limits";
import { impronta } from "@/lib/auth/impronte";

/**
 * The alphabet of §15.4: no `O` and no zero, no `I`, `1` and `L` together.
 * Somebody will type this on a phone, in the cold, with little light.
 */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Random characters after the prefix — `SOANA-XXXX` (§15.4). */
const LUNGHEZZA = 4;

/**
 * A code, in the form the card carries it.
 *
 * `randomInt` and not `Math.random`: these are the keys to the module for a
 * whole edition, and a predictable sequence would hand them all over at once.
 * Rejection is handled by `randomInt` itself, so every character is equally
 * likely — a modulo would quietly favour the first few.
 */
export function nuovoCodice(): string {
  let parte = "";
  for (let i = 0; i < LUNGHEZZA; i++) parte += ALFABETO[randomInt(ALFABETO.length)];
  return `${PREFISSO_CODICE}-${parte}`;
}

/**
 * What somebody typed, reduced to one form: upper case, no spaces, no
 * dashes. §15.4 — "la verifica ignora maiuscole, minuscole e spazi", and a
 * person copying from a card will or will not carry the dash across.
 *
 * The same reduction is applied when a code is made, so the fingerprint of
 * `soana ab2c` and of `SOANA-AB2C` are the one value.
 */
export function normalizzaCodice(scritto: string): string {
  return scritto.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** The fingerprint of a code, from any of the ways it can be written. */
export function improntaCodice(codice: string, chiave: string): string {
  return impronta(normalizzaCodice(codice), chiave);
}
