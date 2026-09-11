/**
 * SPEC §6.8 — i posti offerti, annotati notte per notte (§12 passo 11).
 *
 * Il tasso di occupazione è una frazione. Le prenotazioni, che stanno sopra,
 * restano per sempre; i posti che c'erano da prendere, che stanno sotto, non
 * lascerebbero traccia: capienza, giorni di apertura, periodi e chiusure si
 * cambiano dal pannello e riscrivono in silenzio tutto il passato.
 *
 * Qui si verifica l'unica cosa che conta davvero: quello che è stato
 * annotato una notte non cambia mai più, qualunque cosa venga modificata
 * dopo. E che l'annotazione guardi la sede com'era quel giorno — aperta o
 * chiusa — non la finestra dei 14 giorni, che per un giorno passato è sempre
 * chiusa.
 *
 * Nessuna riga di questa tabella parla di una persona (regola 15): un
 * giorno, una sede, una fascia e un numero.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, giornoSettimana, oggiRoma } from "@/lib/dates";
import { eseguiPulizie } from "@/lib/pulizie";
import {
  creaChiusura,
  creaSede,
  creaUtente,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const OGNI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;
type Fascia = "MATTINA" | "POMERIGGIO";

const oggi = oggiRoma();
const ieri = aggiungiGiorni(oggi, -1);

/** Quanti posti risulta che quella sede abbia offerto. `null` = giorno mai annotato. */
async function posti(sedeId: string, data: string, fascia: Fascia): Promise<number | null> {
  const { data: riga } = await servizio()
    .from("posti_offerti")
    .select("posti")
    .eq("sede_id", sedeId)
    .eq("data", data)
    .eq("fascia", fascia)
    .maybeSingle();
  return riga?.posti ?? null;
}

/** Fa girare l'annotazione su un intervallo preciso, come farebbe una notte. */
async function annota(da: string, a: string): Promise<number> {
  const { data, error } = await servizio().rpc("registra_posti_offerti", {
    p_da: da,
    p_fino_a: a,
  });
  expect(error).toBeNull();
  return data ?? 0;
}

// ---------------------------------------------------------------------------

