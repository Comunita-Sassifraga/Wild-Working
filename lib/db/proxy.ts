/**
 * Supabase client for proxy.ts, where cookies come from the request and go
 * onto the response. Its only job is to refresh an expiring session so the
 * cookie stays current for the pages, which cannot write cookies themselves.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { opzioniCookieSessione } from "@/lib/auth/cookie";
import { envServer } from "@/lib/env";
import type { Client } from "./client";
import type { Database } from "./types";

export function clientDaRichiesta(request: NextRequest): { client: Client; risposta: () => NextResponse } {
  let risposta = NextResponse.next({ request });
  const { supabase } = envServer();
  const client = createServerClient<Database>(supabase.url, supabase.anonKey, {
    cookieOptions: opzioniCookieSessione(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        risposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) risposta.cookies.set(name, value, options);
      },
    },
  });
  return { client, risposta: () => risposta };
}
