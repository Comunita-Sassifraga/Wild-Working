"use server";

/**
 * Server Action for cancelling — SPEC §6.4.
 *
 * One click, no further confirmation. The deadline ("fino all'orario di
 * inizio della fascia") is part of the access policy on `prenotazioni`: a
 * late cancellation changes no row and comes back here as a refusal, so the
 * rule holds even if this file were wrong (§8.3).
 */

import { redirect } from "next/navigation";
import { annullaGiornata, annullaPrenotazione } from "@/lib/db/prenotazioni";
import { clientServer } from "@/lib/db/server";

export async function annullaAzione(formData: FormData): Promise<void> {
  const id = String(formData.get("prenotazione") ?? "");
  const gruppo = String(formData.get("gruppo") ?? "");
  if (!id && !gruppo) redirect("/prenotazioni");

  const client = await clientServer();
  const esito = gruppo
    ? await annullaGiornata(client, gruppo)
    : await annullaPrenotazione(client, id);

  // Nothing changed: either the fascia has already begun, or the row is not
  // the caller's — which the page cannot show in the first place. Both say
  // the same thing to the person, and neither reveals anything.
  redirect(esito.ok ? "/prenotazioni?annullata=1" : "/prenotazioni?errore=tardi");
}
