/**
 * The scheduled call that runs the nightly cleanups — SPEC §7, §12 step 11.
 *
 * Called once a night by the schedule that lives outside the application
 * (§10), at the hour `ORA_PULIZIE` documents. Same shape and same shared
 * secret as the reminder of step 9: a request without the right bearer token
 * is refused before anything is read or written.
 *
 * The answer carries counts and nothing else — no address, no name, no
 * identifier (rule 4). It is also the only place a failed cleanup becomes
 * visible, which is why the failed steps are named in it.
 *
 * To run it by hand while developing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/mestieri/pulizie
 */

import { clientDiServizio } from "@/lib/db/servizio";
import { rifiutaSenzaSegreto } from "@/lib/mestieri";
import { eseguiPulizie } from "@/lib/pulizie";

export const dynamic = "force-dynamic";

export async function GET(richiesta: Request): Promise<Response> {
  const rifiuto = rifiutaSenzaSegreto(richiesta);
  if (rifiuto) return rifiuto;

  const esito = await eseguiPulizie(clientDiServizio());
  return Response.json(esito);
}
