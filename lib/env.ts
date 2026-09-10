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

export type EnvPosta = {
  /** Resend key. Absent outside production: the message goes to Mailpit. */
  chiaveResend?: string;
  /** Local mailbox standing in for the provider, when there is no key. */
  urlPostaLocale: string;
};

/** Local Mailpit, the same one the sign-in emails land in (CLAUDE.md commands). */
const POSTA_LOCALE = "http://127.0.0.1:54324";

/**
 * Where outbound email goes (§12 step 9).
 *
 * `POSTA_LOCALE` deliberately wins over `RESEND_API_KEY`: it is what keeps a
 * test run, or a local experiment, from ever reaching a real mailbox.
 */
export function envPosta(): EnvPosta {
  const locale = process.env.POSTA_LOCALE;
  if (locale) return { urlPostaLocale: locale };
  return {
    ...(process.env.RESEND_API_KEY ? { chiaveResend: process.env.RESEND_API_KEY } : {}),
    urlPostaLocale: POSTA_LOCALE,
  };
}

export type EnvServizio = {
  url: string;
  /** Backend key: bypasses RLS, never reaches a browser (lib/db/client.ts). */
  serviceRoleKey: string;
};

/**
 * The backend identity, for what no signed-in person can do: the reminder job
 * of §6.3, the nightly cleanups of step 11, and reading the address of a
 * person the amministratore must write to without ever seeing it (§6.5).
 * Read here and nowhere else, so the service key has one door into the app.
 */
export function envServizio(): EnvServizio {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mancanti = [!url && "SUPABASE_URL", !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(
    Boolean,
  );
  if (mancanti.length > 0 || !url || !serviceRoleKey) {
    throw new Error(`Variabili d'ambiente mancanti: ${mancanti.join(", ")} (vedi .env.local.example)`);
  }
  return { url, serviceRoleKey };
}

/**
 * Shared secret the scheduler presents to `/api/mestieri/*`.
 *
 * The name is Vercel's, not ours: when an environment variable called
 * `CRON_SECRET` exists, Vercel sends it as a bearer token on every scheduled
 * call. Renaming it would mean setting the same secret twice.
 */
export function segretoMestieri(): string {
  const segreto = process.env.CRON_SECRET;
  if (!segreto) {
    throw new Error("Variabili d'ambiente mancanti: CRON_SECRET (vedi .env.local.example)");
  }
  return segreto;
}
