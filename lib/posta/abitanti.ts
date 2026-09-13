/**
 * The emails of «Prenota un abitante» — SPEC §15.10, §15.9, §15.12.
 *
 * Six messages, and they arrived in two goes. Two of them are here since
 * step 18, because §15.9 makes them a condition of the amministratore's own
 * actions and not an improvement on them: *"La persona lo viene a sapere.
 * [...] Un posto che sparisce senza spiegazione è peggio di un posto perso."*
 * An action without its notice is not the action.
 *
 * Step 19 brings the other four:
 *
 *   confermaIscrizione       somebody took a place themselves (§15.10 row 1)
 *   confermaAnnullamento     somebody gave one up themselves (row 2)
 *   avvisaAttivitaAnnullata  the activity is off (row 6, §15.12)
 *
 * and the reminder of the evening before, which is not here but in
 * lib/posta/promemoria.ts, next to the one for desks: it is the same nightly
 * run with one list more (§15.10), and the two belong together.
 *
 * Every message that goes to somebody holding a place carries the level 2
 * data of §15.8 — surname, telephone, exact address — which is exactly what
 * §15.10 asks of the confirmation, and which the person is entitled to for
 * as long as they hold the place. What §15.12 notes about it is true and
 * intended: somebody who then cancels loses level 2 everywhere at once, and
 * keeps it only in the email already sent.
 *
 * No address is ever logged, thrown or put into a message (rule 4). The
 * recipient's own address is read here, with the backend client, and never
 * reaches the amministratore who pressed the button.
 */

import { EMAIL_ASSISTENZA_ABITANTI, URL_APP } from "@/config/limits";
import { dataEstesa, ora, type DataISO } from "@/lib/dates";
import { clientDiServizio } from "@/lib/db/servizio";
import { emailPerAvviso } from "@/lib/db/utenti";
import { conValori, m } from "@/lib/messaggi";
import { invia, type EsitoInvio } from "./trasporto";

const t = m.posta.abitanti;

/**
 * What a message needs to know about an activity, and no more.
 *
 * Deliberately a shape and not one of the view types: the same words are
 * built from three different windows of §15.8 — the panel's
 * `attivita_amministrazione`, the participant's `attivita_iscritto`, and the
 * rows the nightly job claims — and all three carry these fields under these
 * names.
 *
 * `descrizione` is absent on purpose. It is the abitante's own words, up to
 * 4000 characters, and it belongs on the page where it can be read whole
 * (rule 26): an email that quoted it would be copying a third party's text
 * into a mailbox the association does not control.
 */
export type SchedaPerEmail = {
  id: string | null;
  titolo: string | null;
  data: string | null;
  ora_inizio: string | null;
  luogo_generico: string | null;
  luogo_esatto: string | null;
  abitante_nome: string | null;
  abitante_cognome: string | null;
  abitante_telefono: string | null;
  cosa_portare: string | null;
  lingua_attivita: string | null;
};

/** Where to write when something is wrong (§15.9, §15.13). */
const assistenza = (): string => EMAIL_ASSISTENZA_ABITANTI ?? m.pieDiPagina.email;

/** The page the person manages their own place from (§15.6). */
const indirizzoAttivita = (id: string): string => `${URL_APP}/abitanti/${id}`;

/** The title, or a phrase that reads like one when the card has none (§15.3.2). */
const titoloDi = (scheda: SchedaPerEmail): string => scheda.titolo ?? t.senzaTitolo;

/** The day in words, or nothing at all when the card has no date yet. */
const quandoDi = (scheda: SchedaPerEmail): string | null =>
  scheda.data ? dataEstesa(scheda.data as DataISO) : null;

/**
 * The lines that describe one activity to somebody who holds a place on it
 * — SPEC §15.10: what it is, when, where exactly, who to look for, what to
 * bring, and how to give the place up.
 *
 * A card may be half-filled (§15.3.2), so every line is written only if it
 * has something to say: a message with "Quando: " and nothing after it reads
 * like a fault in the software, and the person is left no better off.
 */
