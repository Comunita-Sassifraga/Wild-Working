"use server";

/**
 * Cancellazione dell'account — SPEC §7 art. 17, §8.4, §12 step 10.
 *
 * "Esecuzione immediata, non richiesta a un umano": there is no queue here
 * and there must not be one. Nothing in this file decides what erasure means
 * — the whole of it happens inside `cancella_mio_account()`, in one statement
 * that either does everything or does nothing (§8.3). This action carries the
 * answer back and closes the session.
 *
 * No email goes out: after this there is no address left to write to, and the
 * person has just been told on screen. Nothing is logged either (rule 4).
 */

import { redirect } from "next/navigation";
import { esci } from "@/lib/auth/accesso";
import { utenteAttuale } from "@/lib/auth/sessione";
import { cancellaMioAccount } from "@/lib/db/diritti";
import { clientServer } from "@/lib/db/server";

export async function cancellaAccountAzione(): Promise<void> {
  const utente = await utenteAttuale();
  if (!utente) redirect("/accedi");

  const client = await clientServer();
  const { ok } = await cancellaMioAccount(client);
  if (!ok) redirect("/impostazioni/cancella?errore=1");

  // The account is gone, so the session refers to nobody: signing out is what
  // clears the cookie from the browser. Whether the provider still recognises
  // the token no longer matters — it can open nothing.
  await esci(client);
  redirect("/?cancellato=1");
}
