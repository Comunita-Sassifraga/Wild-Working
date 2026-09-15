"use server";

/**
 * One sede: its data, its periodi di attività and its chiusure — SPEC §6.7,
 * §5.2, §5.7, §5.4.
 *
 * None of these writes ever touches a prenotazione. Lowering the capienza,
 * closing a day or shortening a season leaves every existing booking exactly
 * where it is, and the page shows the ones that no longer fit so that a
 * person can act (§8.2, §8.4, rule 6).
 */

import { redirect } from "next/navigation";
import {
  aggiornaSede,
  creaChiusura,
  creaPeriodo,
  eliminaChiusura,
  eliminaPeriodo,
  eliminaSede,
  GIORNI_SETTIMANA,
  type GiornoApertura,
} from "@/lib/db/amministrazione";
import { FASCE, type Fascia } from "@/lib/db/prenotazioni";
import { colonnaDaPosizione, posizioneDaTesto } from "@/lib/mappa";
import { amministratore } from "../../guardia";

const testo = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function indirizzoSede(sedeId: string, coda: string): string {
  return `/amministrazione/sedi/${sedeId}${coda}`;
}

export async function salvaSedeAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const sedeId = testo(formData.get("sede"));
  if (!sedeId) redirect("/amministrazione/sedi");

  const nome = testo(formData.get("nome"));
  const comune = testo(formData.get("comune"));
  const capienza = Number(formData.get("capienza"));
  const giorni = formData
    .getAll("giorni")
    .map(String)
    .filter((g): g is GiornoApertura => GIORNI_SETTIMANA.some((v) => v === g));

  if (!nome || !comune || !Number.isInteger(capienza) || capienza < 0) {
    redirect(indirizzoSede(sedeId, "?errore=datiIncompleti"));
  }

  // The position is optional, but two numbers that do not read as a position
  // are a mistake worth saying out loud: saved silently as nothing, they
  // would leave "Dove si trova" missing with no explanation (§6.2).
  const scritta = testo(formData.get("posizione"));
  const posizione = scritta ? posizioneDaTesto(scritta) : null;
  if (scritta && !posizione) {
    redirect(indirizzoSede(sedeId, "?errore=posizioneIlleggibile"));
  }

  const esito = await aggiornaSede(client, sedeId, {
    nome,
    comune,
    indirizzo: testo(formData.get("indirizzo")) || null,
    capienza,
    ora_inizio_mattina: testo(formData.get("ora_inizio_mattina")),
    ora_fine_mattina: testo(formData.get("ora_fine_mattina")),
    ora_inizio_pomeriggio: testo(formData.get("ora_inizio_pomeriggio")),
    ora_fine_pomeriggio: testo(formData.get("ora_fine_pomeriggio")),
    giorni_apertura: giorni,
    note: testo(formData.get("note")) || null,
    coordinate: posizione ? colonnaDaPosizione(posizione) : null,
    attiva: formData.get("attiva") !== null,
    sempre_disponibile: formData.get("sempre_disponibile") !== null,
  });

  redirect(indirizzoSede(sedeId, esito.ok ? "?salvato=sede" : `?errore=${esito.motivo}`));
}

/**
 * Deletes a sede. The database refuses while any booking still points at it,
 * which is the answer we want: a sede that has been used is suspended, not
 * removed. The page says so.
 */
export async function eliminaSedeAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const sedeId = testo(formData.get("sede"));
  if (!sedeId) redirect("/amministrazione/sedi");

  const esito = await eliminaSede(client, sedeId);
  if (!esito.ok) redirect(indirizzoSede(sedeId, `?errore=${esito.motivo}`));
  redirect("/amministrazione/sedi");
}

export async function creaPeriodoAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const sedeId = testo(formData.get("sede"));
  if (!sedeId) redirect("/amministrazione/sedi");

  const etichetta = testo(formData.get("etichetta"));
  const inizio = testo(formData.get("data_inizio"));
  const fine = testo(formData.get("data_fine"));

  if (!etichetta || !inizio || !fine) redirect(indirizzoSede(sedeId, "?errore=datiIncompleti"));
  if (fine < inizio) redirect(indirizzoSede(sedeId, "?errore=dateInvertite"));

  const esito = await creaPeriodo(client, {
    sede_id: sedeId,
    data_inizio: inizio,
    data_fine: fine,
    etichetta,
    ricorre_ogni_anno: formData.get("ricorre_ogni_anno") !== null,
  });

  redirect(indirizzoSede(sedeId, esito.ok ? "?salvato=periodo" : `?errore=${esito.motivo}`));
}

export async function eliminaPeriodoAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const sedeId = testo(formData.get("sede"));
  const periodoId = testo(formData.get("periodo"));
  if (!sedeId || !periodoId) redirect("/amministrazione/sedi");

  const esito = await eliminaPeriodo(client, periodoId);
  redirect(indirizzoSede(sedeId, esito.ok ? "?salvato=periodo" : `?errore=${esito.motivo}`));
}

export async function creaChiusuraAzione(formData: FormData): Promise<void> {
  const { client, id } = await amministratore();
  const sedeId = testo(formData.get("sede"));
  if (!sedeId) redirect("/amministrazione/sedi");

  const inizio = testo(formData.get("data_inizio"));
  const fine = testo(formData.get("data_fine"));
  const scelta = testo(formData.get("fascia"));
  // An empty choice is "tutto il giorno": a chiusura without a fascia covers
  // every fascia of the day (§5.4).
  const fascia: Fascia | null = FASCE.find((f) => f === scelta) ?? null;

  if (!inizio || !fine) redirect(indirizzoSede(sedeId, "?errore=datiIncompleti"));
  if (fine < inizio) redirect(indirizzoSede(sedeId, "?errore=dateInvertite"));

  const esito = await creaChiusura(client, {
    sede_id: sedeId,
    data_inizio: inizio,
    data_fine: fine,
    fascia,
    creata_da: id,
  });

  redirect(indirizzoSede(sedeId, esito.ok ? "?salvato=chiusura" : `?errore=${esito.motivo}`));
}

export async function eliminaChiusuraAzione(formData: FormData): Promise<void> {
  const { client } = await amministratore();
  const sedeId = testo(formData.get("sede"));
  const chiusuraId = testo(formData.get("chiusura"));
  if (!sedeId || !chiusuraId) redirect("/amministrazione/sedi");

  const esito = await eliminaChiusura(client, chiusuraId);
  redirect(indirizzoSede(sedeId, esito.ok ? "?salvato=chiusura" : `?errore=${esito.motivo}`));
}
