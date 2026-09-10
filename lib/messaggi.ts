/**
 * User-facing texts. Everything a person reads lives in messages/it.json
 * (CLAUDE.md: never hardcoded in JSX). This module only types the file and
 * fills `{segnaposto}` values.
 */

import messaggi from "@/messages/it.json";

export const m = messaggi;

/** Replaces every `{chiave}` in `testo` with the matching value. */
export function conValori(testo: string, valori: Record<string, string | number>): string {
  return testo.replace(/\{(\w+)\}/g, (intero, chiave: string) =>
    chiave in valori ? String(valori[chiave]) : intero,
  );
}
