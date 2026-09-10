/**
 * Supabase client bound to the cookies of the current request — for Server
 * Components, Server Actions and Route Handlers. Every query runs under the
 * RLS identity of the signed-in person, or as a visitor when there is none.
 *
 * Keep this file free of anything that is not Next.js request context:
 * lib/db/client.ts stays usable from tests and jobs.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { opzioniCookieSessione } from "@/lib/auth/cookie";
import { envServer } from "@/lib/env";
import type { Client } from "./client";
import type { Database } from "./types";

export async function clientServer(): Promise<Client> {
  const negozio = await cookies();
  const { supabase } = envServer();
  return createServerClient<Database>(supabase.url, supabase.anonKey, {
    cookieOptions: opzioniCookieSessione(),
    cookies: {
      getAll() {
        return negozio.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) negozio.set(name, value, options);
        } catch {
          // A Server Component cannot write cookies. proxy.ts refreshes the
          // session on every request, so the cookie is kept current there.
        }
      },
    },
  });
}
