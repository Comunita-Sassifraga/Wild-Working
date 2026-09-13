/**
 * Admin panel reads and writes — SPEC §6.7, §6.5, §8.2, §8.4.
 *
 * Nothing here decides who may do what: every call runs under the caller's
 * RLS identity, and the policies of *_politiche_accesso.sql and
 * *_amministrazione.sql are what refuse a non-amministratore. This module
 * translates a refusal into a reason the page can put into Italian (§8.3).
 *
 * No email address is ever logged or thrown (rule 4). The moderation
 * helpers read from `nomi_pubblici_moderazione`, a view that does not carry
 * the email column at all (§6.7).
 */

import type { DataISO } from "@/lib/dates";
import type { Client } from "./client";
import type { Fascia } from "./prenotazioni";
import type { Database } from "./types";

export type GiornoApertura = Database["public"]["Enums"]["giorno_settimana"];
export type RuoloIncarico = Database["public"]["Enums"]["ruolo_incarico"];

/** The weekdays, in the order a week is read. Matches the enum (§5.2). */
export const GIORNI_SETTIMANA: GiornoApertura[] = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

export type Sede = Database["public"]["Tables"]["sedi"]["Row"];
export type Periodo = Database["public"]["Tables"]["periodi_attivita"]["Row"];
export type Chiusura = Database["public"]["Tables"]["chiusure"]["Row"];
export type Incarico = Database["public"]["Tables"]["incarichi"]["Row"];
export type Termine = Database["public"]["Tables"]["termini_vietati"]["Row"];

/** What went wrong, in terms the page can turn into a sentence. */
export type MotivoErrore =
  /** A sede with bookings attached: the database refuses to delete it (§8.2). */
  | "HA_PRENOTAZIONI"
  /** The row is already there — a duplicate term, a duplicate incarico. */
  | "GIA_PRESENTE"
  /** No account with that address. */
  | "UTENTE_INESISTENTE"
  /** Nothing to clear: that person has no public name (§6.5). */
  | "NESSUN_NOME"
  | "NON_AUTORIZZATO"
  | "ERRORE";

export type Esito<T = void> = { ok: true; valore: T } | { ok: false; motivo: MotivoErrore };

const CHIAVE_ESTERNA = "23503";
const DUPLICATO = "23505";
const PERMESSO_NEGATO = "42501";

const motiviPerCodice: Record<string, MotivoErrore> = {
  [CHIAVE_ESTERNA]: "HA_PRENOTAZIONI",
  [DUPLICATO]: "GIA_PRESENTE",
  [PERMESSO_NEGATO]: "NON_AUTORIZZATO",
  MD001: "UTENTE_INESISTENTE",
  MD002: "NESSUN_NOME",
};

function fallito(codice: string | undefined): Esito<never> {
  return { ok: false, motivo: (codice && motiviPerCodice[codice]) || "ERRORE" };
}

/**
 * A write that changed no row is a refusal, not a success: with RLS an
 * update or a delete the caller may not perform comes back empty rather
 * than as an error.
 */
function esitoDaRighe(
  error: { code: string } | null,
  righe: unknown[] | null,
): Esito<void> {
  if (error) return fallito(error.code);
  if (!righe || righe.length === 0) return { ok: false, motivo: "NON_AUTORIZZATO" };
  return { ok: true, valore: undefined };
}

// ---------------------------------------------------------------------------
// Sedi — §6.7 first bullet
// ---------------------------------------------------------------------------

/** Every sede, suspended ones included: only an amministratore sees those. */
export async function sediTutte(client: Client): Promise<Sede[]> {
  const { data } = await client.from("sedi").select("*").order("nome");
  return data ?? [];
}

export async function sedeSingola(client: Client, sedeId: string): Promise<Sede | null> {
  const { data } = await client.from("sedi").select("*").eq("id", sedeId).maybeSingle();
  return data;
}

export type DatiSede = {
  nome: string;
  comune: string;
  indirizzo: string | null;
  capienza: number;
  ora_inizio_mattina: string;
  ora_fine_mattina: string;
  ora_inizio_pomeriggio: string;
  ora_fine_pomeriggio: string;
  giorni_apertura: GiornoApertura[];
  note: string | null;
  attiva: boolean;
  sempre_disponibile: boolean;
};

/**
 * A new sede needs only a name, a comune and a capienza. The hours, the
 * opening weekdays and the two switches come from the column defaults, which
 * are the defaults SPEC §5.2 writes down: one place, not two.
 */
export type NuovaSede = Pick<DatiSede, "nome" | "comune" | "capienza">;

