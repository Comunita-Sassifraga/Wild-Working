/**
 * SPEC §5.7, §6.2 — seasonal availability is data, not code.
 *
 * Required by CLAUDE.md: a sede outside all its periodi_attivita is not
 * bookable and does not appear in the availability grid; a sede with
 * sempre_disponibile = true ignores periods entirely; overlapping periods
 * behave as a union; shortening a period does not delete existing bookings.
 *
 * Everything is read through `disponibilita_pubblica`, the view the page
 * uses, and as a visitor: this is what a person without an account sees.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, fineFinestra, giorniFinestra, oggiRoma } from "@/lib/dates";
import { disponibilitaPubblica } from "@/lib/db/disponibilita";
import { prenotaPosto } from "@/lib/db/prenotazioni";
import {
  creaPeriodo,
  creaSede,
  creaUtente,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const OGNI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;

describe("§5.7 periodi di attività", () => {
  const anon = visitatore();
  const oggi = oggiRoma();
  const giorni = giorniFinestra();

  let fuoriStagione: string; // stagionale, con un periodo tutto nel passato
  let riapre: string; // stagionale, con un periodo che comincia dentro la finestra
  let sempre: string; // sempre_disponibile, con un periodo nel passato
  let unione: string; // due periodi sovrapposti
  let accorciata: string; // un solo periodo, che l'amministratore accorcia
  let periodoAccorciato: string;
  let utente: UtenteTest;

  /** Every cell of one sede, as a visitor sees it. */
  async function celleDi(sedeId: string) {
    const tutte = await disponibilitaPubblica(anon);
    return tutte.filter((c) => c.sedeId === sedeId);
  }

  beforeAll(async () => {
    utente = await creaUtente();
    const comuni = { capienza: 4, giorni_apertura: [...OGNI_GIORNO] };

    fuoriStagione = await creaSede({ ...comuni, sempre_disponibile: false });
    await creaPeriodo({
      sede_id: fuoriStagione,
      data_inizio: aggiungiGiorni(oggi, -60),
      data_fine: aggiungiGiorni(oggi, -30),
      etichetta: "Stagione passata",
    });

    riapre = await creaSede({ ...comuni, sempre_disponibile: false });
    await creaPeriodo({
      sede_id: riapre,
      data_inizio: aggiungiGiorni(oggi, 10),
      data_fine: aggiungiGiorni(oggi, 40),
      etichetta: "Stagione che arriva",
    });

    sempre = await creaSede({ ...comuni, sempre_disponibile: true });
    await creaPeriodo({
      sede_id: sempre,
      data_inizio: aggiungiGiorni(oggi, -60),
      data_fine: aggiungiGiorni(oggi, -30),
      etichetta: "Periodo che non conta",
    });

    unione = await creaSede({ ...comuni, sempre_disponibile: false });
    await creaPeriodo({
      sede_id: unione,
      data_inizio: oggi,
      data_fine: aggiungiGiorni(oggi, 3),
      etichetta: "Primo",
    });
    await creaPeriodo({
      sede_id: unione,
      data_inizio: aggiungiGiorni(oggi, 2),
      data_fine: aggiungiGiorni(oggi, 6),
      etichetta: "Secondo, sovrapposto",
    });

    accorciata = await creaSede({ ...comuni, sempre_disponibile: false });
    periodoAccorciato = await creaPeriodo({
      sede_id: accorciata,
      data_inizio: oggi,
      data_fine: fineFinestra(),
      etichetta: "Stagione da accorciare",
    });
  });

  afterAll(async () => {
    await pulisci({
      utenti: [utente],
      sedi: [fuoriStagione, riapre, sempre, unione, accorciata],
    });
  });

  it("una sede fuori da ogni periodo non è prenotabile in nessun giorno della finestra", async () => {
    const celle = await celleDi(fuoriStagione);
    expect(celle).toHaveLength(giorni.length * 2);
    expect(celle.every((c) => !c.inStagione)).toBe(true);
    expect(celle.every((c) => !c.prenotabile)).toBe(true);
  });

  it("una sede fuori periodo esce dalla griglia, e viene elencata sotto", async () => {
    // "Non compaiono nella griglia" (§6.2): la pagina tiene nella griglia solo
    // le sedi in stagione nel giorno scelto, e mette le altre nell'elenco.
    const celle = await celleDi(fuoriStagione);
    expect(celle.filter((c) => c.data === oggi && c.inStagione)).toEqual([]);

    const { data: aperture } = await anon
      .from("aperture_future")
      .select("sede_id, etichetta, data_apertura")
      .eq("sede_id", riapre);
    expect(aperture).toEqual([
      {
        sede_id: riapre,
        etichetta: "Stagione che arriva",
        data_apertura: aggiungiGiorni(oggi, 10),
      },
    ]);

    // Nessuna riapertura nota per la sede il cui unico periodo è passato.
    const { data: nessuna } = await anon
      .from("aperture_future")
      .select("sede_id")
      .eq("sede_id", fuoriStagione);
    expect(nessuna).toEqual([]);
  });

  it("una sede che riapre dentro la finestra è fuori stagione prima e in stagione dopo", async () => {
    const celle = await celleDi(riapre);
    const primaDellApertura = celle.filter((c) => c.data < aggiungiGiorni(oggi, 10));
    const dallApertura = celle.filter((c) => c.data >= aggiungiGiorni(oggi, 10));
    expect(primaDellApertura.every((c) => !c.inStagione && !c.prenotabile)).toBe(true);
    expect(dallApertura.length).toBeGreaterThan(0);
    expect(dallApertura.every((c) => c.inStagione && c.prenotabile)).toBe(true);
  });

  it("sempre_disponibile ignora del tutto i periodi", async () => {
    const celle = await celleDi(sempre);
    expect(celle.every((c) => c.inStagione)).toBe(true);
    expect(celle.every((c) => c.prenotabile)).toBe(true);
  });

  it("periodi sovrapposti valgono come unione, non come intersezione", async () => {
    const celle = await celleDi(unione);
    const inStagione = (data: string) =>
      celle.filter((c) => c.data === data).every((c) => c.inStagione);
    // Coperto dal solo primo periodo, da entrambi, dal solo secondo.
    expect(inStagione(oggi)).toBe(true);
    expect(inStagione(aggiungiGiorni(oggi, 2))).toBe(true);
    expect(inStagione(aggiungiGiorni(oggi, 6))).toBe(true);
    // Il giorno dopo la fine dell'unione.
    expect(inStagione(aggiungiGiorni(oggi, 7))).toBe(false);
  });

  it("accorciare un periodo non cancella le prenotazioni già dentro", async () => {
    const data = aggiungiGiorni(oggi, 5);
    const esito = await prenotaPosto(utente.client, { sedeId: accorciata, data, fascia: "MATTINA" });
    expect(esito.ok).toBe(true);

    // L'amministratore accorcia la stagione fino a escludere quel giorno.
    const { error } = await servizio()
      .from("periodi_attivita")
      .update({ data_fine: aggiungiGiorni(oggi, 1) })
      .eq("id", periodoAccorciato);
    expect(error).toBeNull();

    const celle = await celleDi(accorciata);
    expect(celle.filter((c) => c.data === data).every((c) => !c.inStagione)).toBe(true);

    // La prenotazione resta valida e visibile al suo titolare (§8.4).
    const { data: mie } = await utente.client
      .from("prenotazioni")
      .select("id, data, stato")
      .eq("sede_id", accorciata);
    expect(mie).toHaveLength(1);
    expect(mie?.[0]).toMatchObject({ data, stato: "ATTIVA" });
  });

  it("la finestra della vista è quella di §10, né un giorno di più né uno di meno", async () => {
    const celle = await celleDi(sempre);
    const date = [...new Set(celle.map((c) => c.data))].sort();
    expect(date[0]).toBe(oggi);
    expect(date.at(-1)).toBe(fineFinestra());
    expect(date).toEqual(giorni);
  });
});
