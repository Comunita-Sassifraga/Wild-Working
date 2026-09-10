/**
 * Test harness for the local Supabase stack.
 *
 * Sessions are minted directly with the local JWT secret rather than through
 * the magic-link flow: sign-in is step 2 of SPEC §12, and the auth rate
 * limits of config.toml would throttle the dozens of users these tests need.
 * A minted token carries the same claims GoTrue would issue, so RLS sees
 * exactly what it sees in production.
 *
 * Email addresses of test users are never printed (CLAUDE.md rule 4).
 */

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { SignJWT } from "jose";
import { clientAnonimo, clientConSessione, clientServizio, type Client } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

type Ambiente = {
  url: string;
  anonKey: string;
  serviceKey: string;
  jwtSecret: string;
};

let cache: Ambiente | undefined;

/** Reads connection data from env vars or, failing that, from `supabase status`. */
export function ambiente(): Ambiente {
  if (cache) return cache;
  const daEnv = {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET,
  };
  if (daEnv.url && daEnv.anonKey && daEnv.serviceKey && daEnv.jwtSecret) {
    cache = daEnv as Ambiente;
    return cache;
  }
  const valori = leggiSupabaseStatus();
  cache = {
    url: valori.API_URL,
    anonKey: valori.ANON_KEY,
    serviceKey: valori.SERVICE_ROLE_KEY,
    jwtSecret: valori.JWT_SECRET,
  };
  for (const [k, v] of Object.entries(cache)) {
    if (!v) throw new Error(`supabase status did not provide ${k}; is the local stack running?`);
  }
  return cache;
}

function leggiSupabaseStatus(): Record<string, string> {
  // The Supabase CLI needs the docker binary on PATH. On Windows the Docker
  // Desktop CLI directory is often missing from non-login shells.
  let PATH = process.env.PATH ?? "";
  const dockerBin = process.env.DOCKER_BIN_DIR ?? "C:\\Program Files\\Docker\\Docker\\resources\\bin";
  if (process.platform === "win32" && existsSync(dockerBin)) PATH = `${dockerBin};${PATH}`;
  const out = execSync("supabase status -o env", {
    encoding: "utf8",
    env: { ...process.env, PATH },
    stdio: ["ignore", "pipe", "ignore"],
  });
  const valori: Record<string, string> = {};
  for (const riga of out.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(riga.trim());
    if (m) valori[m[1]] = m[2];
  }
  return valori;
}

export function servizio(): Client {
  const a = ambiente();
  return clientServizio(a.url, a.serviceKey);
}

export function visitatore(): Client {
  const a = ambiente();
  return clientAnonimo({ url: a.url, anonKey: a.anonKey });
}

export type UtenteTest = {
  id: string;
  email: string;
  client: Client;
};

async function tokenPer(id: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(ambiente().jwtSecret);
  return new SignJWT({
    sub: id,
    role: "authenticated",
    aud: "authenticated",
    email,
    session_id: randomUUID(),
    is_anonymous: false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

/** Creates an Auth user (which creates the utenti row by trigger) and a client acting as them. */
export async function creaUtente(): Promise<UtenteTest> {
  const email = `test-${randomUUID()}@example.com`;
  const { data, error } = await servizio().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.code ?? "unknown"}`);
  const a = ambiente();
  const token = await tokenPer(data.user.id, email);
  return { id: data.user.id, email, client: clientConSessione({ url: a.url, anonKey: a.anonKey }, token) };
}

export async function creaUtenti(n: number): Promise<UtenteTest[]> {
  const utenti: UtenteTest[] = [];
  for (let i = 0; i < n; i++) utenti.push(await creaUtente());
  return utenti;
}

type NuovaSede = Partial<Database["public"]["Tables"]["sedi"]["Insert"]> & { capienza: number };

export async function creaSede(sede: NuovaSede): Promise<string> {
  const { data, error } = await servizio()
    .from("sedi")
    .insert({ nome: `Sede di prova ${randomUUID().slice(0, 8)}`, comune: "Test", ...sede })
    .select("id")
    .single();
  if (error) throw new Error(`creaSede failed: ${error.code}`);
  return data.id;
}

export async function assegnaIncarico(
  utenteId: string,
  ruolo: Database["public"]["Enums"]["ruolo_incarico"],
  sedeId: string | null = null,
): Promise<void> {
  const { error } = await servizio()
    .from("incarichi")
    .insert({ utente_id: utenteId, ruolo, sede_id: sedeId });
  if (error) throw new Error(`assegnaIncarico failed: ${error.code}`);
}

/** Inserts a booking directly, bypassing prenota_posto (for past or out-of-window fixtures). */
export async function inserisciPrenotazioneDiretta(riga: {
  utente_id: string;
  sede_id: string;
  data: string;
  fascia: Database["public"]["Enums"]["fascia"];
  posto_progressivo?: number;
}): Promise<string> {
  const { data, error } = await servizio()
    .from("prenotazioni")
    .insert({ posto_progressivo: 1, ...riga })
    .select("id")
    .single();
  if (error) throw new Error(`insert prenotazione failed: ${error.code}`);
  return data.id;
}

/** Removes everything a test created. Consent rows stay: they are append-only by design. */
export async function pulisci(opts: { utenti?: UtenteTest[]; sedi?: string[] }): Promise<void> {
  const s = servizio();
  const ids = (opts.utenti ?? []).map((u) => u.id);
  if (ids.length) await s.from("prenotazioni").delete().in("utente_id", ids);
  if (opts.sedi?.length) {
    await s.from("prenotazioni").delete().in("sede_id", opts.sedi);
    await s.from("sedi").delete().in("id", opts.sedi);
  }
  for (const id of ids) await s.auth.admin.deleteUser(id);
}

/** Postgres "permission denied" / RLS violation, as PostgREST reports it. */
export const CODICE_PERMESSO_NEGATO = "42501";
