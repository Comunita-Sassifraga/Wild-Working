/**
 * SPEC §15.3.4, §15.4 — the abilitazione is the real authorisation.
 *
 * CLAUDE.md rule 22: every read of `attivita` and `iscrizioni` requires an
 * active abilitazione for the active edizione, imposed by the database. A
 * user without one must not be able to retrieve a titolo, an abitante_nome or
 * a luogo_generico — not through the list, not through an id typed by hand,
 * not through a joined query, not through the table itself.
 *
 * And the other half, from §15.12: a revoked abilitazione blocks what is new
 * and leaves what exists readable by its owner. Revoking is not cancelling.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  abilita,
  CODICE_PERMESSO_NEGATO,
  creaAttivita,
  creaEdizione,
  creaUtente,
  iscriviti,
  pulisci,
  pulisciEdizioni,
  revocaAbilitazione,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

describe("§15.3.4 abilitazioni", () => {
  const edizioni: string[] = [];
  let edizione: string;
  let attivita: string;
  let abilitato: UtenteTest; // holds an active abilitazione
  let estraneo: UtenteTest; // signed in, never abilitated
  let revocato: UtenteTest; // was abilitated, signed up, then revoked
  let abilitazioneRevocata: string;
  let iscrizioneDelRevocato: string;

  beforeAll(async () => {
    edizione = await creaEdizione();
    edizioni.push(edizione);
    attivita = await creaAttivita({ edizione_id: edizione, capienza: 6 });
    [abilitato, estraneo, revocato] = await Promise.all([creaUtente(), creaUtente(), creaUtente()]);
    await abilita(abilitato.id, edizione);
    abilitazioneRevocata = await abilita(revocato.id, edizione);

    const esito = await iscriviti(revocato.client, attivita);
    if (!esito.ok) throw new Error("fixture iscrizione failed");
    iscrizioneDelRevocato = esito.id;
    await revocaAbilitazione(abilitazioneRevocata);
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
    await pulisci({ utenti: [abilitato, estraneo, revocato] });
  });

  describe("chi ha l'abilitazione", () => {
    it("vede l'elenco", async () => {
      const { data, error } = await abilitato.client.from("attivita_elenco").select("*");
      expect(error).toBeNull();
      expect((data ?? []).map((a) => a.id)).toContain(attivita);
    });
  });

  describe("chi non ha l'abilitazione", () => {
    it("non ottiene niente dall'elenco, né in blocco né per id", async () => {
      const { data, error } = await estraneo.client.from("attivita_elenco").select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: mirata } = await estraneo.client
        .from("attivita_elenco")
        .select("*")
        .eq("id", attivita);
      expect(mirata).toEqual([]);
    });

    it("non ottiene niente dalla vista degli iscritti, né da quella di amministrazione", async () => {
      const { data: daIscritto } = await estraneo.client.from("attivita_iscritto").select("*");
      expect(daIscritto).toEqual([]);
      const { data: daAdmin } = await estraneo.client.from("attivita_amministrazione").select("*");
      expect(daAdmin).toEqual([]);
    });

    it("non raggiunge la tabella attivita, che non è raggiungibile da nessuno", async () => {
      const { error } = await estraneo.client.from("attivita").select("titolo, abitante_nome");
      expect(error).not.toBeNull();
      expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);

      // And neither does somebody who holds the abilitazione: the table is
      // closed to everyone, always (rule 24).
      const { error: erroreAbilitato } = await abilitato.client.from("attivita").select("*");
      expect(erroreAbilitato?.code).toBe(CODICE_PERMESSO_NEGATO);
    });

    it("non legge nessuna iscrizione, nemmeno di altri", async () => {
      const { data, error } = await estraneo.client.from("iscrizioni").select("id, attivita_id");
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: mirata } = await estraneo.client
        .from("iscrizioni")
        .select("id")
        .eq("id", iscrizioneDelRevocato);
      expect(mirata).toEqual([]);
    });

    it("non può iscriversi", async () => {
      const esito = await iscriviti(estraneo.client, attivita);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS004");
    });

    it("non ricava un titolo passando dalle iscrizioni con una join", async () => {
      const { data } = await estraneo.client
        .from("iscrizioni")
        .select("id, attivita:attivita_id (titolo, abitante_nome, luogo_generico)");
      expect(data ?? []).toEqual([]);
    });
  });

  describe("visitatore senza accesso", () => {
    it("non raggiunge niente del modulo", async () => {
      const anonimo = visitatore();
      for (const tabella of [
        "attivita",
        "iscrizioni",
        "abilitazioni",
        "codici_invito",
        "tentativi_codice",
      ] as const) {
        const { data, error } = await anonimo.from(tabella).select("*");
        expect(data ?? [], tabella).toEqual([]);
        if (error) expect(error.code).toBe(CODICE_PERMESSO_NEGATO);
      }
      for (const vista of [
        "attivita_elenco",
        "attivita_iscritto",
        "attivita_amministrazione",
      ] as const) {
        const { data, error } = await anonimo.from(vista).select("*");
        expect(data ?? [], vista).toEqual([]);
        if (error) expect(error.code).toBe(CODICE_PERMESSO_NEGATO);
      }
    });
  });

  describe("abilitazione revocata", () => {
    it("blocca una nuova iscrizione", async () => {
      const altra = await creaAttivita({ edizione_id: edizione });
      const esito = await iscriviti(revocato.client, altra);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS004");
    });

    it("toglie l'elenco", async () => {
      const { data } = await revocato.client.from("attivita_elenco").select("id");
      expect(data).toEqual([]);
    });

    it("lascia leggibile al titolare l'iscrizione che aveva già", async () => {
      // §15.12: le iscrizioni restano, non sono più modificabili
      // dall'interessato. Restare vuol dire restare visibili.
      const { data, error } = await revocato.client
        .from("iscrizioni")
        .select("id, stato")
        .eq("id", iscrizioneDelRevocato);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: iscrizioneDelRevocato, stato: "ATTIVA" }]);
    });

    it("lascia leggibili i dati dell'attività a cui era iscritto", async () => {
      const { data } = await revocato.client
        .from("attivita_iscritto")
        .select("id, titolo, abitante_telefono")
        .eq("id", attivita);
      expect(data?.length).toBe(1);
      expect(data?.[0].abitante_telefono).toBeTruthy();
    });
  });

  describe("la tabella delle abilitazioni", () => {
    it("si legge solo la propria riga", async () => {
      const { data, error } = await abilitato.client.from("abilitazioni").select("id, utente_id");
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
      expect(data?.[0].utente_id).toBe(abilitato.id);
    });

    it("non se la dà nessuno da solo, e nessuno si riattiva da sé", async () => {
      const { error } = await estraneo.client
        .from("abilitazioni")
        .insert({ utente_id: estraneo.id, edizione_id: edizione, origine: "MANUALE" });
      expect(error).not.toBeNull();
      expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);

      const { error: erroreRiattivazione } = await revocato.client
        .from("abilitazioni")
        .update({ attiva: true })
        .eq("id", abilitazioneRevocata);
      expect(erroreRiattivazione).not.toBeNull();
    });

    it("ne esiste una sola per persona e per edizione", async () => {
      const { error } = await servizio()
        .from("abilitazioni")
        .insert({ utente_id: abilitato.id, edizione_id: edizione, origine: "MANUALE" });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505");
    });
  });
});
