/**
 * SPEC §6.6 — the public page "Chi c'è in Valle".
 *
 * Two halves. The first needs no database: the line of people and the shape
 * of the page are pure functions, and the wording of §6.6 is exact enough to
 * be asserted word by word.
 *
 * The second half goes through the same door the page uses — the anonymous
 * client on `presenze_pubbliche` and `disponibilita_pubblica` — because that
 * is where the boundary really is: a name may come out only with the switch
 * on, only inside the window, and never with anything attached to it that
 * points back at a person (rules 3, 8, 15, 16).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FINESTRA_GIORNI } from "@/config/limits";
import { aggiungiGiorni, fineFinestra, oggiRoma } from "@/lib/dates";
import { disponibilitaPubblica, sediPubbliche } from "@/lib/db/disponibilita";
import { prenotaGiornata, prenotaPosto } from "@/lib/db/prenotazioni";
import { presenzePubbliche } from "@/lib/db/presenze";
import { presenzePerSede, rigaPersone } from "@/lib/presenze";
import type { Cella } from "@/lib/disponibilita";
import type { SedePubblica } from "@/lib/db/disponibilita";
import type { Presenza } from "@/lib/db/presenze";
import {
  creaSede,
  creaUtenti,
  inserisciPrenotazioneDiretta,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const OGNI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;

// ---------------------------------------------------------------------------
// The line of people — SPEC §6.6, word for word
// ---------------------------------------------------------------------------

describe("§6.6 la riga delle persone", () => {
  it("mette prima i nomi, poi chi non ha condiviso il proprio", () => {
    expect(rigaPersone(["Mario Rossi", "Chiara Bianchi"], 2)).toBe(
      "Mario Rossi, Chiara Bianchi + 2 persone che preferiscono non condividere pubblicamente il nome",
    );
  });

  it("va al singolare quando manca una persona sola", () => {
    expect(rigaPersone(["Mario Rossi"], 1)).toBe(
      "Mario Rossi + 1 persona che preferisce non condividere pubblicamente il nome",
    );
  });

  it("senza nessun nome resta la sola coda, senza il piu`", () => {
    expect(rigaPersone([], 3)).toBe(
      "3 persone che preferiscono non condividere pubblicamente il nome",
    );
    expect(rigaPersone([], 1)).toBe(
      "1 persona che preferisce non condividere pubblicamente il nome",
    );
  });

  it("con tutti i nomi non c'e` nessuna coda", () => {
    expect(rigaPersone(["Pia", "Nino"], 0)).toBe("Pia, Nino");
  });
});

// ---------------------------------------------------------------------------
// The shape of the page — which sedi, which days, which fasce
// ---------------------------------------------------------------------------

describe("§6.6 forma della pagina", () => {
  const oggi = oggiRoma();
  const domani = aggiungiGiorni(oggi, 1);

  const sede = (id: string): SedePubblica => ({
    id,
    nome: `Sede ${id}`,
    comune: "Valle",
    indirizzo: null,
    capienza: 6,
    orari: {
      MATTINA: { inizio: "09:00:00", fine: "13:00:00" },
      POMERIGGIO: { inizio: "14:00:00", fine: "18:00:00" },
    },
    giorniApertura: [...OGNI_GIORNO],
  });

  const cella = (
    sedeId: string,
    data: string,
    fascia: "MATTINA" | "POMERIGGIO",
    prenotati: number,
    inStagione = true,
  ): Cella => ({
    sedeId,
    data,
    fascia,
    capienza: 6,
    prenotati,
    liberi: 6 - prenotati,
    pubbliche: 0,
    inStagione,
    prenotabile: inStagione,
  });

  const presenza = (
    sedeId: string,
    data: string,
    fascia: "MATTINA" | "POMERIGGIO",
    nomePubblico: string,
  ): Presenza => ({ sedeId, data, fascia, nomePubblico });

  it("elenca solo i giorni e le fasce in cui c'e` qualcuno", () => {
    const celle = [
      cella("a", oggi, "MATTINA", 2),
      cella("a", oggi, "POMERIGGIO", 0),
      cella("a", domani, "MATTINA", 0),
      cella("a", domani, "POMERIGGIO", 0),
    ];
    const [sedeA] = presenzePerSede([sede("a")], celle, [presenza("a", oggi, "MATTINA", "Pia")]);

    expect(sedeA.giorni.map((g) => g.data)).toEqual([oggi]);
    expect(sedeA.giorni[0].fasce.map((f) => f.fascia)).toEqual(["MATTINA"]);
    expect(sedeA.giorni[0].fasce[0]).toEqual({ fascia: "MATTINA", nomi: ["Pia"], senzaNome: 1 });
  });

  it("chi ha prenotato la giornata intera compare in tutte e due le fasce", () => {
    const celle = [cella("a", oggi, "MATTINA", 1), cella("a", oggi, "POMERIGGIO", 1)];
    const [sedeA] = presenzePerSede([sede("a")], celle, [
      presenza("a", oggi, "MATTINA", "Pia"),
      presenza("a", oggi, "POMERIGGIO", "Pia"),
    ]);

    expect(sedeA.giorni[0].fasce.map((f) => [f.fascia, f.nomi])).toEqual([
      ["MATTINA", ["Pia"]],
      ["POMERIGGIO", ["Pia"]],
    ]);
  });

  it("una sede senza nessuno resta nell'elenco, senza giorni", () => {
    const celle = [cella("a", oggi, "MATTINA", 0), cella("a", oggi, "POMERIGGIO", 0)];
    const [sedeA] = presenzePerSede([sede("a")], celle, []);
    expect(sedeA.giorni).toEqual([]);
  });

  it("una sede fuori stagione e senza prenotati non compare affatto", () => {
    const celle = [cella("a", oggi, "MATTINA", 0, false), cella("a", oggi, "POMERIGGIO", 0, false)];
    expect(presenzePerSede([sede("a")], celle, [])).toEqual([]);
  });

  it("una sede fuori stagione con qualcuno gia` prenotato resta visibile", () => {
    // Rule 6: a capacity or season change never cancels a booking, and the
    // people who made one are still expected there.
    const celle = [cella("a", oggi, "MATTINA", 1, false), cella("a", oggi, "POMERIGGIO", 0, false)];
    const [sedeA] = presenzePerSede([sede("a")], celle, [presenza("a", oggi, "MATTINA", "Pia")]);
    expect(sedeA.giorni[0].fasce[0].nomi).toEqual(["Pia"]);
  });

  it("il numero senza nome e` i prenotati meno i nomi mostrati", () => {
    const celle = [cella("a", oggi, "MATTINA", 4)];
    const [sedeA] = presenzePerSede([sede("a")], celle, [
      presenza("a", oggi, "MATTINA", "Pia"),
      presenza("a", oggi, "MATTINA", "Nino"),
    ]);
    const fascia = sedeA.giorni[0].fasce[0];
    expect(fascia.senzaNome).toBe(2);
    expect(fascia.nomi.length + fascia.senzaNome).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Through the anonymous client, against the local stack
// ---------------------------------------------------------------------------

describe("§6.6 la pagina vista da chi non e` registrato", () => {
  const anon = visitatore();
  const oggi = oggiRoma();

  let sedeId: string;
  let visibile: UtenteTest; // "Pia", switch on
  let nascosto: UtenteTest; // "Nino", switch off
  let senzaNome: UtenteTest; // switch on, no name
  let giornataIntera: UtenteTest; // "Ada", both fasce

  async function paginaDi(sedeId: string) {
    const [sedi, celle, presenze] = await Promise.all([
      sediPubbliche(anon),
      disponibilitaPubblica(anon),
      presenzePubbliche(anon),
    ]);
    return presenzePerSede(
      sedi.filter((s) => s.id === sedeId),
      celle,
      presenze,
    );
  }

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 6, giorni_apertura: [...OGNI_GIORNO] });
    [visibile, nascosto, senzaNome, giornataIntera] = await creaUtenti(4);

    const s = servizio();
    await s.from("utenti").update({ nome_pubblico: "Pia", mostra_nome_pubblico: true }).eq("id", visibile.id);
    await s.from("utenti").update({ nome_pubblico: "Nino", mostra_nome_pubblico: false }).eq("id", nascosto.id);
    await s.from("utenti").update({ nome_pubblico: "", mostra_nome_pubblico: true }).eq("id", senzaNome.id);
    await s.from("utenti").update({ nome_pubblico: "Ada", mostra_nome_pubblico: true }).eq("id", giornataIntera.id);

    for (const u of [visibile, nascosto, senzaNome]) {
      const esito = await prenotaPosto(u.client, { sedeId, data: oggi, fascia: "MATTINA" });
      if (!esito.ok) throw new Error(`fixture booking failed: ${esito.motivo}`);
    }
    const giornata = await prenotaGiornata(giornataIntera.client, { sedeId, data: oggi });
    if (!giornata.ok) throw new Error(`fixture giornata failed: ${giornata.motivo}`);
  });

  afterAll(async () => {
    await pulisci({
      utenti: [visibile, nascosto, senzaNome, giornataIntera],
      sedi: [sedeId],
    });
  });

  it("mostra i nomi di chi si e` reso pubblico, e conta gli altri senza nominarli", async () => {
    const [sede] = await paginaDi(sedeId);
    const giorno = sede.giorni.find((g) => g.data === oggi);
    const mattina = giorno?.fasce.find((f) => f.fascia === "MATTINA");

    expect(mattina?.nomi.sort()).toEqual(["Ada", "Pia"]);
    // Quattro prenotati: Pia, Ada, Nino (interruttore spento) e chi non ha
    // scelto un nome. Due nomi, due nella coda.
    expect(mattina?.senzaNome).toBe(2);
    expect(rigaPersone(mattina!.nomi, mattina!.senzaNome)).toContain(
      "2 persone che preferiscono non condividere pubblicamente il nome",
    );
  });

  it("la giornata intera compare in tutte e due le fasce", async () => {
    const [sede] = await paginaDi(sedeId);
    const giorno = sede.giorni.find((g) => g.data === oggi);
    expect(giorno?.fasce.find((f) => f.fascia === "POMERIGGIO")?.nomi).toEqual(["Ada"]);
  });

  it("un nome con l'interruttore spento non esce da nessuna parte", async () => {
    const presenze = await presenzePubbliche(anon);
    expect(presenze.map((p) => p.nomePubblico)).not.toContain("Nino");
  });

  it("non mostra il passato ne` i giorni oltre la finestra", async () => {
    const ieri = aggiungiGiorni(oggi, -1);
    const oltre = aggiungiGiorni(fineFinestra(), 1);
    for (const data of [ieri, oltre]) {
      await inserisciPrenotazioneDiretta({
        utente_id: visibile.id,
        sede_id: sedeId,
        data,
        fascia: "MATTINA",
      });
    }

    const [sede] = await paginaDi(sedeId);
    const date = sede.giorni.map((g) => g.data);
    expect(date).not.toContain(ieri);
    expect(date).not.toContain(oltre);
    expect(date.every((d) => d >= oggi && d <= fineFinestra())).toBe(true);
  });

  it("copre la finestra di FINESTRA_GIORNI e nient'altro", async () => {
    const celle = await disponibilitaPubblica(anon);
    const date = [...new Set(celle.map((c) => c.data))];
    expect(date.length).toBe(FINESTRA_GIORNI + 1);
  });

  it("accanto al nome non esce nessun identificativo, nessuna email, nessun dato facoltativo", async () => {
    const { data: righe, error } = await anon.from("presenze_pubbliche").select("*").limit(1);
    expect(error).toBeNull();
    expect(Object.keys(righe?.[0] ?? {}).sort()).toEqual(["data", "fascia", "nome_pubblico", "sede_id"]);

    // E le tabelle sotto restano chiuse: la vista e` l'unica porta.
    expect((await anon.from("utenti").select("id")).error).not.toBeNull();
    expect((await anon.from("prenotazioni").select("id")).error).not.toBeNull();
  });
});
