/**
 * The scheduled call that sends the reminders — SPEC §6.3, §12 step 9.
 *
 * Called once a day by the schedule in vercel.json, at the hour
 * `ORA_PROMEMORIA` documents. It is the first of the automatic jobs; the
 * nightly cleanups of step 11 will hang off the same `/api/mestieri` shape
 * and the same secret.
 *
 * Reachable only with the shared secret: nothing here depends on a session,
 * and a request without the right bearer token is refused before anything is
 * read. The answer carries counts and nothing else — no address, no name, no
 * identifier (rule 4).
 *
 * To run it by hand while developing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/mestieri/promemoria
 */

import { timingSafeEqual } from "node:crypto";
import { clientDiServizio } from "@/lib/db/servizio";
import { segretoMestieri } from "@/lib/env";
import { inviaPromemoria } from "@/lib/posta/promemoria";

export const dynamic = "force-dynamic";

/** Constant-time comparison: the answer must not depend on how far it matched. */
function segretoCorretto(presentato: string, atteso: string): boolean {
  const a = Buffer.from(presentato);
  const b = Buffer.from(atteso);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(richiesta: Request): Promise<Response> {
  const intestazione = richiesta.headers.get("authorization") ?? "";
  const presentato = intestazione.startsWith("Bearer ") ? intestazione.slice(7) : "";
  if (!presentato || !segretoCorretto(presentato, segretoMestieri())) {
    return new Response("non autorizzato", { status: 401 });
  }

  const esito = await inviaPromemoria(clientDiServizio());
  return Response.json(esito);
}
