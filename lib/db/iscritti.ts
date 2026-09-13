/**
 * «Prenota un abitante» — who is coming, and the two things an
 * amministratore may do about it. SPEC §15.9, §15.7, §15.12, D22.
 *
 * Two powers that exist for `iscrizioni` and for nothing else. There is no
 * equivalent of any of this for `prenotazioni`, and there is not going to be
 * one: §8.2 leaves a list to look at and no button that cancels (rule 6).
 * Nothing in this file names a `prenotazione`, and nothing it calls can
 * reach one.
 *
 * Reading goes through `iscritti_amministrazione`, which carries the email
 * address §15.9 asks for and stops at the day after the activity. Writing
 * goes through the two functions of *_iscrizioni_amministratore.sql. As
 * everywhere else, nothing here decides who may do what: the view and the
 * functions refuse a non-amministratore on their own (§8.3, rule 2). What
 * this module does is turn a refusal into a reason a page can say in Italian.
 */

import type { Client } from "./client";
import type { Database } from "./types";

/**
 * One person on an activity, as the panel sees them — SPEC §15.9.
 *
 * The address is here to write to, and for nothing else. `nomePubblico` is
 * filled in only for whoever switched the name on: the view applies that
 * consent itself, so a name that arrives here is a name that may be shown
 * (rule 3).
 */
export type Iscritto = {
  id: string;
  utenteId: string | null;
  email: string | null;
  nomePubblico: string | null;
  stato: Database["public"]["Enums"]["stato_iscrizione"];
  /** True when somebody other than the person took the place (§15.3.3). */
  perContoDiAltri: boolean;
  /** True when somebody other than the person gave it up (§15.3.3). */
  annullataDaAltri: boolean;
};

export type MotivoIscritti =
  /** No such iscrizione, or it had already been cancelled. */
  | "ISCRIZIONE_NON_TROVATA"
  /** §15.12: capacity binds the amministratore like everybody else. */
  | "POSTI_ESAURITI"
  /** That person already holds a place on this activity. */
  | "ISCRIZIONE_DUPLICATA"
  /** Unknown, not published, another edition, or no capienza typed in yet. */
  | "ATTIVITA_NON_DISPONIBILE"
  /** §15.9: the person holds no active abilitazione. Enable them first. */
  | "NON_ABILITATO"
  /** Its start time has passed (§15.7). */
  | "ATTIVITA_COMINCIATA"
  | "NON_AUTORIZZATO"
  | "ERRORE";

export type EsitoIscritti<T = void> =
  | { ok: true; valore: T }
  | { ok: false; motivo: MotivoIscritti };

// SQLSTATE codes raised by the two functions — see the migration.
const motiviPerCodice: Record<string, MotivoIscritti> = {
  "42501": "NON_AUTORIZZATO",
  IS001: "POSTI_ESAURITI",
  IS002: "ISCRIZIONE_DUPLICATA",
  IS003: "ATTIVITA_NON_DISPONIBILE",
  IS004: "NON_ABILITATO",
  IS005: "ATTIVITA_COMINCIATA",
  IS006: "ISCRIZIONE_NON_TROVATA",
};

function fallito(codice: string | undefined): EsitoIscritti<never> {
  return { ok: false, motivo: (codice && motiviPerCodice[codice]) || "ERRORE" };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Everybody on one activity, those who gave their place up included — SPEC
 * §15.9. The cancelled ones are kept because the swap is read afterwards:
 * whoever asks "who did I take out and who did I put in" gets an answer.
 *
 * Ordered by the moment each place was taken, which here is the order the
 * amministratore did things in. On the participants' own page the order is
 * alphabetical instead, deliberately (§15.6): there, who was quickest is
 * nobody's business.
 */
export async function iscrittiAttivita(client: Client, attivitaId: string): Promise<Iscritto[]> {
  const { data, error } = await client
    .from("iscritti_amministrazione")
    .select("id, utente_id, email, nome_pubblico, stato, creata_il, creata_da, annullata_da")
    .eq("attivita_id", attivitaId)
    .order("creata_il");
  if (error || !data) return [];
  return data.flatMap((r) =>
    r.id === null || r.stato === null
      ? []
      : [
          {
            id: r.id,
            utenteId: r.utente_id,
            email: r.email,
            nomePubblico: r.nome_pubblico,
            stato: r.stato,
            perContoDiAltri: r.creata_da !== null && r.creata_da !== r.utente_id,
            annullataDaAltri: r.annullata_da !== null && r.annullata_da !== r.utente_id,
          },
        ],
  );
}

// ---------------------------------------------------------------------------
// Writing — the two actions of §15.9
// ---------------------------------------------------------------------------

/**
 * Takes a place for somebody else — SPEC §15.9.
 *
 * Capacity binds here exactly as it binds everybody: a full activity is
 * refused (§15.12), and the swap is two acts in the right order — first the
 * one who gives up is cancelled, then the one who takes over is signed up.
 *
 * Whoever acted is written into `creata_da` for ever, and the id of the
 * person comes back so the caller can tell them (§15.9).
 */
export async function iscriviPerConto(
  client: Client,
  attivitaId: string,
  utenteId: string,
): Promise<EsitoIscritti<string>> {
  const { data, error } = await client.rpc("iscrivi_per_conto", {
    p_attivita_id: attivitaId,
    p_utente_id: utenteId,
  });
  if (error || !data) return fallito(error?.code);
  return { ok: true, valore: data };
}

/**
 * Gives somebody else's place up — SPEC §15.9.
 *
 * Returns the id of the person who has just lost it, which is what the email
 * of §15.10 is sent against. Their address is never read here and never
 * reaches whoever pressed the button (rule 4): the notice is sent by
 * lib/posta/abitanti.ts, with the backend client.
 */
export async function annullaPerConto(
  client: Client,
  iscrizioneId: string,
): Promise<EsitoIscritti<string | null>> {
  const { data, error } = await client.rpc("annulla_per_conto", {
    p_iscrizione_id: iscrizioneId,
  });
  if (error) return fallito(error.code);
  return { ok: true, valore: data ?? null };
}
