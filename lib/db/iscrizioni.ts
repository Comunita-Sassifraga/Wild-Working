/**
 * «Prenota un abitante» — the list, the detail and the place one takes.
 * SPEC §15.6, §15.7, §15.8, §15.2.
 *
 * What the panel reads through `attivita_amministrazione` (lib/db/attivita.ts)
 * a participant reads through the other two windows of §15.8, and never
 * through the table, which is reachable by nobody (rule 24):
 *
 *   `attivita_elenco`   level 1, to anybody holding an active abilitazione;
 *   `attivita_iscritto` levels 1 + 2, only for the rows the caller is
 *                       enrolled in — and it stops returning a row the
 *                       instant that iscrizione is cancelled.
 *
 * Nothing in this file decides who may see what. Every call runs under the
 * caller's own identity and the views carry their own WHERE clause (§8.3):
 * a filter written here would be a convenience, never the enforcement. That
 * is why the detail below asks for level 2 separately instead of choosing in
 * TypeScript which fields to show — the answer comes back empty on its own.
 *
 * The window of §6.2 is absent from this file on purpose: activities are
 * bounded by the edizione, never by FINESTRA_GIORNI (rule 21).
 */

import type { DataISO } from "@/lib/dates";
import type { Client } from "./client";
import type { Database } from "./types";

// The columns the selects below ask for, and only those: naming them keeps
// the mappers honest about what actually comes back, and the compiler tells
// us at once if one is dropped from a view.
type RigaElenco = Pick<
  Database["public"]["Views"]["attivita_elenco"]["Row"],
  | "id"
  | "titolo"
  | "descrizione"
  | "abitante_nome"
  | "luogo_generico"
  | "data"
  | "ora_inizio"
  | "ora_fine"
  | "capienza"
  | "cosa_portare"
  | "lingua_attivita"
  | "iscritti"
  | "posti_rimasti"
  | "ancora_aperta"
  | "inizio"
>;

type RigaIscritto = Pick<
  Database["public"]["Views"]["attivita_iscritto"]["Row"],
  | "id"
  | "titolo"
  | "descrizione"
  | "abitante_nome"
  | "luogo_generico"
  | "data"
  | "ora_inizio"
  | "ora_fine"
  | "capienza"
  | "cosa_portare"
  | "lingua_attivita"
  | "ancora_aperta"
  | "inizio"
  | "abitante_cognome"
  | "abitante_telefono"
  | "luogo_esatto"
>;

/**
 * Level 1 — SPEC §15.8. What every abilitated user may read of an activity:
 * who proposes it by first name, what it is, where roughly, when, and how
 * many places are left.
 */
export type AttivitaElencata = {
  id: string;
  titolo: string | null;
  /** A third party's own words, returned whole and never truncated (rule 26). */
  descrizione: string | null;
  abitanteNome: string | null;
  luogoGenerico: string | null;
  data: DataISO | null;
  oraInizio: string | null;
  oraFine: string | null;
  capienza: number | null;
  cosaPortare: string | null;
  linguaAttivita: string | null;
  /** How many hold a place. A count, never a name (§15.6). */
  iscritti: number;
  postiRimasti: number;
  /** False once it has begun: shown without its button (§15.7). */
  ancoraAperta: boolean;
  /** The instant it starts, for the sentence ORE_DISDETTA governs (§15.7). */
  inizio: string | null;
};

/**
 * Level 2 — SPEC §15.8. Surname, telephone and exact address, which appear
 * only once a place has been taken and go again the moment it is given up.
 */
export type DatiIscritto = {
  abitanteCognome: string | null;
  abitanteTelefono: string | null;
  luogoEsatto: string | null;
};

/** One of the caller's own iscrizioni. Never anybody else's (§15.3.3). */
export type MiaIscrizione = {
  id: string;
  attivitaId: string;
};

