/**
 * The scheduled call that sends the reminders — SPEC §6.3, §12 step 9,
 * §15.10, §15.14 step 19.
 *
 * Called once a day by the schedule in vercel.json, at the hour
 * `ORA_PROMEMORIA` documents. It was the first of the automatic jobs; the
 * nightly cleanups of step 11 hang off the same `/api/mestieri` shape and
 * share the check of the secret, which lives in `lib/mestieri.ts`.
 *
 * Since step 19 it takes **two lists and not two runs** (§15.10): the desk
 * reminders of §6.3 and the activity reminders of «Prenota un abitante».
 * One schedule, one call, one hour — vercel.json is untouched, and so is the
 * reminder of §6.3, which runs first and exactly as it did before. The
 * activities follow it; if their list fails there is nothing to undo, because
 * the two claim their own rows independently.
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
import { inviaPromemoria, inviaPromemoriaAttivita } from "@/lib/posta/promemoria";

export const dynamic = "force-dynamic";

export async function GET(richiesta: Request): Promise<Response> {
  const rifiuto = rifiutaSenzaSegreto(richiesta);
  if (rifiuto) return rifiuto;

  const client = clientDiServizio();

  // One after the other, not in parallel: they write to the same mail
  // provider, whose daily ceiling §15.10 warns about, and a run whose order
  // is fixed is a run whose log can be read.
  const postazioni = await inviaPromemoria(client);
  const attivita = await inviaPromemoriaAttivita(client);

  return Response.json({ postazioni, attivita });
}
