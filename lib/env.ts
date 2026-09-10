/**
 * Server-side environment. No value here is ever shipped to the browser:
 * the app talks to Supabase from the server only (magic link, no browser
 * client), so nothing carries the NEXT_PUBLIC_ prefix.
 */

export type EnvServer = {
  supabase: { url: string; anonKey: string };
  /** Secret behind the fingerprints of the request limit (lib/auth/impronte.ts). */
  chiaveImpronte: string;
};

let cache: EnvServer | undefined;

export function envServer(): EnvServer {
  if (cache) return cache;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const chiaveImpronte = process.env.CHIAVE_IMPRONTE_ACCESSO;
  const mancanti = [
    !url && "SUPABASE_URL",
    !anonKey && "SUPABASE_ANON_KEY",
    !chiaveImpronte && "CHIAVE_IMPRONTE_ACCESSO",
  ].filter(Boolean);
  if (mancanti.length > 0 || !url || !anonKey || !chiaveImpronte) {
    throw new Error(`Variabili d'ambiente mancanti: ${mancanti.join(", ")} (vedi .env.local.example)`);
  }
  cache = { supabase: { url, anonKey }, chiaveImpronte };
  return cache;
}
