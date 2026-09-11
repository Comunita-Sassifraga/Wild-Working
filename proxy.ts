/**
 * Runs before every page: refreshes the session cookie when the access
 * token is about to expire, so a person stays signed in for
 * DURATA_SESSIONE_GIORNI from their last visit (SPEC §6.1). It decides
 * nothing about access: who sees what is enforced by RLS (§8.3).
 */

import type { NextRequest } from "next/server";
import { clientDaRichiesta } from "@/lib/db/proxy";

export async function proxy(request: NextRequest) {
  const { client, risposta } = clientDaRichiesta(request);
  // getUser() validates the token with Supabase and triggers the refresh.
  await client.auth.getUser();
  return risposta();
}

export const config = {
  // Everything except static assets — and except the two files the phone
  // fetches to install the app (§12 step 13), which belong to no session and
  // must not cost a Supabase call each: `sw.js` is asked for on every visit,
  // and the browser re-checks it on its own besides.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