export async function creaSede(client: Client, dati: NuovaSede): Promise<Esito<string>> {
  const { data, error } = await client.from("sedi").insert(dati).select("id").single();
  if (error || !data) return fallito(error?.code);
  return { ok: true, valore: data.id };
}

export async function aggiornaSede(
  client: Client,
  sedeId: string,
  dati: Partial<DatiSede>,
): Promise<Esito<void>> {
  const { data, error } = await client.from("sedi").update(dati).eq("id", sedeId).select("id");
  return esitoDaRighe(error, data);
}

/**
 * Deletes a sede. The database refuses while any booking still points at it
 * (`on delete restrict`), which is the right answer: removing a sede must
 * never take somebody's booking with it (rule 6). The page then offers the
 * switch instead.
 */
export async function eliminaSede(client: Client, sedeId: string): Promise<Esito<void>> {
  const { data, error } = await client.from("sedi").delete().eq("id", sedeId).select("id");
  return esitoDaRighe(error, data);
}

// ---------------------------------------------------------------------------
// Periodi di attività — §5.7, §6.7 second bullet
// ---------------------------------------------------------------------------

export async function periodiSede(client: Client, sedeId: string): Promise<Periodo[]> {
  const { data } = await client
    .from("periodi_attivita")
    .select("*")
    .eq("sede_id", sedeId)
    .order("data_inizio");
  return data ?? [];
}

export type DatiPeriodo = {
  sede_id: string;
  data_inizio: DataISO;
  data_fine: DataISO;
  etichetta: string;
  ricorre_ogni_anno: boolean;
};

export async function creaPeriodo(client: Client, dati: DatiPeriodo): Promise<Esito<void>> {
  const { data, error } = await client.from("periodi_attivita").insert(dati).select("id");
  return esitoDaRighe(error, data);
}

export async function eliminaPeriodo(client: Client, periodoId: string): Promise<Esito<void>> {
  const { data, error } = await client
    .from("periodi_attivita")
    .delete()
    .eq("id", periodoId)
    .select("id");
  return esitoDaRighe(error, data);
}

// ---------------------------------------------------------------------------
// Chiusure — §5.4, §6.7 third bullet
// ---------------------------------------------------------------------------

export async function chiusureSede(client: Client, sedeId: string): Promise<Chiusura[]> {
  const { data } = await client
    .from("chiusure")
    .select("*")
    .eq("sede_id", sedeId)
    .order("data_inizio");
  return data ?? [];
}

export type DatiChiusura = {
  sede_id: string;
  data_inizio: DataISO;
  data_fine: DataISO;
  /** NULL closes every fascia of the day (§5.4 "tutte"). */
  fascia: Fascia | null;
  creata_da: string;
};

export async function creaChiusura(client: Client, dati: DatiChiusura): Promise<Esito<void>> {
  const { data, error } = await client.from("chiusure").insert(dati).select("id");
  return esitoDaRighe(error, data);
}

export async function eliminaChiusura(client: Client, chiusuraId: string): Promise<Esito<void>> {
  const { data, error } = await client.from("chiusure").delete().eq("id", chiusuraId).select("id");
  return esitoDaRighe(error, data);
}

// ---------------------------------------------------------------------------
// Incarichi — §5.6, §6.7 fourth bullet
// ---------------------------------------------------------------------------

/** One assignment as the panel lists it: the role, the sede, the address. */
export type IncaricoElencato = {
  id: string;
  utenteId: string;
  ruolo: RuoloIncarico;
  sedeId: string | null;
  email: string;
};

/**
 * Every active assignment, with the address of the person holding it.
 *
 * Two queries and not a join: the email lives in `utenti_amministrazione`,
 * a view, and a view cannot be embedded from another table. Keeping them
 * apart also keeps the address out of the query that reads incarichi.
 */
export async function incarichiAttivi(client: Client): Promise<IncaricoElencato[]> {
  const { data: righe } = await client
    .from("incarichi")
    .select("id, utente_id, ruolo, sede_id")
    .eq("attivo", true)
    .order("ruolo");
  if (!righe || righe.length === 0) return [];

  const { data: utenti } = await client
    .from("utenti_amministrazione")
    .select("id, email")
    .in("id", righe.map((r) => r.utente_id));
  const indirizzi = new Map((utenti ?? []).map((u) => [u.id, u.email ?? ""]));

  return righe.map((r) => ({
    id: r.id,
    utenteId: r.utente_id,
    ruolo: r.ruolo,
    sedeId: r.sede_id,
    email: indirizzi.get(r.utente_id) ?? "",
  }));
}

