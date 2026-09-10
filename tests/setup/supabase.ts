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
  /** Local mailbox (Mailpit) that receives every email the stack sends. */
  postaUrl: string;
};

const POSTA_LOCALE = "http://127.0.0.1:54324";

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
    cache = { ...(daEnv as Omit<Ambiente, "postaUrl">), postaUrl: process.env.SUPABASE_MAIL_URL ?? POSTA_LOCALE };
    return cache;
  }
  const valori = leggiSupabaseStatus();
  cache = {
    url: valori.API_URL,
    anonKey: valori.ANON_KEY,
    serviceKey: valori.SERVICE_ROLE_KEY,
    jwtSecret: valori.JWT_SECRET,
    postaUrl: valori.MAILPIT_URL ?? valori.INBUCKET_URL ?? POSTA_LOCALE,
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

/**
 * Publishes the local connection data as environment variables, for the few
 * library functions that build their own backend client instead of taking one
 * (lib/db/servizio.ts). Everything else in the tests passes a client
 * explicitly and needs none of this.
 */
export function ambienteNelProcesso(): void {
  const a = ambiente();
  process.env.SUPABASE_URL = a.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = a.serviceKey;
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

/**
 * Test sedi open in the last minute of the day.
 *
 * SPEC §6.4 lets a booking be cancelled until its fascia begins, and the
 * access policy enforces it. With the real defaults (09:00 and 14:00) a test
 * that books "today" and cancels would pass in the morning and fail in the
 * afternoon. The hours are irrelevant to what those tests assert, so a sede
 * of theirs starts late and stays cancellable for the whole run. The tests
 * about the deadline itself pass their own hours.
 */
const ORARI_TARDI = {
  ora_inizio_mattina: "23:59",
  ora_fine_mattina: "23:59:59",
  ora_inizio_pomeriggio: "23:59",
  ora_fine_pomeriggio: "23:59:59",
};

export async function creaSede(sede: NuovaSede): Promise<string> {
  const { data, error } = await servizio()
    .from("sedi")
    .insert({
      nome: `Sede di prova ${randomUUID().slice(0, 8)}`,
      comune: "Test",
      ...ORARI_TARDI,
      ...sede,
    })
    .select("id")
    .single();
  if (error) throw new Error(`creaSede failed: ${error.code}`);
  return data.id;
}

type NuovoPeriodo = Omit<Database["public"]["Tables"]["periodi_attivita"]["Insert"], "etichetta"> & {
  etichetta?: string;
};

/** Adds a periodo_attivita to a sede (SPEC §5.7). */
export async function creaPeriodo(periodo: NuovoPeriodo): Promise<string> {
  const { data, error } = await servizio()
    .from("periodi_attivita")
    .insert({ etichetta: "Periodo di prova", ...periodo })
    .select("id")
    .single();
  if (error) throw new Error(`creaPeriodo failed: ${error.code}`);
  return data.id;
}

/** Adds a chiusura. `fascia` absent means the whole day (SPEC §5.4). */
export async function creaChiusura(
  chiusura: Database["public"]["Tables"]["chiusure"]["Insert"],
): Promise<string> {
  const { data, error } = await servizio()
    .from("chiusure")
    .insert(chiusura)
    .select("id")
    .single();
  if (error) throw new Error(`creaChiusura failed: ${error.code}`);
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

// ---------------------------------------------------------------------------
// Local mailbox. The stack delivers every email to Mailpit, which exposes a
// small HTTP API. Used by the sign-in tests to pick the link out of the
// message, the way a person would. Addresses are passed to the API only,
// never printed.
// ---------------------------------------------------------------------------

type MessaggioPosta = { ID: string };

async function messaggiPer(email: string): Promise<MessaggioPosta[]> {
  const url = `${ambiente().postaUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`;
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`mailbox search failed: ${risposta.status}`);
  const corpo = (await risposta.json()) as { messages?: MessaggioPosta[] };
  return corpo.messages ?? [];
}

/** Number of emails delivered to an address so far. */
export async function contaEmail(email: string): Promise<number> {
  return (await messaggiPer(email)).length;
}

/**
 * Waits for the (giaViste + 1)-th email to an address and returns the sign-in
 * link it carries, as `token_hash` and `type`.
 */
export async function linkDaEmail(
  email: string,
  giaViste = 0,
): Promise<{ tokenHash: string; tipo: string }> {
  const scadenza = Date.now() + 15_000;
  let messaggi: MessaggioPosta[] = [];
  while (Date.now() < scadenza) {
    messaggi = await messaggiPer(email);
    if (messaggi.length > giaViste) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (messaggi.length <= giaViste) throw new Error("no sign-in email arrived in time");

  // Newest first: the message we want is the most recent one.
  const risposta = await fetch(`${ambiente().postaUrl}/api/v1/message/${messaggi[0].ID}`);
  if (!risposta.ok) throw new Error(`mailbox read failed: ${risposta.status}`);
  const corpo = (await risposta.json()) as { HTML?: string; Text?: string };
  const testo = (corpo.HTML ?? corpo.Text ?? "").replace(/&amp;/g, "&");
  const m = /token_hash=([^&"'\s<]+)&type=([a-z_]+)/.exec(testo);
  if (!m) throw new Error("the email carries no sign-in link");
  return { tokenHash: m[1], tipo: m[2] };
}

/** One message as the tests read it. The address is not part of it: it is the key, not the content. */
export type EmailRicevuta = { da: string; oggetto: string; testo: string };

/**
 * Waits for the (giaViste + 1)-th email to an address and returns it. Used by
 * the step 9 tests, which check what the app writes rather than a link.
 */
export async function attendiEmail(email: string, giaViste = 0): Promise<EmailRicevuta> {
  const scadenza = Date.now() + 10_000;
  let messaggi: MessaggioPosta[] = [];
  while (Date.now() < scadenza) {
    messaggi = await messaggiPer(email);
    if (messaggi.length > giaViste) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (messaggi.length <= giaViste) throw new Error("no email arrived in time");

  const risposta = await fetch(`${ambiente().postaUrl}/api/v1/message/${messaggi[0].ID}`);
  if (!risposta.ok) throw new Error(`mailbox read failed: ${risposta.status}`);
  const corpo = (await risposta.json()) as {
    From?: { Address?: string };
    Subject?: string;
    Text?: string;
  };
  return { da: corpo.From?.Address ?? "", oggetto: corpo.Subject ?? "", testo: corpo.Text ?? "" };
}

/**
 * Gives a message that must not exist the time to arrive, then reports how
 * many are there. Proving a negative needs a wait: without one the test would
 * pass because it looked too early.
 */
export async function nessunaEmailOltre(email: string, giaViste = 0): Promise<number> {
  await new Promise((r) => setTimeout(r, 1_000));
  return (await messaggiPer(email)).length - giaViste;
}

/** Pauses longer than the minimum interval between two emails to one address (config.toml max_frequency). */
export async function attendiIntervalloPosta(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1_200));
}
