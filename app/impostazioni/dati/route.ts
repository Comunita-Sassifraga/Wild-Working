/**
 * "Scarica i miei dati" — SPEC §7, art. 15 and art. 20, §12 step 10.
 *
 * A Route Handler and not a Server Action, because what the person asks for
 * is a file: an ordinary link, a GET, and the browser saves it. Like every
 * other page of this app it needs no JavaScript to work.
 *
 * It is not under `/api/`: that path belongs to the scheduled jobs, which are
 * protected by a shared secret and serve nobody's request. This one hangs off
 * the settings page it is reached from, and is bound to the session cookie.
 *
 * The file carries the person's own email address, which is exactly what
 * art. 15 is for. It goes to them and to nobody else — that is decided by the
 * access policies, not by this handler (§8.3): the queries behind it name no
 * person at all.
 *
 * Nothing is logged, and the address never appears in the file name (rule 4):
 * a download folder is a place other people look at.
 */

import { redirect } from "next/navigation";
import { utenteAttuale } from "@/lib/auth/sessione";
import { oggiRoma } from "@/lib/dates";
import { mieiDati } from "@/lib/db/diritti";
import { clientServer } from "@/lib/db/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const [utente, client] = await Promise.all([utenteAttuale(), clientServer()]);
  if (!utente) redirect("/accedi");

  const dati = await mieiDati(client, utente.id);
  if (!dati) return new Response("non disponibile", { status: 404 });

  // Indented on purpose: the file is meant to be opened and read by a person,
  // not only by a program. Art. 20 asks for a format that travels; art. 15
  // asks for one that can be understood.
  const corpo = JSON.stringify(dati, null, 2);

  return new Response(corpo, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="miei-dati-${oggiRoma()}.json"`,
      // A copy of somebody's personal data must not sit in any cache along
      // the way, nor come back from the browser's own history.
      "Cache-Control": "no-store, private",
    },
  });
}
