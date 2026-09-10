/**
 * The door every automatic job comes through — SPEC §12 steps 9 and 11.
 *
 * The routes under `app/api/mestieri/` depend on no session: they are called
 * by the scheduler, which presents the shared secret as a bearer token. This
 * is the one place that decides whether it is the right one, so the two jobs
 * cannot drift into two slightly different checks.
 *
 * The answer never says how far the presented secret matched, in time or in
 * words: a refusal is one status and no detail.
 */

import { timingSafeEqual } from "node:crypto";
import { segretoMestieri } from "@/lib/env";

/** Constant-time comparison: the answer must not depend on how far it matched. */
function segretoCorretto(presentato: string, atteso: string): boolean {
  const a = Buffer.from(presentato);
  const b = Buffer.from(atteso);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Refuses the request when the scheduler's secret is missing or wrong, and
 * returns nothing when it is right — so a route reads:
 *
 *   const rifiuto = rifiutaSenzaSegreto(richiesta);
 *   if (rifiuto) return rifiuto;
 */
export function rifiutaSenzaSegreto(richiesta: Request): Response | undefined {
  const intestazione = richiesta.headers.get("authorization") ?? "";
  const presentato = intestazione.startsWith("Bearer ") ? intestazione.slice(7) : "";
  if (!presentato || !segretoCorretto(presentato, segretoMestieri())) {
    return new Response("non autorizzato", { status: 401 });
  }
  return undefined;
}
