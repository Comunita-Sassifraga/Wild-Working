"use server";

/**
 * Server Action for booking — SPEC §6.3, §12 step 5.
 *
 * The action carries the request to the database and turns a refusal into a
 * word for the address bar. It decides nothing: whether a slot can be booked
 * is answered by `sede_prenotabile()` inside `prenota_slot`, at write time
 * (§8.4), never here and never at page load.
 *
 * Nothing personal is logged, here or anywhere (rule 4).
 */

import { redirect } from "next/navigation";
import { clientServer } from "@/lib/db/server";
import {
  FASCE,
  prenotaGiornata,
  prenotaPosto,
  type EsitoPrenotazione,
  type Fascia,
} from "@/lib/db/prenotazioni";

/** Refusal → the key of the sentence in messages/it.json (prenota.errori). */
function motivoPerIndirizzo(esito: Extract<EsitoPrenotazione, { ok: false }>): string {
  switch (esito.motivo) {
    case "POSTI_ESAURITI":
      return "esaurito";
    case "PRENOTAZIONE_DUPLICATA":
      return "duplicata";
    case "SEDE_CHIUSA":
    case "SEDE_NON_DISPONIBILE":
      return "chiusa";
    case "FUORI_FINESTRA":
      return "finestra";
    case "GIORNATA_INCOMPLETA":
      return esito.fasciaPiena === "MATTINA" ? "giornataMattina" : "giornataPomeriggio";
    default:
      return "generico";
  }
}

export async function prenotaAzione(formData: FormData): Promise<void> {
  const sedeId = String(formData.get("sede") ?? "");
  const data = String(formData.get("data") ?? "");
  const fascia = String(formData.get("fascia") ?? "") as Fascia;
  const giornata = formData.get("giornata") !== null;
  if (!sedeId || !data || !FASCE.includes(fascia)) redirect("/");

  const client = await clientServer();
  const esito = giornata
    ? await prenotaGiornata(client, { sedeId, data })
    : await prenotaPosto(client, { sedeId, data, fascia });

  if (esito.ok) redirect(`/prenotazioni?confermata=${esito.id}`);
  if (esito.motivo === "ACCESSO_RICHIESTO") redirect("/accedi");

  const indietro = new URLSearchParams({
    sede: sedeId,
    data,
    fascia,
    errore: motivoPerIndirizzo(esito),
  });
  redirect(`/prenota?${indietro}`);
}