/**
 * Finds one registered person by their exact address, to give them an
 * incarico. A lookup and not a list on purpose: the panel has no directory
 * of everybody who ever signed in, and does not need one.
 */
export async function cercaUtentePerEmail(
  client: Client,
  email: string,
): Promise<Esito<{ id: string }>> {
  const { data, error } = await client
    .from("utenti_amministrazione")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) return fallito(error.code);
  if (!data?.id) return { ok: false, motivo: "UTENTE_INESISTENTE" };
  return { ok: true, valore: { id: data.id } };
}

/** §6.7: "assegnare e revocare il ruolo di referente". A referente always has a sede (§5.6). */
export async function assegnaReferente(
  client: Client,
  utenteId: string,
  sedeId: string,
): Promise<Esito<void>> {
  const { data, error } = await client
    .from("incarichi")
    .insert({ utente_id: utenteId, sede_id: sedeId, ruolo: "REFERENTE" })
    .select("id");
  return esitoDaRighe(error, data);
}

export async function revocaIncarico(client: Client, incaricoId: string): Promise<Esito<void>> {
  const { data, error } = await client
    .from("incarichi")
    .delete()
    .eq("id", incaricoId)
    .select("id");
  return esitoDaRighe(error, data);
}

// ---------------------------------------------------------------------------
// Termini vietati — §6.5 level 1, §6.7 sixth bullet
// ---------------------------------------------------------------------------

export async function terminiVietati(client: Client): Promise<Termine[]> {
  const { data } = await client.from("termini_vietati").select("*").order("termine");
  return data ?? [];
}

export async function aggiungiTermine(
  client: Client,
  termine: string,
  amministratoreId: string,
): Promise<Esito<void>> {
  const { data, error } = await client
    .from("termini_vietati")
    .insert({ termine: termine.trim(), creato_da: amministratoreId })
    .select("id");
  return esitoDaRighe(error, data);
}

export async function rimuoviTermine(client: Client, termineId: string): Promise<Esito<void>> {
  const { data, error } = await client
    .from("termini_vietati")
    .delete()
    .eq("id", termineId)
    .select("id");
  return esitoDaRighe(error, data);
}

// ---------------------------------------------------------------------------
// Moderazione dei nomi pubblici — §6.5 level 3, §6.7 fifth bullet
// ---------------------------------------------------------------------------

/** A public name as the moderation screen sees it: no email, by construction. */
export type NomeInModerazione = {
  utenteId: string;
  nomePubblico: string;
  mostra: boolean;
  avvisoInAttesa: boolean;
};

function daRigaModerazione(r: {
  id: string | null;
  nome_pubblico: string | null;
  mostra_nome_pubblico: boolean | null;
  avviso_in_attesa: boolean | null;
}): NomeInModerazione[] {
  return r.id === null || r.nome_pubblico === null
    ? []
    : [
        {
          utenteId: r.id,
          nomePubblico: r.nome_pubblico,
          mostra: r.mostra_nome_pubblico ?? false,
          avvisoInAttesa: r.avviso_in_attesa ?? false,
        },
      ];
}

export async function nomiInModerazione(client: Client): Promise<NomeInModerazione[]> {
  const { data } = await client
    .from("nomi_pubblici_moderazione")
    .select("id, nome_pubblico, mostra_nome_pubblico, avviso_in_attesa")
    .order("nome_pubblico");
  return (data ?? []).flatMap(daRigaModerazione);
}

/** The one name the moderation email points at (§6.5): `?utente=<identificativo>`. */
export async function nomeInModerazione(
  client: Client,
  utenteId: string,
): Promise<NomeInModerazione | null> {
  const { data } = await client
    .from("nomi_pubblici_moderazione")
    .select("id, nome_pubblico, mostra_nome_pubblico, avviso_in_attesa")
    .eq("id", utenteId)
    .maybeSingle();
  return data ? (daRigaModerazione(data)[0] ?? null) : null;
}

/**
 * The clear action of §6.5 level 3. Everything happens inside the database
 * in one statement: the name is emptied, the switch goes off, the register
 * gets its row and the person's notice is raised. Bookings are not touched.
 */
export async function azzeraNomePubblico(
  client: Client,
  utenteId: string,
): Promise<Esito<string>> {
  const { data, error } = await client.rpc("azzera_nome_pubblico", { p_utente_id: utenteId });
  if (error) return fallito(error.code);
  return { ok: true, valore: data?.[0]?.nome_rimosso ?? "" };
}

/** The register of §5.9: who cleared what, and when. Never an email. */
export type ModerazioneRegistrata = {
  id: string;
  utenteId: string;
  nomeRimosso: string;
  avvenutaIl: string;
};

