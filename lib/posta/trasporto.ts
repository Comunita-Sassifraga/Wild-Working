/**
 * Sending email — SPEC §12 step 9, §14.2.
 *
 * One door out of the application. Everything leaves from EMAIL_MITTENTE on
 * the dedicated subdomain, never from the apex domain that carries the
 * association's own mail (D12).
 *
 * Messages are plain text. Nothing the app sends needs a layout, and text
 * arrives intact in every mailbox — including the ones that strip HTML.
 *
 * No address is ever written to a log, an error or a thrown message
 * (CLAUDE.md rule 4): a failure says what failed, never to whom.
 */

import { EMAIL_MITTENTE } from "@/config/limits";
import { envPosta } from "@/lib/env";

export type Messaggio = {
  /** Recipient. Used to send, never printed. */
  a: string;
  oggetto: string;
  testo: string;
};

export type EsitoInvio = { ok: true } | { ok: false; motivo: string };

/**
 * Hands one message to the provider: Resend in production, the local Mailpit
 * everywhere else — the same mailbox the sign-in links land in, so a local
 * run shows every email the app sends in one place.
 */
export async function invia(messaggio: Messaggio): Promise<EsitoInvio> {
  const { chiaveResend, urlPostaLocale } = envPosta();
  try {
    return chiaveResend
      ? await inviaConResend(messaggio, chiaveResend)
      : await inviaAPostaLocale(messaggio, urlPostaLocale);
  } catch {
    // The reason would be the provider's own message, which can quote the
    // address it refused. Only the fact travels.
    return { ok: false, motivo: "invio non riuscito" };
  }
}

async function inviaConResend(messaggio: Messaggio, chiave: string): Promise<EsitoInvio> {
  const risposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_MITTENTE,
      to: [messaggio.a],
      subject: messaggio.oggetto,
      text: messaggio.testo,
    }),
  });
  return risposta.ok ? { ok: true } : { ok: false, motivo: `risposta ${risposta.status}` };
}

async function inviaAPostaLocale(messaggio: Messaggio, url: string): Promise<EsitoInvio> {
  const risposta = await fetch(`${url}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: EMAIL_MITTENTE },
      To: [{ Email: messaggio.a }],
      Subject: messaggio.oggetto,
      Text: messaggio.testo,
    }),
  });
  return risposta.ok ? { ok: true } : { ok: false, motivo: `risposta ${risposta.status}` };
}
