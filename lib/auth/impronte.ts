/**
 * Fingerprints for the request limit of SPEC §6.1.
 *
 * An email address or a network address never reaches the database: what is
 * stored is a keyed hash, computed here with a secret only the server holds.
 * Without the key the stored value cannot be turned back into an address.
 */

import { createHmac } from "node:crypto";

export function impronta(valore: string, chiave: string): string {
  return createHmac("sha256", chiave).update(valore).digest("hex");
}

/**
 * Lower-cases and trims an address, and rejects anything that is not shaped
 * like one. Returns null when the value is unusable.
 */
export function normalizzaEmail(email: string): string | null {
  const pulita = email.trim().toLowerCase();
  if (pulita.length === 0 || pulita.length > 254) return null;
  // Local part, one @, a domain with at least one dot and no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pulita)) return null;
  return pulita;
}

/**
 * Network address of the caller, from the headers set by the hosting proxy.
 * Falls back to a fixed value so the per-network limit still applies, and
 * degrades to a global one, when no header is present.
 */
export function indirizzoRete(headers: Headers): string {
  const inoltrato = headers.get("x-forwarded-for");
  if (inoltrato) {
    const primo = inoltrato.split(",")[0]?.trim();
    if (primo) return primo;
  }
  return headers.get("x-real-ip")?.trim() || "sconosciuto";
}
