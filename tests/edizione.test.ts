/**
 * SPEC §15.3.1 — the edition is the time switch of the module.
 *
 * At most one active at a time; the module unreachable outside one; an
 * activity dated outside its edition refused in writing. The entry of §15.5
 * on the availability page arrives with step 20: what this file can already
 * assert is the condition it will be built on — edizione_attiva(), which is
 * NULL for a visitor and outside an active edition alike.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import {
  abilita,
  creaAttivita,
  creaEdizione,
  creaUtente,
  pulisci,
  pulisciEdizioni,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

describe("§15.3.1 edizioni", () => {
  const edizioni: string[] = [];
  let utente: UtenteTest;

  beforeAll(async () => {
    utente = await creaUtente();
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
    await pulisci({ utenti: [utente] });
  });

  it("attivandone una, ogni altra si spegne", async () => {
    const prima = await creaEdizione({ nome: "Prima" });
    const seconda = await creaEdizione({ nome: "Seconda" });
    edizioni.push(prima, seconda);

    const { data } = await servizio().from("edizioni").select("id, attiva").in("id", [prima, seconda]);
    const attive = (data ?? []).filter((e) => e.attiva).map((e) => e.id);
    expect(attive).toEqual([seconda]);

    // And back again: the switch is a switch, not a one-way door.
    await servizio().from("edizioni").update({ attiva: true }).eq("id", prima);
    const { data: dopo } = await servizio()
      .from("edizioni")
      .select("id, attiva")
      .in("id", [prima, seconda]);
    expect((dopo ?? []).filter((e) => e.attiva).map((e) => e.id)).toEqual([prima]);
  });

  it("due edizioni attive sono impossibili, comunque le si scriva", async () => {
    // §15.12 promises the state, not a particular refusal: however many rows
    // a single statement tries to switch on, at most one comes out active.
    // Asked of the whole table, not of the rows this test made, because the
    // promise is about the database and not about a corner of it.
    const attive = async (): Promise<number> => {
      const { count } = await servizio()
        .from("edizioni")
        .select("id", { count: "exact", head: true })
        .eq("attiva", true);
      return count ?? 0;
    };

    const { data: inserite, error } = await servizio()
      .from("edizioni")
      .insert([
        { nome: "Doppia A", data_inizio: oggiRoma(), data_fine: aggiungiGiorni(oggiRoma(), 1), attiva: true },
        { nome: "Doppia B", data_inizio: oggiRoma(), data_fine: aggiungiGiorni(oggiRoma(), 1), attiva: true },
      ])
      .select("id");
    expect(error).toBeNull();
    edizioni.push(...(inserite ?? []).map((e) => e.id));
    expect(await attive()).toBe(1);

    // And switching both on in one statement, which is the other way a panel
    // could get this wrong.
    await servizio()
      .from("edizioni")
      .update({ attiva: true })
      .in("id", (inserite ?? []).map((e) => e.id));
    expect(await attive()).toBe(1);
  });

  it("l'interruttore vale solo dentro le date: un'edizione accesa ma finita non è quella attiva", async () => {
    const passata = await creaEdizione({
      nome: "Finita",
      data_inizio: aggiungiGiorni(oggiRoma(), -60),
      data_fine: aggiungiGiorni(oggiRoma(), -30),
      attiva: true,
    });
    edizioni.push(passata);

    const { data } = await servizio().rpc("edizione_attiva");
    expect(data).toBeNull();
  });

  it("fuori da un'edizione attiva il modulo è irraggiungibile, anche per chi era abilitato", async () => {
    const chiusa = await creaEdizione({ nome: "Chiusa", attiva: false });
    edizioni.push(chiusa);
    await abilita(utente.id, chiusa);
    const attivita = await creaAttivita({ edizione_id: chiusa });

    const { data: elenco, error } = await utente.client.from("attivita_elenco").select("*");
    expect(error).toBeNull();
    expect(elenco).toEqual([]);

    const { data: mirata } = await utente.client.from("attivita_elenco").select("*").eq("id", attivita);
    expect(mirata).toEqual([]);

    const { data: abilitato } = await utente.client.rpc("ha_abilitazione");
    expect(abilitato).toBe(false);
  });

  it("un visitatore non ha nessuna edizione e nessuna attività", async () => {
    const anonimo = visitatore();
    const { data: edizioni_, error: erroreEdizioni } = await anonimo.from("edizioni").select("*");
    expect(edizioni_ ?? []).toEqual([]);
    if (erroreEdizioni) expect(erroreEdizioni.code).toBe("42501");

    const { data: attivita, error: erroreAttivita } = await anonimo.from("attivita_elenco").select("*");
    expect(attivita ?? []).toEqual([]);
    if (erroreAttivita) expect(erroreAttivita.code).toBe("42501");
  });

  it("un'attività con data fuori dall'edizione è rifiutata in scrittura", async () => {
    const edizione = await creaEdizione({
      data_inizio: oggiRoma(),
      data_fine: aggiungiGiorni(oggiRoma(), 10),
    });
    edizioni.push(edizione);

    await expect(
      creaAttivita({ edizione_id: edizione, data: aggiungiGiorni(oggiRoma(), 11) }),
    ).rejects.toThrow();
    await expect(
      creaAttivita({ edizione_id: edizione, data: aggiungiGiorni(oggiRoma(), -1) }),
    ).rejects.toThrow();

    // The last day of the edition is inside it: data_fine is inclusive.
    const dentro = await creaAttivita({ edizione_id: edizione, data: aggiungiGiorni(oggiRoma(), 10) });
    expect(dentro).toBeTruthy();
  });

  it("spostare un'attività in un'edizione che non la contiene è rifiutato", async () => {
    const lunga = await creaEdizione({
      data_inizio: oggiRoma(),
      data_fine: aggiungiGiorni(oggiRoma(), 20),
    });
    const corta = await creaEdizione({
      data_inizio: oggiRoma(),
      data_fine: aggiungiGiorni(oggiRoma(), 2),
      attiva: false,
    });
    edizioni.push(lunga, corta);

    const attivita = await creaAttivita({ edizione_id: lunga, data: aggiungiGiorni(oggiRoma(), 15) });
    const { error } = await servizio()
      .from("attivita")
      .update({ edizione_id: corta })
      .eq("id", attivita);
    expect(error).not.toBeNull();
  });
});
