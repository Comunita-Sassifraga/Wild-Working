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
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
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

/**
 * Test sedi open every day of the week.
 *
 * Same reasoning as ORARI_TARDI, one axis over. The real default is LUN-SAB
 * (§5.2), so a test that books "tomorrow" against a sede of its own passed
 * six days out of seven and failed on a Saturday, when tomorrow is a Sunday —
 * which is how tests/diritti.test.ts came to fail on 2026-09-12 with a
 * refusal its assertions had nothing to do with. The weekday is irrelevant to
 * what those tests assert, so a test sede is open on all seven; the tests
 * about giorni_apertura itself pass their own, and the one that checks the
 * real default (tests/amministrazione.test.ts) creates its sede through the
 * admin action and never comes through here.
 *
 * A suite whose result depends on the day it is run says nothing on the day
 * it goes red.
 */
const OGNI_GIORNO: Database["public"]["Enums"]["giorno_settimana"][] = [
  "LUN",
  "MAR",
  "MER",
  "GIO",
  "VEN",
  "SAB",
  "DOM",
];

export async function creaSede(sede: NuovaSede): Promise<string> {
  const { data, error } = await servizio()
    .from("sedi")
    .insert({
      nome: `Sede di prova ${randomUUID().slice(0, 8)}`,
      comune: "Test",
      giorni_apertura: OGNI_GIORNO,
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

// ---------------------------------------------------------------------------
// «Prenota un abitante» — SPEC §15.3. Fixtures for the module.
//
// Everything here goes through the service client: it bypasses RLS, which is
// exactly what a fixture needs and exactly what the tests must never use to
// assert a permission. What the module allows a person to do is always asked
// through that person's own client.
// ---------------------------------------------------------------------------

type NuovaEdizione = Partial<Database["public"]["Tables"]["edizioni"]["Insert"]>;

/** An edition. By default active and running from today for four weeks (§15.3.1). */
export async function creaEdizione(edizione: NuovaEdizione = {}): Promise<string> {
  const { data, error } = await servizio()
    .from("edizioni")
    .insert({
      nome: `Edizione di prova ${randomUUID().slice(0, 8)}`,
      data_inizio: oggiRoma(),
      data_fine: aggiungiGiorni(oggiRoma(), 28),
      attiva: true,
      ...edizione,
    })
    .select("id")
    .single();
  if (error) throw new Error(`creaEdizione failed: ${error.code}`);
  return data.id;
}

type NuovaAttivita = Partial<Database["public"]["Tables"]["attivita"]["Insert"]> & {
  edizione_id: string;
};

/**
 * An activity. Published by default, with the consent tick and its form, so a
 * test that is not about §15.8 does not have to think about it. Tomorrow, so
 * it has not begun: the tests about the deadline pass their own date.
 *
 * The abitante's data is invented and obviously so — these are a third
 * party's personal fields (§15.8) and no fixture should look like a real one.
 */
export async function creaAttivita(attivita: NuovaAttivita): Promise<string> {
  const { data, error } = await servizio()
    .from("attivita")
    .insert({
      titolo: `Attivita di prova ${randomUUID().slice(0, 8)}`,
      descrizione: "Racconto dell'abitante, con le sue parole.",
      abitante_nome: "Nome",
      abitante_cognome: "Cognome",
      abitante_telefono: "000 0000000",
      luogo_generico: "Frazione di prova",
      luogo_esatto: "Via di prova 1, Frazione di prova",
      data: aggiungiGiorni(oggiRoma(), 1),
      ora_inizio: "18:00",
      ora_fine: "20:00",
      capienza: 4,
      stato: "PUBBLICATA",
      consenso_raccolto: true,
      consenso_modalita: "MODULO_CARTACEO_FIRMATO",
      ...attivita,
    })
    .select("id")
    .single();
  if (error) throw new Error(`creaAttivita failed: ${error.code}`);
  return data.id;
}

/** An abilitazione for a person on an edition (§15.3.4). */
export async function abilita(
  utenteId: string,
  edizioneId: string,
  opts: { origine?: Database["public"]["Enums"]["origine_abilitazione"]; attiva?: boolean } = {},
): Promise<string> {
  const { data, error } = await servizio()
    .from("abilitazioni")
    .insert({
      utente_id: utenteId,
      edizione_id: edizioneId,
      origine: opts.origine ?? "CODICE",
      ...(opts.attiva === false ? { attiva: false, revocata_il: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(`abilita failed: ${error.code}`);
  return data.id;
}

/** Revokes an abilitazione, as the panel of step 15 will (§15.4). */
export async function revocaAbilitazione(id: string): Promise<void> {
  const { error } = await servizio()
    .from("abilitazioni")
    .update({ attiva: false, revocata_il: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`revocaAbilitazione failed: ${error.code}`);
}

/**
 * Inserts an iscrizione directly, bypassing iscriviti(). For fixtures the
 * write path refuses by design — an activity that has already begun, above
 * all. Never used to assert what a person may do.
 */
export async function inserisciIscrizioneDiretta(riga: {
  attivita_id: string;
  utente_id: string;
  posto_progressivo?: number;
}): Promise<string> {
  const { data, error } = await servizio()
    .from("iscrizioni")
    .insert({ posto_progressivo: 1, ...riga })
    .select("id")
    .single();
  if (error) throw new Error(`insert iscrizione failed: ${error.code}`);
  return data.id;
}

/** Signs the caller up, as a page would (§15.7). Never throws on a refusal. */
export async function iscriviti(
  client: Client,
  attivitaId: string,
): Promise<{ ok: true; id: string } | { ok: false; codice: string }> {
  const { data, error } = await client.rpc("iscriviti", { p_attivita_id: attivitaId });
  if (error) return { ok: false, codice: error.code };
  return { ok: true, id: data };
}

/**
 * The fingerprint key the code tests hash with. Any long string: what
 * matters is that the same one is used to generate and to consume, exactly
 * as CHIAVE_IMPRONTE_ACCESSO is in the running app (rule 23).
 */
export const CHIAVE_CODICI = "chiave-di-prova-per-i-cartoncini";

/**
 * Removes the module's rows of one or more editions, in dependency order:
 * iscrizioni before attivita, everything before the edizione itself.
 */
export async function pulisciEdizioni(edizioni: string[]): Promise<void> {
  if (!edizioni.length) return;
  const s = servizio();
  const { data: attivita } = await s.from("attivita").select("id").in("edizione_id", edizioni);
  const ids = (attivita ?? []).map((a) => a.id);
  if (ids.length) {
    await s.from("iscrizioni").delete().in("attivita_id", ids);
    await s.from("attivita").delete().in("id", ids);
  }
  await s.from("abilitazioni").delete().in("edizione_id", edizioni);
  await s.from("codici_invito").delete().in("edizione_id", edizioni);
  await s.from("edizioni").delete().in("id", edizioni);
}

/** Removes everything a test created. Consent rows stay: they are append-only by design. */
export async function pulisci(opts: {
  utenti?: UtenteTest[];
  sedi?: string[];
  /** Editions of §15.3.1, with their attivita, iscrizioni, abilitazioni and codes. */
  edizioni?: string[];
}): Promise<void> {
  const s = servizio();
  const ids = (opts.utenti ?? []).map((u) => u.id);
  if (ids.length) {
    await s.from("prenotazioni").delete().in("utente_id", ids);
    // RESTRICT on utente_id: these go before the account, as the erasure of
    // step 20 will make them go.
    await s.from("iscrizioni").delete().in("utente_id", ids);
    await s.from("tentativi_codice").delete().in("utente_id", ids);
  }
  await pulisciEdizioni(opts.edizioni ?? []);
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

/**
 * The messages to an address: how many there are in all, and the most recent
 * ones.
 *
 * The count is the one the mailbox reports for the search — `messages_count`,
 * never `total`, which is every message in the mailbox whoever it was for —
 * and never the length of the list. The search answers with a page of at most
 * fifty, and the addresses that stay the same across runs, like the
 * moderation mailbox, pass fifty after enough of them. Counting the page
 * would freeze at fifty, and every wait for "one more email" would then time
 * out on a suite with nothing wrong with it.
 */
async function messaggiPer(email: string): Promise<{ totale: number; recenti: MessaggioPosta[] }> {
  const url = `${ambiente().postaUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`;
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`mailbox search failed: ${risposta.status}`);
  const corpo = (await risposta.json()) as {
    messages_count?: number;
    messages?: MessaggioPosta[];
  };
  const recenti = corpo.messages ?? [];
  return { totale: corpo.messages_count ?? recenti.length, recenti };
}

/** Number of emails delivered to an address so far. */
export async function contaEmail(email: string): Promise<number> {
  return (await messaggiPer(email)).totale;
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
  let posta = await messaggiPer(email);
  while (Date.now() < scadenza && posta.totale <= giaViste) {
    await new Promise((r) => setTimeout(r, 250));
    posta = await messaggiPer(email);
  }
  if (posta.totale <= giaViste) throw new Error("no sign-in email arrived in time");

  // Newest first: the message we want is the most recent one.
  const risposta = await fetch(`${ambiente().postaUrl}/api/v1/message/${posta.recenti[0].ID}`);
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
  let posta = await messaggiPer(email);
  while (Date.now() < scadenza && posta.totale <= giaViste) {
    await new Promise((r) => setTimeout(r, 200));
    posta = await messaggiPer(email);
  }
  if (posta.totale <= giaViste) throw new Error("no email arrived in time");

  const risposta = await fetch(`${ambiente().postaUrl}/api/v1/message/${posta.recenti[0].ID}`);
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
  return (await messaggiPer(email)).totale - giaViste;
}

/** Pauses longer than the minimum interval between two emails to one address (config.toml max_frequency). */
export async function attendiIntervalloPosta(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1_200));
}