const elencata = (r: RigaElenco): AttivitaElencata => ({
  id: r.id ?? "",
  titolo: r.titolo,
  descrizione: r.descrizione,
  abitanteNome: r.abitante_nome,
  luogoGenerico: r.luogo_generico,
  data: r.data,
  oraInizio: r.ora_inizio,
  oraFine: r.ora_fine,
  capienza: r.capienza,
  cosaPortare: r.cosa_portare,
  linguaAttivita: r.lingua_attivita,
  iscritti: r.iscritti ?? 0,
  postiRimasti: r.posti_rimasti ?? 0,
  ancoraAperta: r.ancora_aperta ?? false,
  inizio: r.inizio,
});

/**
 * The same shape from the other window, for an activity the caller holds a
 * place on but the elenco no longer returns: one already past, one cancelled,
 * one of an edition since switched off. §15.6 keeps the heading identical
 * whether one has a place or not, and §15.12 keeps it readable.
 *
 * `iscritti` and `posti_rimasti` are not in this view — it is the level 2
 * window, and counts belong to level 1 — so they stay at zero here. The page
 * does not draw them for an activity somebody is already in: what it draws
 * is that they are in it.
 */
const daIscritto = (r: RigaIscritto): AttivitaElencata => ({
  id: r.id ?? "",
  titolo: r.titolo,
  descrizione: r.descrizione,
  abitanteNome: r.abitante_nome,
  luogoGenerico: r.luogo_generico,
  data: r.data,
  oraInizio: r.ora_inizio,
  oraFine: r.ora_fine,
  capienza: r.capienza,
  cosaPortare: r.cosa_portare,
  linguaAttivita: r.lingua_attivita,
  iscritti: 0,
  postiRimasti: 0,
  ancoraAperta: r.ancora_aperta ?? false,
  inizio: r.inizio,
});

// One literal per select: the client reads the column list at compile time.
// prettier-ignore
const COLONNE_ELENCO =
  "id, titolo, descrizione, abitante_nome, luogo_generico, data, ora_inizio, ora_fine, capienza, cosa_portare, lingua_attivita, iscritti, posti_rimasti, ancora_aperta, inizio";
// prettier-ignore
const COLONNE_ISCRITTO =
  "id, titolo, descrizione, abitante_nome, luogo_generico, data, ora_inizio, ora_fine, capienza, cosa_portare, lingua_attivita, ancora_aperta, inizio, abitante_cognome, abitante_telefono, luogo_esatto";

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * The programme, in chronological order — SPEC §15.6.
 *
 * Which rows exist at all is the view's decision: published, active edition,
 * today onwards, and only with an abilitazione. Somebody without one gets an
 * empty list here, not a filtered one, because the door is in the database
 * (rule 22).
 */
export async function attivitaPubblicate(client: Client): Promise<AttivitaElencata[]> {
  const { data, error } = await client
    .from("attivita_elenco")
    .select(COLONNE_ELENCO)
    .order("data")
    .order("ora_inizio", { nullsFirst: true });
  if (error || !data) return [];
  return data.filter((r) => r.id !== null).map(elencata);
}

/**
 * One activity, in both levels — SPEC §15.6, §15.8.
 *
 * Two reads rather than one, and deliberately: the second asks the level 2
 * window, which answers with a row only for somebody holding an ATTIVA
 * iscrizione on this very activity. Nothing here checks that; cancelling
 * takes the surname, the telephone and the address away in the same instant
 * because the view stops returning them (rule 24).
 */
export async function attivitaConLivelli(
  client: Client,
  id: string,
): Promise<{ attivita: AttivitaElencata; livello2: DatiIscritto | null } | null> {
  const [elenco, iscritto] = await Promise.all([
    client.from("attivita_elenco").select(COLONNE_ELENCO).eq("id", id).maybeSingle(),
    client.from("attivita_iscritto").select(COLONNE_ISCRITTO).eq("id", id).maybeSingle(),
  ]);

  const riga = iscritto.data;
  if (!elenco.data && !riga) return null;

  return {
    attivita: elenco.data ? elencata(elenco.data) : daIscritto(riga!),
    livello2: riga
      ? {
          abitanteCognome: riga.abitante_cognome,
          abitanteTelefono: riga.abitante_telefono,
          luogoEsatto: riga.luogo_esatto,
        }
      : null,
  };
}

