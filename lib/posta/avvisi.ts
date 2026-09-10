/**
 * The two moderation emails of SPEC §6.5.
 *
 * Level 2, the notice to the amministratore: sent every time the text of a
 * public name is set or changed, and only then. It carries the name and the
 * internal id, and **never the person's email address** — that is deliberate
 * and specified (CLAUDE.md rule 4, scope note): the id is what the
 * amministratore acts on, and it does not say who the person is.
 *
 * Level 3, the notice to the person: sent when the amministratore clears
 * their name. Its text is the very same one the settings page shows, read
 * from the same key: the two must never drift apart.
 */

import { EMAIL_MODERAZIONE, URL_APP } from "@/config/limits";
import { clientDiServizio } from "@/lib/db/servizio";
import { emailPerAvviso } from "@/lib/db/utenti";
import { conValori, m } from "@/lib/messaggi";
import { invia, type EsitoInvio } from "./trasporto";

/** The moderation screen, opened on the name in question (§6.5, §6.7). */
function indirizzoModerazione(utenteId: string): string {
  return `${URL_APP}/amministrazione/moderazione?utente=${utenteId}`;
}

/**
 * Warns the board mailbox that a public name was set or changed.
 *
 * Silently does nothing when EMAIL_MODERAZIONE is not configured (§10 leaves
 * the address to be defined): a missing parameter must not make a person's
 * save fail. Nothing is written anywhere about it — the caller ignores the
 * outcome for the same reason.
 */
export async function avvisaModerazione(dati: {
  nomePubblico: string;
  utenteId: string;
}): Promise<EsitoInvio> {
  if (!EMAIL_MODERAZIONE) return { ok: false, motivo: "EMAIL_MODERAZIONE non configurata" };
  return invia({
    a: EMAIL_MODERAZIONE,
    oggetto: m.posta.moderazione.oggetto,
    testo: conValori(m.posta.moderazione.testo, {
      nome: dati.nomePubblico,
      utente: dati.utenteId,
      url: indirizzoModerazione(dati.utenteId),
    }),
  });
}

/**
 * Tells a person that their public name has been removed (§6.5 level 3).
 *
 * Reads the address with the backend client: the amministratore who pressed
 * the button neither sees it nor could read it. The message says the same
 * thing the settings page will say at their next visit.
 */
export async function avvisaNomeRimosso(utenteId: string): Promise<EsitoInvio> {
  const email = await emailPerAvviso(clientDiServizio(), utenteId);
  if (!email) return { ok: false, motivo: "nessun indirizzo per questa persona" };
  return invia({
    a: email,
    oggetto: m.posta.azzeramento.oggetto,
    testo: m.impostazioni.moderazione.testo,
  });
}