export async function registroModerazioni(client: Client): Promise<ModerazioneRegistrata[]> {
  const { data } = await client
    .from("moderazioni")
    .select("id, utente_id, nome_rimosso, avvenuta_il")
    .order("avvenuta_il", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    utenteId: r.utente_id,
    nomeRimosso: r.nome_rimosso,
    avvenutaIl: r.avvenuta_il,
  }));
}

// ---------------------------------------------------------------------------
// Prenotazioni da controllare — §8.2, §8.4
// ---------------------------------------------------------------------------

/** Why a booking needs a human. The view produces exactly these five values. */
export type MotivoDaVerificare =
  | "SEDE_SOSPESA"
  | "FUORI_STAGIONE"
  | "CHIUSURA"
  | "GIORNO_CHIUSO"
  | "CAPIENZA_RIDOTTA";

export type PrenotazioneDaVerificare = {
  id: string;
  sedeId: string;
  sedeNome: string;
  data: DataISO;
  fascia: Fascia;
  /** The address to write to (§8.4). Empty on an anonymised row, which has nobody left to warn. */
  email: string;
  motivo: MotivoDaVerificare;
};

const MOTIVI: MotivoDaVerificare[] = [
  "SEDE_SOSPESA",
  "FUORI_STAGIONE",
  "CHIUSURA",
  "GIORNO_CHIUSO",
  "CAPIENZA_RIDOTTA",
];

/**
 * The bookings a change has left behind (§8.2, §8.4). Reading them is all
 * the panel does: there is no companion function that cancels one, and
 * there must never be (rule 6).
 */
export async function prenotazioniDaVerificare(
  client: Client,
  sedeId?: string,
): Promise<PrenotazioneDaVerificare[]> {
  let query = client
    .from("prenotazioni_da_verificare")
    .select("prenotazione_id, sede_id, sede_nome, data, fascia, email, motivo");
  if (sedeId) query = query.eq("sede_id", sedeId);
  const { data } = await query.order("data");
  return (data ?? []).flatMap((r) => {
    const motivo = MOTIVI.find((v) => v === r.motivo);
    return r.prenotazione_id === null || r.sede_id === null || r.data === null || !r.fascia || !motivo
      ? []
      : [
          {
            id: r.prenotazione_id,
            sedeId: r.sede_id,
            sedeNome: r.sede_nome ?? "",
            data: r.data,
            fascia: r.fascia,
            email: r.email ?? "",
            motivo,
          },
        ];
  });
}

// ---------------------------------------------------------------------------
// Iscrizioni da controllare — §6.7, §15.12
// ---------------------------------------------------------------------------

/**
 * Why an iscrizione needs a human. Two reasons, and §15.12 names both:
 * a capienza lowered under the number of people already signed up, and an
 * activity returned to BOZZA because the consent tick was cleared.
 */
export type MotivoIscrizioneDaVerificare = "CAPIENZA_RIDOTTA" | "ATTIVITA_RITIRATA";

export type IscrizioneDaVerificare = {
  id: string;
  attivitaId: string;
  titolo: string | null;
  data: DataISO | null;
  oraInizio: string | null;
  /** The address to write to (§8.4). Empty on an anonymised row, which has nobody left to warn. */
  email: string;
  motivo: MotivoIscrizioneDaVerificare;
};

const MOTIVI_ISCRIZIONE: MotivoIscrizioneDaVerificare[] = [
  "CAPIENZA_RIDOTTA",
  "ATTIVITA_RITIRATA",
];

/**
 * The places a change has left behind (§6.7, §15.12). The same list as the
 * bookings above and the same discipline: reading them is all the panel
 * does, and there is no companion function that cancels one from here. The
 * two admin actions that may touch somebody else's iscrizione are the ones
 * of §15.9, and they live in lib/db/iscritti.ts where a person presses them
 * deliberately (rule 29).
 */
export async function iscrizioniDaVerificare(client: Client): Promise<IscrizioneDaVerificare[]> {
  const { data } = await client
    .from("iscrizioni_da_verificare")
    .select("iscrizione_id, attivita_id, titolo, data, ora_inizio, email, motivo")
    .order("data");
  return (data ?? []).flatMap((r) => {
    const motivo = MOTIVI_ISCRIZIONE.find((v) => v === r.motivo);
    return r.iscrizione_id === null || r.attivita_id === null || !motivo
      ? []
      : [
          {
            id: r.iscrizione_id,
            attivitaId: r.attivita_id,
            titolo: r.titolo,
            data: r.data,
            oraInizio: r.ora_inizio,
            email: r.email ?? "",
            motivo,
          },
        ];
  });
}
