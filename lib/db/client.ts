/**
 * Supabase client factories. All database access goes through `lib/db/`;
 * no component or route creates a client of its own.
 *
 * Cookie-based session handling for pages arrives with sign-in (SPEC §12
 * step 2). For now the factories take their configuration explicitly, so
 * tests and jobs can point them at any instance.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type Client = SupabaseClient<Database>;

export type ConfigSupabase = {
  url: string;
  /** Publishable (anon) key: what a browser may hold. */
  anonKey: string;
};

const opzioniServer = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** A visitor: no session. Sees only what RLS grants to `anon`. */
export function clientAnonimo(config: ConfigSupabase): Client {
  return createClient<Database>(config.url, config.anonKey, opzioniServer);
}

/** A signed-in person: every query runs under their RLS identity. */
export function clientConSessione(config: ConfigSupabase, accessToken: string): Client {
  return createClient<Database>(config.url, config.anonKey, {
    ...opzioniServer,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Backend only: bypasses RLS. Used by nightly jobs, the statistics engine
 * and tests. Never in a route that serves a request on a user's behalf.
 */
export function clientServizio(url: string, serviceRoleKey: string): Client {
  return createClient<Database>(url, serviceRoleKey, opzioniServer);
}
