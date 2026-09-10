/**
 * The booking window — SPEC §6.3, §8.4, CLAUDE.md rule 10.
 *
 * `FINESTRA_GIORNI` is one source of truth: today through today +
 * FINESTRA_GIORNI, inclusive, computed in Europe/Rome and re-evaluated when
 * the row is written, not when the page was loaded.
 *
 * Two halves:
 *
 *  1. The clock frozen at 2026-08-15 (Europe/Rome): 2026-08-29 is inside the
 *     window and 2026-08-30 is not. The same holds with the machine's clock
 *     set to UTC, and across midnight (23:59 and 00:01 local).
 *
 *  2. The write path itself, against the database. Postgres' clock cannot be
 *     frozen from here — `now()` is the server's — so this half asks the
 *     database where its own window ends and books on both sides of that
 *     boundary. It is the same assertion on a date the test does not choose.
 */

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { FINESTRA_GIORNI } from "@/config/limits";
import { aggiungiGiorni, fineFinestra, inFinestra, oggiRoma } from "@/lib/dates";
import { prenotaPosto } from "@/lib/db/prenotazioni";
import { creaSede, creaUtente, pulisci, servizio, type UtenteTest } from "./setup/supabase";

const TUTTI_I_GIORNI = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;

// 2026-08-15 is a Saturday; 15 + 14 = 29 August, itself a Saturday.
const MEZZOGIORNO = new Date("2026-08-15T12:00:00+02:00");
const ULTIMO_PRENOTABILE = "2026-08-29";
const PRIMO_FUORI = "2026-08-30";

describe("§6.3 la finestra prenotabile, con l'orologio fermo al 15 agosto 2026", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`con FINESTRA_GIORNI = ${FINESTRA_GIORNI} l'ultimo giorno è il ${ULTIMO_PRENOTABILE}`, () => {
    expect(FINESTRA_GIORNI).toBe(14);
    expect(oggiRoma(MEZZOGIORNO)).toBe("2026-08-15");
    expect(fineFinestra(MEZZOGIORNO)).toBe(ULTIMO_PRENOTABILE);
    expect(inFinestra(ULTIMO_PRENOTABILE, MEZZOGIORNO)).toBe(true);
    expect(inFinestra(PRIMO_FUORI, MEZZOGIORNO)).toBe(false);
    expect(inFinestra("2026-08-14", MEZZOGIORNO)).toBe(false);
  });

  it("vale anche quando l'ora la legge l'orologio di sistema", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MEZZOGIORNO);
    expect(oggiRoma()).toBe("2026-08-15");
    expect(fineFinestra()).toBe(ULTIMO_PRENOTABILE);
    expect(inFinestra(ULTIMO_PRENOTABILE)).toBe(true);
    expect(inFinestra(PRIMO_FUORI)).toBe(false);
  });

  it("vale con la macchina in orario universale: conta il giorno italiano, non quello UTC", () => {
    const tz = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      // 23:30 UTC is already the next day in Rome: a UTC server would still
      // say 15 August and would open the window on the wrong day (§8.4).
      const tardi = new Date("2026-08-15T23:30:00Z");
      expect(tardi.getUTCDate()).toBe(15);
      expect(oggiRoma(tardi)).toBe("2026-08-16");
      expect(fineFinestra(tardi)).toBe(PRIMO_FUORI);
      expect(inFinestra(PRIMO_FUORI, tardi)).toBe(true);
    } finally {
      process.env.TZ = tz;
    }
  });

  it("a cavallo della mezzanotte italiana la finestra scorre di un giorno", () => {
    // 21:59Z = 23:59 a Roma, ancora il 15 agosto.
    const prima = new Date("2026-08-15T21:59:00Z");
    expect(oggiRoma(prima)).toBe("2026-08-15");
    expect(inFinestra(ULTIMO_PRENOTABILE, prima)).toBe(true);
    expect(inFinestra(PRIMO_FUORI, prima)).toBe(false);

    // 22:01Z = 00:01 a Roma, ormai il 16: il 30 agosto entra, il 15 esce.
    const dopo = new Date("2026-08-15T22:01:00Z");
    expect(oggiRoma(dopo)).toBe("2026-08-16");
    expect(inFinestra(PRIMO_FUORI, dopo)).toBe(true);
    expect(inFinestra("2026-08-15", dopo)).toBe(false);
  });
});

describe("§6.3 la scrittura rifiuta i giorni fuori dalla finestra", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it("la finestra della banca dati e quella del programma coincidono", async () => {
    const { data: oggi } = await servizio().rpc("oggi_roma");
    const { data: fine } = await servizio().rpc("fine_finestra");
    expect(oggi).toBe(oggiRoma());
    expect(fine).toBe(fineFinestra());
    expect(fine).toBe(aggiungiGiorni(oggi as string, FINESTRA_GIORNI));
  });

  it("l'ultimo giorno della finestra si prenota, il primo fuori no", async () => {
    const { data: fine } = await servizio().rpc("fine_finestra");
    const ultimo = fine as string;
    const oltre = aggiungiGiorni(ultimo, 1);

    // Open every weekday: here the only condition under test is the window.
    const sedeId = await creaSede({ capienza: 2, giorni_apertura: [...TUTTI_I_GIORNI] });
    sedi.push(sedeId);
    const u = await creaUtente();
    utenti.push(u);

    expect((await prenotaPosto(u.client, { sedeId, data: ultimo, fascia: "MATTINA" })).ok).toBe(
      true,
    );

    const fuori = await prenotaPosto(u.client, { sedeId, data: oltre, fascia: "MATTINA" });
    expect(fuori.ok === false && fuori.motivo).toBe("FUORI_FINESTRA");
  });

  it("un giorno già passato non si prenota", async () => {
    const sedeId = await creaSede({ capienza: 2, giorni_apertura: [...TUTTI_I_GIORNI] });
    sedi.push(sedeId);
    const u = await creaUtente();
    utenti.push(u);

    const ieri = aggiungiGiorni(oggiRoma(), -1);
    const esito = await prenotaPosto(u.client, { sedeId, data: ieri, fascia: "MATTINA" });
    expect(esito.ok === false && esito.motivo).toBe("FUORI_FINESTRA");
  });
});
