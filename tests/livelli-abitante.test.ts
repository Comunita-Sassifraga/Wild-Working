/**
 * SPEC §15.8 — the abitante's data has three visibility levels.
 *
 * The abitante is not a user and never will be: no account, no digital
 * consent, data entered by an admin against a paper signed by hand. Their
 * surname, telephone and exact address are shown to temporary residents, and
 * §15.8 is explicit about who gets which.
 *
 *   Level 1  nome di battesimo, titolo, luogo generico, descrizione
 *            → every abilitated user
 *   Level 2  cognome, telefono, luogo esatto
 *            → ONLY who holds an ATTIVA iscrizione on that activity
 *   Level 3  note interne
 *            → amministratore only, never in an export
 *
 * "These columns, only for the rows you are enrolled in" cannot be a column
 * grant, so `attivita` is closed to everyone and three views stand over it
 * (rule 24). This file is the proof that the three views are actually the
 * only doors.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  abilita,
  assegnaIncarico,
  CODICE_PERMESSO_NEGATO,
  creaAttivita,
  creaEdizione,
  creaUtente,
  iscriviti,
  pulisci,
  pulisciEdizioni,
  type UtenteTest,
} from "./setup/supabase";

/** The three level 2 columns, named once so no test forgets one. */
const LIVELLO_2 = ["abitante_cognome", "abitante_telefono", "luogo_esatto"] as const;

/** A description at the limit of §15.3.2, to prove nothing truncates it. */
const DESCRIZIONE_LUNGA = "Mi chiamo Nome e vi racconto la mia valle. ".repeat(95).slice(0, 4000);

