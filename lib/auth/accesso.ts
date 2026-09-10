/**
 * Sign-in by email link — SPEC §6.1, §8.4.
 *
 * Pure functions over a Supabase client: the Next.js layer (server actions,
 * route handler) and the tests call the same code. Nothing here reads
 * cookies, headers or the environment, and nothing here logs: an email
 * address or a link token must never end up in a log (CLAUDE.md rule 4).
 */

import { MAX_LINK_PER_EMAIL_ORA, MAX_LINK_PER_RETE_ORA } from "@/config/limits";
import type { Client } from "@/lib/db/client";
import { impronta, normalizzaEmail } from "./impronte";

export type EsitoRichiestaLink =
  /** The provider accepted the request; an email is on its way. */
  | "INVIATO"
  /** The address is not shaped like an email. */
  | "EMAIL_NON_VALIDA"
  /** Over the hourly limit for this email or this network (§6.1). Nothing sent. */
  | "LIMITE"
  /** The provider refused or failed. Nothing sent. */
  | "ERRORE";

export type RichiestaLink = {
  email: string;
  /** Network address of the caller, as seen by the server. */
  rete: string;
  /** Server-side secret for the fingerprints (never the same as any key). */
  chiaveImpronte: string;
};

/**
 * Asks Supabase Auth to send the link. The request limit is checked first,
 * so a refused request costs no email. Whether the address belongs to an
 * existing account is never revealed by the outcome: INVIATO and LIMITE
 * are shown to the person with the same sentence (§6.1).
 */
export async function richiediLink(client: Client, richiesta: RichiestaLink): Promise<EsitoRichiestaLink> {
  const email = normalizzaEmail(richiesta.email);
  if (!email) return "EMAIL_NON_VALIDA";

  const { data: consentita, error: erroreLimite } = await client.rpc("consenti_richiesta_link", {
    p_impronta_email: impronta(email, richiesta.chiaveImpronte),
    p_impronta_rete: impronta(richiesta.rete, richiesta.chiaveImpronte),
    p_max_email: MAX_LINK_PER_EMAIL_ORA,
    p_max_rete: MAX_LINK_PER_RETE_ORA,
  });
  if (erroreLimite) return "ERRORE";
  if (!consentita) return "LIMITE";

  // shouldCreateUser: registration and sign-in are one flow (§6.1). The
  // profile row is created by the database when the link is used, not now.
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return "ERRORE";
  return "INVIATO";
}

/** Link types the email templates emit (supabase/templates). */
export const TIPI_LINK = ["magiclink", "signup", "email"] as const;
export type TipoLink = (typeof TIPI_LINK)[number];

export function isTipoLink(valore: string | null | undefined): valore is TipoLink {
  return (TIPI_LINK as readonly string[]).includes(valore ?? "");
}

export type EsitoVerifica =
  | { ok: true; primoAccesso: boolean }
  /** Used, expired or malformed link: the person can ask for another (§8.4). */
  | { ok: false };

/**
 * Opens the session from a link. The token is consumed by the provider on
 * first use (single use, §6.1). On success the client holds the session and
 * the database records the access, telling whether it is the first one.
 */
export async function verificaLink(
  client: Client,
  link: { tokenHash: string; tipo: TipoLink },
): Promise<EsitoVerifica> {
  const { error } = await client.auth.verifyOtp({ type: link.tipo, token_hash: link.tokenHash });
  if (error) return { ok: false };

  const { data: primoAccesso } = await client.rpc("registra_accesso");
  return { ok: true, primoAccesso: primoAccesso === true };
}

/** Closes the session everywhere the provider knows it and clears the cookie. */
export async function esci(client: Client): Promise<void> {
  await client.auth.signOut();
}
