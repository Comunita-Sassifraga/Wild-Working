/**
 * SPEC §6.2, §11.B — il collegamento "Dove si trova".
 *
 * Funzioni pure, nessun database: qui si prova che i due numeri incollati
 * dal pannello arrivino nella colonna nell'ordine giusto e tornino indietro
 * uguali, e che una sede senza posizione non produca nessun collegamento.
 * L'ordine è la parte che si sbaglia: una persona scrive latitudine e poi
 * longitudine, Postgres conserva un punto (x, y) che è longitudine e poi
 * latitudine, e uno scambio manderebbe la valle in mezzo al mare.
 */

import { describe, expect, it } from "vitest";
import {
  collegamentoMappa,
  colonnaDaPosizione,
  posizioneDaColonna,
  posizioneDaTesto,
  testoDaPosizione,
} from "@/lib/mappa";

const RONCO = { latitudine: 45.5123, longitudine: 7.5512 };

describe("i due numeri, dal pannello alla colonna e ritorno", () => {
  it("legge quello che copia Google Maps: latitudine, longitudine", () => {
    expect(posizioneDaTesto("45.5123, 7.5512")).toEqual(RONCO);
    expect(posizioneDaTesto("45.5123,7.5512")).toEqual(RONCO);
    expect(posizioneDaTesto("  45.5123   7.5512 ")).toEqual(RONCO);
  });

  it("scrive nella colonna un punto (longitudine,latitudine)", () => {
    expect(colonnaDaPosizione(RONCO)).toBe("(7.5512,45.5123)");
  });

  it("rilegge la colonna senza scambiare i due numeri", () => {
    expect(posizioneDaColonna("(7.5512,45.5123)")).toEqual(RONCO);
    expect(testoDaPosizione(posizioneDaColonna("(7.5512,45.5123)")!)).toBe("45.5123, 7.5512");
  });

  it("rifiuta quello che non è una posizione", () => {
    for (const scritto of ["", "45.5123", "qui dietro la chiesa", "45,7,9", "91, 7.5512", "45.5, 181"]) {
      expect(posizioneDaTesto(scritto), scritto).toBeNull();
    }
    for (const colonna of [null, undefined, 42, "(7.5512)", "(abc,def)"]) {
      expect(posizioneDaColonna(colonna), String(colonna)).toBeNull();
    }
  });
});

describe("il collegamento alla mappa", () => {
  it("usa le coordinate quando ci sono", () => {
    const indirizzo = collegamentoMappa({
      coordinate: "(7.5512,45.5123)",
      indirizzo: "via della Prova 1",
      comune: "Ronco Canavese",
    });
    expect(indirizzo).toBe("https://www.google.com/maps/search/?api=1&query=45.5123%2C7.5512");
  });

  it("ripiega sull'indirizzo, con il comune accanto", () => {
    expect(collegamentoMappa({ indirizzo: "via della Prova 1", comune: "Ronco Canavese" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=via%20della%20Prova%201%2C%20Ronco%20Canavese",
    );
  });

  it("senza posizione e senza indirizzo non c'è nessun collegamento", () => {
    // §11.A: i sei indirizzi non sono ancora stati raccolti. Finché non lo
    // sono, il collegamento non compare — meglio niente che il posto sbagliato.
    expect(collegamentoMappa({ comune: "Ronco Canavese" })).toBeNull();
    expect(collegamentoMappa({ coordinate: null, indirizzo: null, comune: null })).toBeNull();
  });

  it("una coordinata illeggibile non finisce nel collegamento", () => {
    expect(collegamentoMappa({ coordinate: "(abc,def)", indirizzo: "via Prova 1" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=via%20Prova%201",
    );
  });
});