describe("§15.8 i tre livelli dell'abitante", () => {
  const edizioni: string[] = [];
  let edizione: string;
  let attivita: string;
  let iscritto: UtenteTest;
  let nonIscritto: UtenteTest; // abilitated, but enrolled on nothing
  let admin: UtenteTest;
  let iscrizione: string;

  beforeAll(async () => {
    edizione = await creaEdizione();
    edizioni.push(edizione);
    attivita = await creaAttivita({
      edizione_id: edizione,
      capienza: 4,
      descrizione: DESCRIZIONE_LUNGA,
      abitante_note_interne: "Chiamare dopo le 20. Accordi presi a voce il 5 settembre.",
    });
    [iscritto, nonIscritto, admin] = await Promise.all([creaUtente(), creaUtente(), creaUtente()]);
    await abilita(iscritto.id, edizione);
    await abilita(nonIscritto.id, edizione);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
    await abilita(admin.id, edizione);

    const esito = await iscriviti(iscritto.client, attivita);
    if (!esito.ok) throw new Error("fixture iscrizione failed");
    iscrizione = esito.id;
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
    await pulisci({ utenti: [iscritto, nonIscritto, admin] });
  });

  describe("livello 1 — chi è abilitato", () => {
    it("vede nome di battesimo, titolo, luogo generico e descrizione", async () => {
      const { data, error } = await nonIscritto.client
        .from("attivita_elenco")
        .select("*")
        .eq("id", attivita)
        .single();
      expect(error).toBeNull();
      expect(data?.abitante_nome).toBe("Nome");
      expect(data?.luogo_generico).toBe("Frazione di prova");
      expect(data?.titolo).toBeTruthy();
    });

    it("la descrizione torna intera, mai tagliata", async () => {
      // It is a third party's own words (rule 26): 4000 characters in, 4000
      // characters out, whoever is reading.
      const { data } = await nonIscritto.client
        .from("attivita_elenco")
        .select("descrizione")
        .eq("id", attivita)
        .single();
      expect(data?.descrizione).toBe(DESCRIZIONE_LUNGA);
      expect(data?.descrizione?.length).toBe(4000);

      const { data: perIscritto } = await iscritto.client
        .from("attivita_iscritto")
        .select("descrizione")
        .eq("id", attivita)
        .single();
      expect(perIscritto?.descrizione).toBe(DESCRIZIONE_LUNGA);
    });

    it("vede i posti rimasti, che sono un conteggio e non dei nomi", async () => {
      const { data } = await nonIscritto.client
        .from("attivita_elenco")
        .select("capienza, iscritti, posti_rimasti")
        .eq("id", attivita)
        .single();
      expect(data?.capienza).toBe(4);
      expect(data?.iscritti).toBe(1);
      expect(data?.posti_rimasti).toBe(3);
    });
  });

  describe("livello 2 — chi è abilitato ma non iscritto", () => {
    it("non ottiene cognome, telefono e luogo esatto da attivita_elenco, nemmeno chiedendoli", async () => {
      for (const colonna of LIVELLO_2) {
        const { data, error } = await nonIscritto.client
          .from("attivita_elenco")
          // The column does not exist in the view: PostgREST refuses the select.
          .select(colonna)
          .eq("id", attivita);
        expect(error, colonna).not.toBeNull();
        expect(data).toBeNull();
      }
    });

    it("non li ottiene con un SELECT * su nessuna delle tre viste", async () => {
      const { data: elenco } = await nonIscritto.client
        .from("attivita_elenco")
        .select("*")
        .eq("id", attivita)
        .single();
      for (const colonna of LIVELLO_2) {
        expect(Object.keys(elenco ?? {}), colonna).not.toContain(colonna);
      }

      // attivita_iscritto exists for this person, but holds no row of theirs.
      const { data: daIscritto } = await nonIscritto.client
        .from("attivita_iscritto")
        .select("*")
        .eq("id", attivita);
      expect(daIscritto).toEqual([]);

      const { data: daAdmin } = await nonIscritto.client
        .from("attivita_amministrazione")
        .select("*")
        .eq("id", attivita);
      expect(daAdmin).toEqual([]);
    });

    it("non li ottiene dalla tabella, che è chiusa a tutti", async () => {
      const { error } = await nonIscritto.client
        .from("attivita")
        .select("abitante_cognome, abitante_telefono, luogo_esatto")
        .eq("id", attivita);
      expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);

      const { error: erroreStella } = await nonIscritto.client.from("attivita").select("*");
      expect(erroreStella?.code).toBe(CODICE_PERMESSO_NEGATO);
    });
  });

  describe("livello 2 — chi si è iscritto", () => {
    it("ottiene cognome, telefono e luogo esatto", async () => {
      const { data, error } = await iscritto.client
        .from("attivita_iscritto")
        .select("*")
        .eq("id", attivita)
        .single();
      expect(error).toBeNull();
      expect(data?.abitante_cognome).toBe("Cognome");
      expect(data?.abitante_telefono).toBe("000 0000000");
      expect(data?.luogo_esatto).toBe("Via di prova 1, Frazione di prova");
    });

    it("non ottiene quelli delle attività a cui non è iscritto", async () => {
      const altra = await creaAttivita({
        edizione_id: edizione,
        abitante_cognome: "AltroCognome",
      });
      const { data } = await iscritto.client
        .from("attivita_iscritto")
        .select("id")
        .eq("id", altra);
      expect(data).toEqual([]);
    });

    it("annullando l'iscrizione li perde nello stesso istante", async () => {
      // §15.8: "chi ha annullato la propria iscrizione perde il livello 2
      // nello stesso istante". Nothing is copied anywhere, so there is
      // nothing left to go stale.
      const { error } = await iscritto.client
        .from("iscrizioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", iscrizione);
      expect(error).toBeNull();

      const { data } = await iscritto.client
        .from("attivita_iscritto")
        .select("*")
        .eq("id", attivita);
      expect(data).toEqual([]);

      // And level 1 is still there: cancelling takes away the address, not
      // the activity.
      const { data: elenco } = await iscritto.client
        .from("attivita_elenco")
        .select("titolo")
        .eq("id", attivita);
      expect(elenco?.length).toBe(1);
    });

    it("riscrivendosi li riottiene", async () => {
      const esito = await iscriviti(iscritto.client, attivita);
      expect(esito.ok).toBe(true);
      const { data } = await iscritto.client
        .from("attivita_iscritto")
        .select("abitante_telefono")
        .eq("id", attivita)
        .single();
      expect(data?.abitante_telefono).toBe("000 0000000");
    });
  });

  describe("livello 3 — le note interne", () => {
    it("non escono da nessuna vista per un non amministratore", async () => {
      for (const utente of [iscritto, nonIscritto]) {
        for (const vista of ["attivita_elenco", "attivita_iscritto"] as const) {
          const { data, error } = await utente.client.from(vista).select("abitante_note_interne");
          expect(error, vista).not.toBeNull();
          expect(data).toBeNull();
        }
        const { data: righe } = await utente.client
          .from("attivita_amministrazione")
          .select("*")
          .eq("id", attivita);
        expect(righe).toEqual([]);
      }
    });

    it("non compaiono con un SELECT * di chi è iscritto", async () => {
      const { data } = await iscritto.client
        .from("attivita_iscritto")
        .select("*")
        .eq("id", attivita)
        .single();
      expect(Object.keys(data ?? {})).not.toContain("abitante_note_interne");
    });

    it("le vede l'amministratore, e solo lui", async () => {
      const { data, error } = await admin.client
        .from("attivita_amministrazione")
        .select("abitante_note_interne")
        .eq("id", attivita)
        .single();
      expect(error).toBeNull();
      expect(data?.abitante_note_interne).toContain("Chiamare dopo le 20");
    });
  });
});
