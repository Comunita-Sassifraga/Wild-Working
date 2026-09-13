/**
 * The scheduled call that sends the reminders — SPEC §6.3, §12 step 9.
 *
 * Called once a day by the schedule that lives outside the application (§10),
 * at the hour `ORA_PROMEMORIA` documents. It was the first of the automatic
 * jobs; the nightly cleanups of step 11 hang off the same `/api/mestieri`
 * shape and share the check of the secret, which lives in `lib/mestieri.ts`.
 *
 * Reachable only with the shared secret: nothing here depends on a session,
 * and a request without the right bearer token is refused before anything is
 * read. The answer carries counts and nothing else — no address, no name, no
 * identifier (rule 4).
 *
 * To run it by hand while developing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/mestieri/promemoria
 */

import { clientDiServizio } from "@/lib/db/servizio";
import { rifiutaSenzaSegreto } from "@/lib/mestieri";
import { inviaPromemoria } from "@/lib/posta/promemoria";

export const dynamic = "force-dynamic";

export async function GET(richiesta: Request): Promise<Response> {
  const rifiuto = rifiutaSenzaSegreto(richiesta);
  if (rifiuto) return rifiuto;

  const esito = await inviaPromemoria(clientDiServizio());
  return Response.json(esito);
}
