/**
 * The session cookie — the only cookie the app sets (CLAUDE.md rule 7).
 *
 * httpOnly: no script in the browser ever reads it; there is no browser
 * Supabase client. maxAge: the session lasts DURATA_SESSIONE_GIORNI from
 * the last use, because the cookie is re-issued on every refresh (§6.1).
 */

import { DURATA_SESSIONE_GIORNI } from "@/config/limits";

export function opzioniCookieSessione() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: DURATA_SESSIONE_GIORNI * 24 * 60 * 60,
  };
}