/**
 * The public names of who is already signed up — SPEC §15.6, and the same
 * consent as §5.5.
 *
 * Only the names of those who switched the name on: whoever did not is in
 * the count and not in this list, exactly as on "Chi c'è in Valle". The view
 * returns no identifier beside the name, so a name here leads back to
 * nobody.
 *
 * Sorted alphabetically rather than by the moment each place was taken:
 * chronological order would say who was quickest, which is nobody's business
 * and not a thing the page has to tell.
 */
export async function nomiIscritti(client: Client, attivitaId: string): Promise<string[]> {
  const { data, error } = await client
    .from("iscritti_attivita")
    .select("nome_pubblico")
    .eq("attivita_id", attivitaId);
  if (error || !data) return [];
  return data
    .flatMap((r) => (r.nome_pubblico ? [r.nome_pubblico] : []))
    .sort((a, b) => a.localeCompare(b, "it"));
}

/**
 * The caller's own active iscrizioni. The policy pins the rows to the caller
 * inside the database: no filter here is what keeps another person's place
 * out (§8.3).
 */
export async function mieIscrizioni(client: Client): Promise<MiaIscrizione[]> {
  const { data, error } = await client
    .from("iscrizioni")
    .select("id, attivita_id")
    .eq("stato", "ATTIVA");
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, attivitaId: r.attivita_id }));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export type MotivoIscrizione =
  /** §15.7, D22: the places are gone, and there is nowhere else to go. */
  | "POSTI_ESAURITI"
  /** A place on this activity is already held. */
  | "ISCRIZIONE_DUPLICATA"
  /** Unknown, not published, another edition, or no capienza typed in yet. */
  | "ATTIVITA_NON_DISPONIBILE"
  /** No active abilitazione (rule 22). */
  | "NON_ABILITATO"
  /** Its start time has passed: one signs up until it begins (§15.7). */
  | "ATTIVITA_COMINCIATA"
  | "ACCESSO_RICHIESTO"
  | "ERRORE";

export type EsitoIscrizione = { ok: true; id: string } | { ok: false; motivo: MotivoIscrizione };

// SQLSTATE codes raised by iscriviti() — see *_abitanti.sql.
const motiviPerCodice: Record<string, MotivoIscrizione> = {
  IS001: "POSTI_ESAURITI",
  IS002: "ISCRIZIONE_DUPLICATA",
  IS003: "ATTIVITA_NON_DISPONIBILE",
  IS004: "NON_ABILITATO",
  IS005: "ATTIVITA_COMINCIATA",
  "28000": "ACCESSO_RICHIESTO",
};

/**
 * Takes a place — SPEC §15.7. Immediate and automatic, like a desk (D3).
 *
 * Every condition is checked inside `iscriviti()`, and capacity is decided
 * by the unique index of §15.3.3, never by a read-then-write check here
 * (rule 5). When more people arrive than there are places, the ones who miss
 * out simply fail: there is no waiting list to fall into (rule 29).
 */
export async function iscrivitiAttivita(
  client: Client,
  attivitaId: string,
): Promise<EsitoIscrizione> {
  const { data, error } = await client.rpc("iscriviti", { p_attivita_id: attivitaId });
  if (error) return { ok: false, motivo: motiviPerCodice[error.code] ?? "ERRORE" };
  if (!data) return { ok: false, motivo: "ERRORE" };
  return { ok: true, id: data };
}

/**
 * Gives a place up — SPEC §15.7. Possible until the activity begins; past
 * that the policy changes no row, so a late cancellation comes back as a
 * refusal rather than as a silent success.
 *
 * The same update on somebody else's row is a no-op for the same reason,
 * which is the whole of rule 6 on this side of the module: only an
 * amministratore may act on another person's iscrizione, and that arrives
 * with step 18.
 */
export async function annullaIscrizione(
  client: Client,
  iscrizioneId: string,
): Promise<{ ok: boolean }> {
  const { data, error } = await client
    .from("iscrizioni")
    .update({ stato: "ANNULLATA" })
    .eq("id", iscrizioneId)
    .select("id");
  if (error) return { ok: false };
  return { ok: (data?.length ?? 0) === 1 };
}