describe("§6.8 l'annotazione dei posti offerti", () => {
  const sedi: string[] = [];
  const utenti: UtenteTest[] = [];

  let aperta: string; // aperta tutti i giorni, capienza 6
  let giornoChiuso: string; // chiusa proprio nel giorno di prova
  let spenta: string; // attiva = false
  let conChiusura: string; // una chiusura sulla sola mattina

  const G3 = aggiungiGiorni(oggi, -3);
  const G2 = aggiungiGiorni(oggi, -2);
  const LONTANO = aggiungiGiorni(oggi, -40); // ben fuori dalla finestra

  beforeAll(async () => {
    // I giorni di apertura tolgono proprio il giorno della settimana in cui
    // cade G3, così "chiuso quel giorno" non dipende da quando gira la prova.
    const settimanaG3 = OGNI_GIORNO[giornoSettimana(G3) - 1];

    aperta = await creaSede({ capienza: 6, giorni_apertura: [...OGNI_GIORNO] });
    giornoChiuso = await creaSede({
      capienza: 4,
      giorni_apertura: OGNI_GIORNO.filter((g) => g !== settimanaG3),
    });
    spenta = await creaSede({ capienza: 5, giorni_apertura: [...OGNI_GIORNO], attiva: false });
    conChiusura = await creaSede({ capienza: 3, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(aperta, giornoChiuso, spenta, conChiusura);

    await creaChiusura({
      sede_id: conChiusura,
      data_inizio: G3,
      data_fine: G3,
      fascia: "MATTINA",
    });
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  // -------------------------------------------------------------------------
  // Cosa viene annotato.
  // -------------------------------------------------------------------------

  it("un giorno aperto vale la capienza di quel giorno, su tutte e due le fasce", async () => {
    await annota(G3, G3);
    expect(await posti(aperta, G3, "MATTINA")).toBe(6);
    expect(await posti(aperta, G3, "POMERIGGIO")).toBe(6);
  });

  it("un giorno chiuso vale zero, e zero non è la stessa cosa di niente", async () => {
    // Chiusa per giorno della settimana: la riga c'è, e dice zero.
    expect(await posti(giornoChiuso, G3, "MATTINA")).toBe(0);
    expect(await posti(giornoChiuso, G3, "POMERIGGIO")).toBe(0);

    // Una sede spenta è annotata lo stesso, e a zero: è il fatto che quel
    // giorno non offriva niente.
    expect(await posti(spenta, G3, "MATTINA")).toBe(0);
    expect(await posti(spenta, G3, "POMERIGGIO")).toBe(0);
  });

  it("una chiusura su una sola fascia lascia l'altra in piedi", async () => {
    expect(await posti(conChiusura, G3, "MATTINA")).toBe(0);
    expect(await posti(conChiusura, G3, "POMERIGGIO")).toBe(3);
  });

  it("un giorno fuori dalla finestra dei 14 giorni è comunque annotato per quello che offriva", async () => {
    // Il punto del passo: si guarda sede_aperta, non sede_prenotabile. Un
    // giorno di quaranta giorni fa non è prenotabile da nessuno e resta un
    // giorno in cui la sede era aperta con sei posti.
    await annota(LONTANO, LONTANO);
    expect(await posti(aperta, LONTANO, "MATTINA")).toBe(6);

    const { data: prenotabile } = await servizio().rpc("sede_prenotabile", {
      p_sede_id: aperta,
      p_data: LONTANO,
      p_fascia: "MATTINA",
    });
    expect(prenotabile).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Quello che è annotato non cambia più.
  // -------------------------------------------------------------------------

  it("cambiare la capienza oggi non cambia il numero annotato ieri", async () => {
    const { error } = await servizio().from("sedi").update({ capienza: 9 }).eq("id", aperta);
    expect(error).toBeNull();

    // Stesso giorno, di nuovo: la riga c'è già e non viene toccata.
    const scritte = await annota(G3, G3);
    expect(scritte).toBe(0);
    expect(await posti(aperta, G3, "MATTINA")).toBe(6);

    // Il giorno dopo, invece, vale la capienza nuova.
    await annota(G2, G2);
    expect(await posti(aperta, G2, "MATTINA")).toBe(9);
  });

  it("chiudere oggi un giorno già passato non lo cancella dalle annotazioni", async () => {
    await creaChiusura({ sede_id: aperta, data_inizio: G2, data_fine: G2 });
    expect(await posti(aperta, G2, "MATTINA")).toBe(9);
    expect(await posti(aperta, G2, "POMERIGGIO")).toBe(9);
  });

  // -------------------------------------------------------------------------
  // Due giri sovrapposti, e una notte saltata.
  // -------------------------------------------------------------------------

  it("due giri sullo stesso giorno scrivono una volta sola", async () => {
    const primo = await annota(G3, G3);
    const secondo = await annota(G3, G3);
    expect(primo).toBe(0);
    expect(secondo).toBe(0);

    const { count } = await servizio()
      .from("posti_offerti")
      .select("*", { count: "exact", head: true })
      .eq("sede_id", aperta)
      .eq("data", G3);
    expect(count).toBe(2); // le due fasce, non quattro righe
  });

  it("una notte saltata viene recuperata al giro successivo", async () => {
    // G3 e G2 sono già annotati, ieri no: un giro che copre tutto l'intervallo
    // riempie il buco e lascia stare quello che c'era già.
    const scritte = await annota(G3, ieri);
    expect(scritte).toBeGreaterThan(0);

    for (const giorno of [G3, G2, ieri]) {
      expect(await posti(aperta, giorno, "MATTINA")).not.toBeNull();
      expect(await posti(aperta, giorno, "POMERIGGIO")).not.toBeNull();
    }
  });

  it("il giro notturno completo annota ieri e non oggi", async () => {
    const esito = await eseguiPulizie(servizio());
    expect(esito.falliti).not.toContain("registra_posti_offerti");

    expect(await posti(aperta, ieri, "MATTINA")).not.toBeNull();
    // Oggi non è finito: si annota domani notte.
    expect(await posti(aperta, oggi, "MATTINA")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Di chi è questa tabella.
  // -------------------------------------------------------------------------

  it("nessuno, se non il mestiere automatico, può far partire l'annotazione", async () => {
    const u = await creaUtente();
    utenti.push(u);

    for (const client of [visitatore(), u.client]) {
      const { data, error } = await client.rpc("registra_posti_offerti", { p_fino_a: ieri });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }
  });

  // Il passo 12 aprirà questa tabella all'amministratore, insieme alle altre
  // statistiche. Finché non lo fa, non la legge nessuno.
  it("i posti offerti non sono ancora leggibili da nessuno", async () => {
    const u = await creaUtente();
    utenti.push(u);

    const daFuori = await visitatore().from("posti_offerti").select("posti");
    expect(daFuori.error).not.toBeNull();
    const daDentro = await u.client.from("posti_offerti").select("posti");
    expect(daDentro.error).not.toBeNull();
  });
});
