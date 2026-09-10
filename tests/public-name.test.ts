/**
 * SPEC §6.5, §6.6, §8.3 — public-name visibility is enforced in the database.
 *
 * A user with mostra_nome_pubblico = false must not appear in any query
 * reachable without authentication. The public page never shows the past.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, fineFinestra, oggiRoma } from "@/lib/dates";
import { prenotaPosto } from "@/lib/db/prenotazioni";
import { impostaMostraNomePubblico } from "@/lib/db/utenti";
import {
  CODICE_PERMESSO_NEGATO,
  creaSede,
  creaUtente,
  inserisciPrenotazioneDiretta,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

describe("§6.5 nome pubblico nelle viste pubbliche", () => {
  const anon = visitatore();
  const oggi = oggiRoma();
  let sedeId: string;
  let visibile: UtenteTest; // mostra = true, nome "Pia"
  let nascosto: UtenteTest; // mostra = false, nome "Nino"
  let senzaNome: UtenteTest; // mostra = true, nome empty

  async function nomiPubblici(data = oggi) {
    const { data: righe, error } = await anon
      .from("presenze_pubbliche")
      .select("*")
      .eq("sede_id", sedeId)
      .eq("data", data)
      .eq("fascia", "MATTINA");
    expect(error).toBeNull();
    return righe ?? [];
  }

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 5 });
    [visibile, nascosto, senzaNome] = await Promise.all([creaUtente(), creaUtente(), creaUtente()]);
    const s = servizio();
    await s.from("utenti").update({ nome_pubblico: "Pia", mostra_nome_pubblico: true }).eq("id", visibile.id);
    await s.from("utenti").update({ nome_pubblico: "Nino", mostra_nome_pubblico: false }).eq("id", nascosto.id);
    await s.from("utenti").update({ nome_pubblico: "", mostra_nome_pubblico: true }).eq("id", senzaNome.id);
    for (const u of [visibile, nascosto, senzaNome]) {
      const esito = await prenotaPosto(u.client, { sedeId, data: oggi, fascia: "MATTINA" });
      if (!esito.ok) throw new Error("fixture booking failed");
    }
  });

  afterAll(async () => {
    await pulisci({ utenti: [visibile, nascosto, senzaNome], sedi: [sedeId] });
  });

  it("mostra solo chi ha l'interruttore acceso e un nome, ma conta tutti", async () => {
    const righe = await nomiPubblici();
    expect(righe.map((r) => r.nome_pubblico)).toEqual(["Pia"]);

    const { data } = await anon
      .from("occupazione_pubblica")
      .select("prenotati")
      .eq("sede_id", sedeId)
      .eq("data", oggi)
      .eq("fascia", "MATTINA")
      .single();
    expect(data?.prenotati).toBe(3);
  });

  it("non espone alcun identificativo accanto al nome", async () => {
    const [riga] = await nomiPubblici();
    expect(Object.keys(riga).sort()).toEqual(["data", "fascia", "nome_pubblico", "sede_id"]);
  });

  it("spegnendo l'interruttore il nome sparisce subito, riaccendendolo torna", async () => {
    await impostaMostraNomePubblico(visibile.client, visibile.id, false);
    expect((await nomiPubblici()).map((r) => r.nome_pubblico)).toEqual([]);
    await impostaMostraNomePubblico(visibile.client, visibile.id, true);
    expect((await nomiPubblici()).map((r) => r.nome_pubblico)).toEqual(["Pia"]);
  });

  it("un nome con interruttore spento non è raggiungibile da nessuna query anonima", async () => {
    expect((await anon.from("utenti").select("nome_pubblico")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
    const { data } = await anon.from("presenze_pubbliche").select("nome_pubblico").eq("nome_pubblico", "Nino");
    expect(data).toEqual([]);
  });

  it("non mostra mai il passato né oltre la finestra", async () => {
    const ieri = aggiungiGiorni(oggi, -1);
    const oltre = aggiungiGiorni(fineFinestra(), 1);
    await inserisciPrenotazioneDiretta({ utente_id: visibile.id, sede_id: sedeId, data: ieri, fascia: "MATTINA" });
    await inserisciPrenotazioneDiretta({ utente_id: visibile.id, sede_id: sedeId, data: oltre, fascia: "MATTINA" });

    expect(await nomiPubblici(ieri)).toEqual([]);
    expect(await nomiPubblici(oltre)).toEqual([]);
    for (const data of [ieri, oltre]) {
      const { data: occ } = await anon.from("occupazione_pubblica").select("prenotati").eq("sede_id", sedeId).eq("data", data);
      expect(occ).toEqual([]);
    }
  });

  it("una prenotazione annullata non compare", async () => {
    await servizio().from("prenotazioni").update({ stato: "ANNULLATA" }).eq("utente_id", visibile.id).eq("data", oggi);
    expect(await nomiPubblici()).toEqual([]);
  });

  it("una sede disattivata sparisce dalle viste pubbliche", async () => {
    await servizio().from("sedi").update({ attiva: false }).eq("id", sedeId);
    const { data: occ } = await anon.from("occupazione_pubblica").select("prenotati").eq("sede_id", sedeId);
    expect(occ).toEqual([]);
    const { data: sedi } = await anon.from("sedi_pubbliche").select("id").eq("id", sedeId);
    expect(sedi).toEqual([]);
  });
});
