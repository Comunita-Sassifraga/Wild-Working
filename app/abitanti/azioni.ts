"use server";

/**
 * Entering the module with the card — SPEC §15.4.
 *
 * The code is read from the form, fingerprinted inside `consumaCodice`, and
 * gone. It never reaches an address, a message, a log or an error (rule 23):
 * what travels back is one word out of five, and a refusal is one single
 * word whether the code was unknown, already somebody else's, revoked, or
 * from last year's edition (§15.4).
 *
 * The whole of the check is in the database — the hourly limit, the
 * consumption, the abilitazione — because a page cannot be trusted to have
 * run (rule 22).
 */

import { redirect } from "next/navigation";
import { consumaCodice } from "@/lib/db/abitanti";
import { clientServer } from "@/lib/db/server";
import { envServer } from "@/lib/env";

const PAGINA = "/abitanti";

export async function inserisciCodiceAzione(formData: FormData): Promise<void> {
  const client = await clientServer();
  const scritto = String(formData.get("codice") ?? "").trim();
  if (!scritto) redirect(`${PAGINA}?esito=RIFIUTATO`);

  const esito = await consumaCodice(client, scritto, envServer().chiaveImpronte);
  // On success the address carries nothing: the page re-reads the
  // abilitazione from the database and shows what that person may see.
  redirect(esito === "ABILITATO" || esito === "GIA_ABILITATO" ? PAGINA : `${PAGINA}?esito=${esito}`);
}
