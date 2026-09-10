/**
 * SPEC §8.1 — two people book the last seat at the same instant.
 *
 * N simultaneous bookings on a sede with capacity M must produce exactly
 * min(N, M) successes. The guarantee comes from the unique index on
 * (sede_id, data, fascia, posto_progressivo), not from application code.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { oggiRoma } from "@/lib/dates";
import { annullaPrenotazione, prenotaPosto } from "@/lib/db/prenotazioni";
import { creaSede, creaUtente, creaUtenti, pulisci, servizio, type UtenteTest } from "./setup/supabase";

const CAPIENZA = 5;
const RICHIESTE = 12;

describe("§8.1 concorrenza sull'ultimo posto", () => {
  const sedi: string[] = [];
  const utenti: UtenteTest[] = [];

  beforeAll(async () => {
    utenti.push(...(await creaUtenti(RICHIESTE)));
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it(`${RICHIESTE} prenotazioni simultanee su capienza ${CAPIENZA} danno esattamente ${CAPIENZA} successi`, async () => {
    const sedeId = await creaSede({ capienza: CAPIENZA });
    sedi.push(sedeId);
    const richiesta = { sedeId, data: oggiRoma(), fascia: "MATTINA" as const };

    const esiti = await Promise.all(utenti.map((u) => prenotaPosto(u.client, richiesta)));

    const riuscite = esiti.filter((e) => e.ok);
    const rifiutate = esiti.filter((e) => !e.ok);
    expect(riuscite).toHaveLength(Math.min(RICHIESTE, CAPIENZA));
    expect(rifiutate).toHaveLength(RICHIESTE - CAPIENZA);
    for (const r of rifiutate) {
      expect(r.ok === false && r.motivo).toBe("POSTI_ESAURITI");
    }

    // The database holds exactly CAPIENZA active rows, seats 1..CAPIENZA, no duplicates.
    const { data } = await servizio()
      .from("prenotazioni")
      .select("posto_progressivo")
      .eq("sede_id", sedeId)
      .eq("data", richiesta.data)
      .eq("fascia", richiesta.fascia)
      .eq("stato", "ATTIVA");
    const posti = (data ?? []).map((r) => r.posto_progressivo).sort((a, b) => a - b);
    expect(posti).toEqual(Array.from({ length: CAPIENZA }, (_, i) => i + 1));
  });

  it("lo stesso utente che prenota due volte in parallelo ottiene una sola prenotazione", async () => {
    const sedeId = await creaSede({ capienza: 3 });
    sedi.push(sedeId);
    const u = utenti[0];
    const richiesta = { sedeId, data: oggiRoma(), fascia: "POMERIGGIO" as const };

    const [a, b] = await Promise.all([prenotaPosto(u.client, richiesta), prenotaPosto(u.client, richiesta)]);

    const riuscite = [a, b].filter((e) => e.ok);
    const rifiutate = [a, b].filter((e) => !e.ok);
    expect(riuscite).toHaveLength(1);
    expect(rifiutate).toHaveLength(1);
    expect(rifiutate[0].ok === false && rifiutate[0].motivo).toBe("PRENOTAZIONE_DUPLICATA");
  });

  it("una prenotazione attiva nella stessa data e fascia blocca anche in un'altra sede (§6.3)", async () => {
    const sedeA = await creaSede({ capienza: 2 });
    const sedeB = await creaSede({ capienza: 2 });
    sedi.push(sedeA, sedeB);
    const u = await creaUtente();
    utenti.push(u);
    const data = oggiRoma();

    expect((await prenotaPosto(u.client, { sedeId: sedeA, data, fascia: "MATTINA" })).ok).toBe(true);
    const seconda = await prenotaPosto(u.client, { sedeId: sedeB, data, fascia: "MATTINA" });
    expect(seconda.ok === false && seconda.motivo).toBe("PRENOTAZIONE_DUPLICATA");
    // A different fascia on the same day is fine.
    expect((await prenotaPosto(u.client, { sedeId: sedeB, data, fascia: "POMERIGGIO" })).ok).toBe(true);
  });

  it("annullare una prenotazione libera il posto, che viene riassegnato", async () => {
    const sedeId = await creaSede({ capienza: 1 });
    sedi.push(sedeId);
    const [a, b] = await creaUtenti(2);
    utenti.push(a, b);
    const richiesta = { sedeId, data: oggiRoma(), fascia: "MATTINA" as const };

    const prima = await prenotaPosto(a.client, richiesta);
    expect(prima.ok).toBe(true);
    const piena = await prenotaPosto(b.client, richiesta);
    expect(piena.ok === false && piena.motivo).toBe("POSTI_ESAURITI");

    expect((await annullaPrenotazione(a.client, prima.ok ? prima.id : "")).ok).toBe(true);

    const dopo = await prenotaPosto(b.client, richiesta);
    expect(dopo.ok).toBe(true);
  });

  it("una sede con capienza zero risponde subito posti esauriti", async () => {
    const sedeId = await creaSede({ capienza: 0 });
    sedi.push(sedeId);
    const esito = await prenotaPosto(utenti[1].client, { sedeId, data: oggiRoma(), fascia: "MATTINA" });
    expect(esito.ok === false && esito.motivo).toBe("POSTI_ESAURITI");
  });

  it("una sede disattivata non è prenotabile", async () => {
    const sedeId = await creaSede({ capienza: 4, attiva: false });
    sedi.push(sedeId);
    const esito = await prenotaPosto(utenti[2].client, { sedeId, data: oggiRoma(), fascia: "MATTINA" });
    expect(esito.ok === false && esito.motivo).toBe("SEDE_NON_DISPONIBILE");
  });
});
