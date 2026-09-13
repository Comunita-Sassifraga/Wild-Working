/**
 * The two emails the amministratore's actions carry with them — SPEC §15.10,
 * rows three and four, and §15.9.
 *
 * They are here at step 18 and not at step 19 because §15.9 makes them a
 * condition of the actions themselves, not an improvement on them: *"La
 * persona lo viene a sapere. [...] Un posto che sparisce senza spiegazione è
 * peggio di un posto perso."* An action without its notice is not the action.
 * The other three emails of §15.10, and the reminder, arrive with step 19 —
 * the body builder below is written to be the one they reuse.
 *
 * Both messages carry the level 2 data of §15.8 — surname, telephone, exact
 * address — which is exactly what §15.10 asks the confirmation to carry, and
 * which the person is entitled to for as long as they hold the place. What
 * §15.12 notes about it is true and intended: somebody who then cancels loses
 * level 2 everywhere at once, and keeps it only in the email already sent.
 *
 * No address is ever logged, thrown or put into a message (rule 4). The
 * recipient's own address is read here, with the backend client, and never
 * reaches the amministratore who pressed the button.
 */

import { EMAIL_ASSISTENZA_ABITANTI, URL_APP } from "@/config/limits";
import { dataEstesa, ora, type DataISO } from "@/lib/dates";
import type { Attivita } from "@/lib/db/attivita";
import { clientDiServizio } from "@/lib/db/servizio";
import { emailPerAvviso } from "@/lib/db/utenti";
import { conValori, m } from "@/lib/messaggi";
import { invia, type EsitoInvio } from "./trasporto";

const t = m.posta.abitanti;

/** Where to write when something is wrong (§15.9, §15.13). */
const assistenza = (): string => EMAIL_ASSISTENZA_ABITANTI ?? m.pieDiPagina.email;

/** The page the person manages their own place from (§15.6). */
const indirizzoAttivita = (id: string): string => `${URL_APP}/abitanti/${id}`;

/**
 * The lines that describe one activity to somebody who holds a place on it
 * — SPEC §15.10: what it is, when, where exactly, who to look for, what to
 * bring, and how to give the place up.
 *
 * A card may be half-filled (§15.3.2), so every line is written only if it
 * has something to say: a message with "Quando: " and nothing after it reads
 * like a fault in the software, and the person is left no better off.
 *
 * `descrizione` is not here on purpose. It is the abitante's own words, up to
 * 4000 characters, and it belongs on the page where it can be read whole
 * (rule 26) — an email that quoted it would be quoting a third party's text
 * into a mailbox the association does not control.
 */
function corpoAttivita(attivita: Attivita): string[] {
  const righe: string[] = [];
  const aggiungi = (testo: string, valore: string | null | undefined) => {
    if (valore) righe.push(conValori(testo, { valore }));
  };

  aggiungi(t.corpo.attivita, attivita.titolo);
  if (attivita.data) {
    const quando = dataEstesa(attivita.data as DataISO);
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
  aggiungi(t.corpo.cosaPortare, attivita.cosa_portare);
  aggiungi(t.corpo.lingua, attivita.lingua_attivita);

  return righe;
}

/** Joins the parts of a plain-text message, blank line between blocks. */
const messaggio = (blocchi: (string | string[])[]): string =>
  blocchi
    .map((b) => (Array.isArray(b) ? b.join("\n") : b))
    .filter((b) => b.length > 0)
    .join("\n\n");

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
  attivita: Attivita,
): Promise<EsitoInvio> {
  const email = await emailPerAvviso(clientDiServizio(), utenteId);
  if (!email) return { ok: false, motivo: "nessun indirizzo per questa persona" };

  return invia({
    a: email,
    oggetto: conValori(t.iscritta.oggetto, { attivita: attivita.titolo ?? t.senzaTitolo }),
    testo: messaggio([
      t.iscritta.apertura,
      corpoAttivita(attivita),
      conValori(t.iscritta.perConto, { indirizzo: assistenza() }),
      attivita.id ? conValori(t.corpo.collegamento, { url: indirizzoAttivita(attivita.id) }) : "",
      t.iscritta.chiusura,
    ]),
  });
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
  attivita: Attivita,
  motivo: string,
): Promise<EsitoInvio> {
  const email = await emailPerAvviso(clientDiServizio(), utenteId);
  if (!email) return { ok: false, motivo: "nessun indirizzo per questa persona" };

  const quando = attivita.data ? dataEstesa(attivita.data as DataISO) : null;

  return invia({
    a: email,
    oggetto: conValori(t.annullata.oggetto, { attivita: attivita.titolo ?? t.senzaTitolo }),
    testo: messaggio([
      conValori(quando ? t.annullata.aperturaConData : t.annullata.apertura, {
        attivita: attivita.titolo ?? t.senzaTitolo,
        data: quando ?? "",
      }),
      motivo ? conValori(t.annullata.motivo, { motivo }) : "",
      conValori(t.annullata.contatto, { indirizzo: assistenza() }),
      t.annullata.chiusura,
    ]),
  });
}
