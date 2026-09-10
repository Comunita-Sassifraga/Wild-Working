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
  // Everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
