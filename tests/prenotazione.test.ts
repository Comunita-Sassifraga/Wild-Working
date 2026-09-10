/**
 * SPEC §6.3, §6.4, §12 step 5 — booking and cancelling.
 *
 * The write path goes through the same `sede_prenotabile()` the availability
 * grid goes through, so a slot the grid calls closed cannot be booked by
 * addressing the function directly. The cancellation deadline of §6.4 is part
 * of the access policy, so it holds against the database, not against a page.
 *
 * The rows a person reads about themselves come from `mie_prenotazioni`,
 * which is pinned to the caller inside the database (§8.3): the tests below
 * try to get someone else's booking out of it, and to read it as a visitor.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, giornoSettimana, oggiRoma } from "@/lib/dates";
import {
  annullaGiornata,
  annullaPrenotazione,
  miePrenotazioni,
  prenotaGiornata,
  prenotaPosto,
} from "@/lib/db/prenotazioni";
import {
  CODICE_PERMESSO_NEGATO,
  creaChiusura,
  creaPeriodo,
  creaSede,
  creaUtente,
  creaUtenti,
  inserisciPrenotazioneDiretta,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const OGNI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;
const NOMI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;

const oggi = oggiRoma();
const fra = (n: number) => aggiungiGiorni(oggi, n);
const nomeGiorno = (data: string) => NOMI_GIORNO[giornoSettimana(data) - 1];

describe("§6.3 quando una prenotazione viene rifiutata", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  const nuovaSede = async (opzioni: Parameters<typeof creaSede>[0]) => {
    const id = await creaSede(opzioni);
    sedi.push(id);
    return id;
  };

  const nuovoUtente = async () => {
    const u = await creaUtente();
    utenti.push(u);
    return u;
  };

  it("una sede fuori dal proprio periodo di attività non si prenota", async () => {
    const sedeId = await nuovaSede({
      capienza: 4,
      giorni_apertura: [...OGNI_GIORNO],
      sempre_disponibile: false,
    });
    // A season that ended yesterday: the sede exists, is switched on, and is
    // out of season on every day of the window.
    await creaPeriodo({
      sede_id: sedeId,
      data_inizio: fra(-30),
      data_fine: fra(-1),
      ricorre_ogni_anno: false,
    });

    const u = await nuovoUtente();
    const esito = await prenotaPosto(u.client, { sedeId, data: fra(1), fascia: "MATTINA" });
    expect(esito.ok === false && esito.motivo).toBe("SEDE_CHIUSA");
  });

  it("un giorno della settimana in cui la sede è chiusa non si prenota", async () => {
    const aperto = fra(1);
    const chiuso = fra(2);
    const sedeId = await nuovaSede({ capienza: 4, giorni_apertura: [nomeGiorno(aperto)] });
    const u = await nuovoUtente();

    expect((await prenotaPosto(u.client, { sedeId, data: aperto, fascia: "MATTINA" })).ok).toBe(
      true,
    );
    const esito = await prenotaPosto(u.client, { sedeId, data: chiuso, fascia: "MATTINA" });
    expect(esito.ok === false && esito.motivo).toBe("SEDE_CHIUSA");
  });

  it("una chiusura su una sola fascia lascia prenotabile l'altra", async () => {
    const data = fra(3);
    const sedeId = await nuovaSede({ capienza: 4, giorni_apertura: [...OGNI_GIORNO] });
    await creaChiusura({ sede_id: sedeId, data_inizio: data, data_fine: data, fascia: "MATTINA" });
    const u = await nuovoUtente();

    const mattina = await prenotaPosto(u.client, { sedeId, data, fascia: "MATTINA" });
    expect(mattina.ok === false && mattina.motivo).toBe("SEDE_CHIUSA");
    expect((await prenotaPosto(u.client, { sedeId, data, fascia: "POMERIGGIO" })).ok).toBe(true);
  });
});

describe("§6.3 giornata intera", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it("crea due prenotazioni legate dallo stesso gruppo", async () => {
    const data = fra(4);
    const sedeId = await creaSede({ capienza: 3, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(sedeId);
    const u = await creaUtente();
    utenti.push(u);

    const esito = await prenotaGiornata(u.client, { sedeId, data });
    expect(esito.ok).toBe(true);

    const righe = await miePrenotazioni(u.client);
    const delGiorno = righe.filter((r) => r.data === data);
    expect(delGiorno).toHaveLength(2);
    expect(delGiorno.map((r) => r.fascia).sort()).toEqual(["MATTINA", "POMERIGGIO"]);
    expect(new Set(delGiorno.map((r) => r.gruppoId)).size).toBe(1);
    expect(esito.ok && delGiorno[0].gruppoId).toBe(esito.ok && esito.id);
  });

  it("se una delle due fasce è piena non prenota niente, e dice quale", async () => {
    const data = fra(5);
    const sedeId = await creaSede({ capienza: 1, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(sedeId);
    const [chiPrende, chiChiede] = await creaUtenti(2);
    utenti.push(chiPrende, chiChiede);

    // The one seat of the afternoon is taken: the whole day cannot fit.
    expect((await prenotaPosto(chiPrende.client, { sedeId, data, fascia: "POMERIGGIO" })).ok).toBe(
      true,
    );

    const esito = await prenotaGiornata(chiChiede.client, { sedeId, data });
    expect(esito.ok === false && esito.motivo).toBe("GIORNATA_INCOMPLETA");
    expect(esito.ok === false && esito.fasciaPiena).toBe("POMERIGGIO");

    // Nothing was left behind: not even the morning, which was free.
    expect((await miePrenotazioni(chiChiede.client)).filter((r) => r.data === data)).toHaveLength(
      0,
    );
  });
});

describe("§6.4 annullare", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  const attive = async (sedeId: string, data: string) => {
    const { data: righe } = await servizio()
      .from("prenotazioni")
      .select("id, fascia")
      .eq("sede_id", sedeId)
      .eq("data", data)
      .eq("stato", "ATTIVA");
    return righe ?? [];
  };

  it("annullare la giornata annulla entrambe le fasce", async () => {
    const data = fra(6);
    const sedeId = await creaSede({ capienza: 2, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(sedeId);
    const u = await creaUtente();
    utenti.push(u);

    const esito = await prenotaGiornata(u.client, { sedeId, data });
    expect(esito.ok).toBe(true);
    expect(await attive(sedeId, data)).toHaveLength(2);

    const annullata = await annullaGiornata(u.client, esito.ok ? esito.id : "");
    expect(annullata.annullate).toBe(2);
    expect(await attive(sedeId, data)).toHaveLength(0);
  });

  it("di una giornata si può annullare una sola fascia, e l'altra resta", async () => {
    const data = fra(7);
    const sedeId = await creaSede({ capienza: 2, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(sedeId);
    const u = await creaUtente();
    utenti.push(u);

    expect((await prenotaGiornata(u.client, { sedeId, data })).ok).toBe(true);
    const mattina = (await miePrenotazioni(u.client)).find(
      (r) => r.data === data && r.fascia === "MATTINA",
    );
    expect(mattina).toBeDefined();

    expect((await annullaPrenotazione(u.client, mattina!.id)).ok).toBe(true);
    const rimaste = await attive(sedeId, data);
    expect(rimaste).toHaveLength(1);
    expect(rimaste[0].fascia).toBe("POMERIGGIO");
  });

  it("nessuno può annullare la prenotazione di un altro", async () => {
    const data = fra(8);
    const sedeId = await creaSede({ capienza: 2, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(sedeId);
    const [titolare, estraneo] = await creaUtenti(2);
    utenti.push(titolare, estraneo);

    const mia = await prenotaPosto(titolare.client, { sedeId, data, fascia: "MATTINA" });
    expect(mia.ok).toBe(true);

    const tentativo = await annullaPrenotazione(estraneo.client, mia.ok ? mia.id : "");
    expect(tentativo.ok).toBe(false);
    expect(await attive(sedeId, data)).toHaveLength(1);
  });

  it("una fascia già cominciata non si annulla più", async () => {
    // The sede opens at midnight: today's MATTINA has already begun,
    // whatever the hour at which the test runs.
    const cominciata = await creaSede({
      capienza: 2,
      giorni_apertura: [...OGNI_GIORNO],
      ora_inizio_mattina: "00:00",
      ora_fine_mattina: "00:01",
    });
    sedi.push(cominciata);
    const u = await creaUtente();
    utenti.push(u);

    const esito = await prenotaPosto(u.client, { sedeId: cominciata, data: oggi, fascia: "MATTINA" });
    expect(esito.ok).toBe(true);

    const riga = (await miePrenotazioni(u.client)).find((r) => r.sedeId === cominciata);
    expect(riga?.annullabile).toBe(false);

    expect((await annullaPrenotazione(u.client, esito.ok ? esito.id : "")).ok).toBe(false);
    expect(await attive(cominciata, oggi)).toHaveLength(1);
  });

  it("una fascia non ancora cominciata si annulla, e il posto torna libero", async () => {
    const data = fra(9);
    const sedeId = await creaSede({ capienza: 1, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(sedeId);
    const [primo, secondo] = await creaUtenti(2);
    utenti.push(primo, secondo);

    const mia = await prenotaPosto(primo.client, { sedeId, data, fascia: "MATTINA" });
    expect(mia.ok).toBe(true);
    const riga = (await miePrenotazioni(primo.client)).find((r) => r.data === data);
    expect(riga?.annullabile).toBe(true);

    const piena = await prenotaPosto(secondo.client, { sedeId, data, fascia: "MATTINA" });
    expect(piena.ok === false && piena.motivo).toBe("POSTI_ESAURITI");

    expect((await annullaPrenotazione(primo.client, mia.ok ? mia.id : "")).ok).toBe(true);
    expect((await prenotaPosto(secondo.client, { sedeId, data, fascia: "MATTINA" })).ok).toBe(true);
  });
});

describe("§6.4 «Le mie prenotazioni» non mostra nient'altro", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];
  let mio: UtenteTest;
  let altro: UtenteTest;
  let sedeId: string;

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 4, giorni_apertura: [...OGNI_GIORNO] });
    sedi.push(sedeId);
    [mio, altro] = await creaUtenti(2);
    utenti.push(mio, altro);
    await prenotaPosto(mio.client, { sedeId, data: fra(10), fascia: "MATTINA" });
    await prenotaPosto(altro.client, { sedeId, data: fra(10), fascia: "POMERIGGIO" });
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it("mostra le proprie prenotazioni e nessuna di un'altra persona", async () => {
    const mie = await miePrenotazioni(mio.client);
    expect(mie.some((r) => r.data === fra(10) && r.fascia === "MATTINA")).toBe(true);
    expect(mie.some((r) => r.fascia === "POMERIGGIO" && r.data === fra(10))).toBe(false);

    const sue = await miePrenotazioni(altro.client);
    expect(sue.every((r) => r.fascia === "POMERIGGIO")).toBe(true);
  });

  it("non porta mai il numero del posto (§8.1)", async () => {
    const { data } = await mio.client.from("mie_prenotazioni").select("*").limit(1);
    expect(data?.[0]).toBeDefined();
    expect(Object.keys(data![0])).not.toContain("posto_progressivo");
  });

  it("non mostra il passato", async () => {
    const passata = await inserisciPrenotazioneDiretta({
      utente_id: mio.id,
      sede_id: sedeId,
      data: fra(-3),
      fascia: "MATTINA",
    });
    const mie = await miePrenotazioni(mio.client);
    expect(mie.some((r) => r.id === passata)).toBe(false);
  });

  it("è irraggiungibile senza accesso", async () => {
    const { error } = await visitatore().from("mie_prenotazioni").select("id");
    expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);
  });
});