export function righeAttivita(attivita: SchedaPerEmail): string[] {
  const righe: string[] = [];
  const aggiungi = (testo: string, valore: string | null | undefined) => {
    if (valore) righe.push(conValori(testo, { valore }));
  };

  aggiungi(t.corpo.attivita, attivita.titolo);
  const quando = quandoDi(attivita);
  if (quando) {
    righe.push(
      conValori(t.corpo.quando, {
        valore: attivita.ora_inizio ? `${quando}, ${ora(attivita.ora_inizio)}` : quando,
      }),
    );
  }
  // Level 2 of §15.8: the exact address and the full name of who is waiting.
  aggiungi(t.corpo.luogo, attivita.luogo_esatto ?? attivita.luogo_generico);
  aggiungi(
    t.corpo.chiTiAspetta,
    [attivita.abitante_nome, attivita.abitante_cognome].filter(Boolean).join(" ") || null,
  );
  aggiungi(t.corpo.telefono, attivita.abitante_telefono);
  // The sentence §15.6 puts beside the telephone on the page, in the message
  // that carries the same number. It was given for one purpose by somebody
  // who is not a user of this software, and the purpose travels with it.
  if (attivita.abitante_telefono) {
    righe.push(conValori(t.corpo.notaTelefono, { nome: attivita.abitante_nome ?? t.chiTiOspita }));
  }
  aggiungi(t.corpo.cosaPortare, attivita.cosa_portare);
  aggiungi(t.corpo.lingua, attivita.lingua_attivita);

  return righe;
}

/** The line that leads back to the activity, when the card has an id. */
const collegamento = (attivita: SchedaPerEmail): string =>
  attivita.id ? conValori(t.corpo.collegamento, { url: indirizzoAttivita(attivita.id) }) : "";

/** Joins the parts of a plain-text message, blank line between blocks. */
const messaggio = (blocchi: (string | string[])[]): string =>
  blocchi
    .map((b) => (Array.isArray(b) ? b.join("\n") : b))
    .filter((b) => b.length > 0)
    .join("\n\n");

/**
 * Sends one message to one person, found by their internal id.
 *
 * The address is read here and nowhere else: it never travels through a
 * page, never appears in an address bar, and never reaches whoever caused
 * the message to be sent (rule 4). Somebody whose row has gone — an account
 * closed between the write and the send — is a refusal, never a throw.
 */
async function aPersona(
  utenteId: string,
  costruisci: (a: string) => { a: string; oggetto: string; testo: string },
): Promise<EsitoInvio> {
  const email = await emailPerAvviso(clientDiServizio(), utenteId);
  if (!email) return { ok: false, motivo: "nessun indirizzo per questa persona" };
  return invia(costruisci(email));
}

// ---------------------------------------------------------------------------
// What a person does for themselves — §15.10 rows one and two
// ---------------------------------------------------------------------------

/**
 * "Hai un posto" — SPEC §15.10 row one, and the sentence §15.14 uses to say
 * step 19 is finished: *"chi si iscrive riceve la conferma con l'indirizzo
 * di casa di Maria."*
 *
 * It is the one email of this module that is not about something changing:
 * it is the address to walk to, in a place that works without the app and
 * without a signal, which is the whole reason to send it at all.
 */
export async function confermaIscrizione(
  utenteId: string,
  attivita: SchedaPerEmail,
): Promise<EsitoInvio> {
  return aPersona(utenteId, (a) => ({
    a,
    oggetto: conValori(t.conferma.oggetto, { attivita: titoloDi(attivita) }),
    testo: messaggio([
      t.conferma.apertura,
      righeAttivita(attivita),
      collegamento(attivita),
      t.conferma.chiusura,
    ]),
  }));
}

/**
 * "Hai annullato" — SPEC §15.10 row two: *"Conferma sobria, nessun
 * rimprovero."*
 *
 * Nothing of level 2 in it. The place has been given up, and §15.8 takes the
 * surname, the telephone and the exact address away in the same instant
 * (§15.12): a message sent afterwards must not hand them back.
 */
export async function confermaAnnullamento(
  utenteId: string,
  attivita: SchedaPerEmail,
): Promise<EsitoInvio> {
  const quando = quandoDi(attivita);
  return aPersona(utenteId, (a) => ({
    a,
    oggetto: conValori(t.annullamento.oggetto, { attivita: titoloDi(attivita) }),
    testo: messaggio([
      conValori(quando ? t.annullamento.aperturaConData : t.annullamento.apertura, {
        attivita: titoloDi(attivita),
        data: quando ?? "",
      }),
      t.annullamento.chiusura,
      conValori(t.corpo.altre, { url: `${URL_APP}/abitanti` }),
    ]),
  }));
}

// ---------------------------------------------------------------------------
// What the amministratore does — §15.10 rows three, four and six
// ---------------------------------------------------------------------------

/**
 * "Non si farà" — SPEC §15.10 row six, §15.12: *"Attività annullata con
 * iscritti: l'amministratore conferma; tutti gli iscritti ricevono
 * l'email."*
 *
 * Sent once to each person the database has just taken a place from — the
 * set `annulla_attivita()` returns, not a set read beforehand: reading the
 * iscritti first and cancelling after would leave a gap in which somebody
 * takes the last place and is never told the activity is off.
 *
 * The reason is typed by the amministratore and is stored nowhere: §15.3.2
 * has no column for it and none is being added (rule 20). It travels in
 * these messages and stops there.
 */
export async function avvisaAttivitaAnnullata(
  utenteId: string,
  attivita: SchedaPerEmail,
  motivo: string,
): Promise<EsitoInvio> {
  const quando = quandoDi(attivita);
  return aPersona(utenteId, (a) => ({
    a,
    oggetto: conValori(t.attivitaAnnullata.oggetto, { attivita: titoloDi(attivita) }),
    testo: messaggio([
      conValori(quando ? t.attivitaAnnullata.aperturaConData : t.attivitaAnnullata.apertura, {
        attivita: titoloDi(attivita),
        data: quando ?? "",
      }),
      motivo ? conValori(t.attivitaAnnullata.motivo, { motivo }) : "",
      conValori(t.attivitaAnnullata.contatto, { indirizzo: assistenza() }),
      t.attivitaAnnullata.chiusura,
      conValori(t.corpo.altre, { url: `${URL_APP}/abitanti` }),
    ]),
  }));
}

/**
 * "Ti abbiamo iscritto" — SPEC §15.10 row three.
 *
 * Like the confirmation, plus the line that says somebody else did it and
 * who to write to if it is a mistake (§15.9). That line is the whole reason
 * this email exists: a place that appears without explanation is as puzzling
 * as one that disappears.
 */
export async function avvisaIscrizioneDaAmministratore(
  utenteId: string,
  attivita: SchedaPerEmail,
): Promise<EsitoInvio> {
  return aPersona(utenteId, (a) => ({
    a,
    oggetto: conValori(t.iscritta.oggetto, { attivita: titoloDi(attivita) }),
    testo: messaggio([
      t.iscritta.apertura,
      righeAttivita(attivita),
      conValori(t.iscritta.perConto, { indirizzo: assistenza() }),
      collegamento(attivita),
      t.iscritta.chiusura,
    ]),
  }));
}

/**
 * "La tua iscrizione è stata annullata" — SPEC §15.10 row four.
 *
 * What happened, the reason if there is one, and who to write to. Sober and
 * without reproach: the person did nothing wrong, and most of the time this
 * is a swap they agreed to themselves.
 *
 * The reason is typed by the amministratore and is stored nowhere — there is
 * no column for it in §15.3.3 and none is being added (rule 20). It travels
 * in this message and stops here.
 */
export async function avvisaAnnullamentoDaAmministratore(
  utenteId: string,
  attivita: SchedaPerEmail,
  motivo: string,
): Promise<EsitoInvio> {
  const quando = quandoDi(attivita);
  return aPersona(utenteId, (a) => ({
    a,
    oggetto: conValori(t.annullata.oggetto, { attivita: titoloDi(attivita) }),
    testo: messaggio([
      conValori(quando ? t.annullata.aperturaConData : t.annullata.apertura, {
        attivita: titoloDi(attivita),
        data: quando ?? "",
      }),
      motivo ? conValori(t.annullata.motivo, { motivo }) : "",
      conValori(t.annullata.contatto, { indirizzo: assistenza() }),
      t.annullata.chiusura,
    ]),
  }));
}
