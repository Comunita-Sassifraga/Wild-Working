/**
 * SPEC §15.3.3, §15.7 — taking a place on an activity.
 *
 * The same rule as §8.1 for desks: capacity is decided by a unique index,
 * never by a read-then-write check in application code (rule 5). And one
 * thing desks do not have — there is no waiting list (D22, rule 29). When N
 * people go for M places, min(N, M) get one and the rest simply fail: there
 * is nowhere for them to fall.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import {
  abilita,
  assegnaIncarico,
  creaAttivita,
  creaEdizione,
  creaUtente,
  creaUtenti,
  inserisciIscrizioneDiretta,
  iscriviti,
  pulisci,
  pulisciEdizioni,
  servizio,
  type UtenteTest,
} from "./setup/supabase";

describe("§15.7 iscrizioni", () => {
  const edizioni: string[] = [];
  let edizione: string;

  beforeAll(async () => {
    edizione = await creaEdizione();
    edizioni.push(edizione);
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
  });

  describe("concorrenza (§15.12, come §8.1)", () => {
    const CAPIENZA = 3;
    const CANDIDATI = 8;
    let utenti: UtenteTest[];
    let attivita: string;

    beforeAll(async () => {
      utenti = await creaUtenti(CANDIDATI);
      for (const u of utenti) await abilita(u.id, edizione);
      attivita = await creaAttivita({ edizione_id: edizione, capienza: CAPIENZA });
    });

    afterAll(async () => {
      await pulisci({ utenti });
    });

    it("N iscrizioni simultanee su capienza M danno esattamente min(N, M) attive, e nient'altro", async () => {
      const esiti = await Promise.all(utenti.map((u) => iscriviti(u.client, attivita)));
      const riuscite = esiti.filter((e) => e.ok);
      const fallite = esiti.filter((e) => !e.ok);

      expect(riuscite.length).toBe(CAPIENZA);
      expect(fallite.length).toBe(CANDIDATI - CAPIENZA);
      // Nothing else: no waiting list, no pending state to land in (rule 29).
      for (const e of fallite) {
        if (!e.ok) expect(e.codice).toBe("IS001");
      }

      const { data } = await servizio()
        .from("iscrizioni")
        .select("id, stato, posto_progressivo")
        .eq("attivita_id", attivita);
      expect(data?.length).toBe(CAPIENZA);
      expect(data?.every((i) => i.stato === "ATTIVA")).toBe(true);
      // Seat numbers 1..M, assigned by the system and each used once.
      expect([...(data ?? [])].map((i) => i.posto_progressivo).sort()).toEqual([1, 2, 3]);
    });

    it("l'attività risulta completa, con zero posti rimasti", async () => {
      const { data } = await utenti[0].client
        .from("attivita_elenco")
        .select("posti_rimasti")
        .eq("id", attivita)
        .single();
      expect(data?.posti_rimasti).toBe(0);
    });

    it("un posto annullato torna disponibile a qualcun altro", async () => {
      // Not a waiting list: nobody is promoted. A place that frees up is
      // simply free again, and whoever asks next gets it (§15.7).
      const dentro: UtenteTest[] = [];
      for (const u of utenti) {
        const { data } = await u.client.from("iscrizioni").select("id").eq("attivita_id", attivita);
        if ((data ?? []).length === 1) dentro.push(u);
      }
      expect(dentro.length).toBe(CAPIENZA);

      const { data: riga } = await dentro[0].client
        .from("iscrizioni")
        .select("id")
        .eq("attivita_id", attivita)
        .single();
      await dentro[0].client.from("iscrizioni").update({ stato: "ANNULLATA" }).eq("id", riga!.id);

      const fuori = utenti.filter((u) => !dentro.includes(u));
      const esito = await iscriviti(fuori[0].client, attivita);
      expect(esito.ok).toBe(true);
    });
  });

  describe("una sola iscrizione per attività", () => {
    let utente: UtenteTest;
    let attivita: string;

    beforeAll(async () => {
      utente = await creaUtente();
      await abilita(utente.id, edizione);
      attivita = await creaAttivita({ edizione_id: edizione, capienza: 5 });
    });

    afterAll(async () => {
      await pulisci({ utenti: [utente] });
    });

    it("la seconda è rifiutata", async () => {
      const prima = await iscriviti(utente.client, attivita);
      expect(prima.ok).toBe(true);
      const seconda = await iscriviti(utente.client, attivita);
      expect(seconda.ok).toBe(false);
      if (!seconda.ok) expect(seconda.codice).toBe("IS002");
    });

    it("dopo un annullamento ci si può riscrivere", async () => {
      const { data: riga } = await utente.client
        .from("iscrizioni")
        .select("id")
        .eq("attivita_id", attivita)
        .eq("stato", "ATTIVA")
        .single();
      await utente.client.from("iscrizioni").update({ stato: "ANNULLATA" }).eq("id", riga!.id);
      const diNuovo = await iscriviti(utente.client, attivita);
      expect(diNuovo.ok).toBe(true);
    });
  });

  describe("annullare", () => {
    let titolare: UtenteTest;
    let altro: UtenteTest;
    let admin: UtenteTest;
    let attivita: string;
    let iscrizione: string;

    beforeAll(async () => {
      [titolare, altro, admin] = await Promise.all([creaUtente(), creaUtente(), creaUtente()]);
      for (const u of [titolare, altro, admin]) await abilita(u.id, edizione);
      await assegnaIncarico(admin.id, "AMMINISTRATORE");
      attivita = await creaAttivita({ edizione_id: edizione, capienza: 5 });
      const esito = await iscriviti(titolare.client, attivita);
      if (!esito.ok) throw new Error("fixture iscrizione failed");
      iscrizione = esito.id;
    });

    afterAll(async () => {
      await pulisci({ utenti: [titolare, altro, admin] });
    });

    it("nessuno annulla l'iscrizione di un altro", async () => {
      const { data, error } = await altro.client
        .from("iscrizioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", iscrizione)
        .select("id");
      expect(error).toBeNull();
      // The policy makes it a no-op, not an error: no row was changed.
      expect(data).toEqual([]);

      const { data: riga } = await servizio()
        .from("iscrizioni")
        .select("stato")
        .eq("id", iscrizione)
        .single();
      expect(riga?.stato).toBe("ATTIVA");
    });

    it("l'amministratore sì: è il solo caso in cui si agisce sulla riga di un altro", async () => {
      // §15.9, rule 29: only for iscrizioni, never for prenotazioni, and it is
      // a decision a person takes and signs — not an automatic cancellation,
      // which rule 6 forbids. Tracking and email are step 18; this is the
      // permission they will be built on.
      const { data, error } = await admin.client
        .from("iscrizioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", iscrizione)
        .select("id");
      expect(error).toBeNull();
      expect(data?.length).toBe(1);

      const { data: riga } = await servizio()
        .from("iscrizioni")
        .select("stato, annullata_il")
        .eq("id", iscrizione)
        .single();
      expect(riga?.stato).toBe("ANNULLATA");
      expect(riga?.annullata_il).not.toBeNull();
    });

    it("il titolare annulla la propria, e la data la scrive il sistema", async () => {
      const esito = await iscriviti(titolare.client, attivita);
      expect(esito.ok).toBe(true);
      if (!esito.ok) return;

      const { data } = await titolare.client
        .from("iscrizioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", esito.id)
        .select("id");
      expect(data?.length).toBe(1);

      const { data: riga } = await servizio()
        .from("iscrizioni")
        .select("annullata_il")
        .eq("id", esito.id)
        .single();
      expect(riga?.annullata_il).not.toBeNull();
    });

    it("un'iscrizione annullata non si riporta ad ATTIVA", async () => {
      const { data: annullate } = await servizio()
        .from("iscrizioni")
        .select("id")
        .eq("attivita_id", attivita)
        .eq("stato", "ANNULLATA")
        .limit(1);
      const id = annullate?.[0]?.id;
      expect(id).toBeTruthy();

      const { data } = await titolare.client
        .from("iscrizioni")
        .update({ stato: "ATTIVA" })
        .eq("id", id!)
        .select("id");
      expect(data ?? []).toEqual([]);
    });
  });

  describe("l'attività già cominciata", () => {
    let utente: UtenteTest;
    let attivita: string;
    let iscrizione: string;

    beforeAll(async () => {
      utente = await creaUtente();
      await abilita(utente.id, edizione);
      // Today, one minute past midnight: begun, whatever hour the suite runs at.
      attivita = await creaAttivita({
        edizione_id: edizione,
        data: oggiRoma(),
        ora_inizio: "00:01",
        ora_fine: "00:02",
        capienza: 5,
      });
      iscrizione = await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: utente.id });
    });

    afterAll(async () => {
      await pulisci({ utenti: [utente] });
    });

    it("non si annulla più", async () => {
      const { data, error } = await utente.client
        .from("iscrizioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", iscrizione)
        .select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("non ci si iscrive più", async () => {
      const altro = await creaUtente();
      await abilita(altro.id, edizione);
      const esito = await iscriviti(altro.client, attivita);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS005");
      await pulisci({ utenti: [altro] });
    });
  });

  describe("che cosa non si può prenotare", () => {
    let utente: UtenteTest;

    beforeAll(async () => {
      utente = await creaUtente();
      await abilita(utente.id, edizione);
    });

    afterAll(async () => {
      await pulisci({ utenti: [utente] });
    });

    it("un'attività in BOZZA non esiste per nessun residente", async () => {
      const bozza = await creaAttivita({
        edizione_id: edizione,
        stato: "BOZZA",
        consenso_raccolto: false,
        consenso_modalita: null,
      });
      const { data } = await utente.client.from("attivita_elenco").select("id").eq("id", bozza);
      expect(data).toEqual([]);
      const esito = await iscriviti(utente.client, bozza);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS003");
    });

    it("un'attività annullata nemmeno", async () => {
      const annullata = await creaAttivita({ edizione_id: edizione, stato: "ANNULLATA" });
      const esito = await iscriviti(utente.client, annullata);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS003");
    });

    it("un'attività di un'altra edizione nemmeno", async () => {
      const altra = await creaEdizione({
        attiva: false,
        data_inizio: aggiungiGiorni(oggiRoma(), 40),
        data_fine: aggiungiGiorni(oggiRoma(), 60),
      });
      edizioni.push(altra);
      const fuori = await creaAttivita({
        edizione_id: altra,
        data: aggiungiGiorni(oggiRoma(), 45),
      });
      const esito = await iscriviti(utente.client, fuori);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS003");
    });

    it("un identificativo inventato non dice niente su cosa esista", async () => {
      const esito = await iscriviti(utente.client, "00000000-0000-4000-8000-000000000000");
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS003");
    });
  });

  describe("il numero di posto e i campi stat_", () => {
    let utente: UtenteTest;

    beforeAll(async () => {
      utente = await creaUtente();
      await abilita(utente.id, edizione);
    });

    afterAll(async () => {
      await pulisci({ utenti: [utente] });
    });

    it("non escono mai verso un utente", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione });
      const esito = await iscriviti(utente.client, attivita);
      expect(esito.ok).toBe(true);

      for (const colonna of [
        "posto_progressivo",
        "stat_eta",
        "stat_genere",
        "stat_professione",
        "stat_motivo_visita",
        "stat_residenza",
        "creata_da",
        "annullata_da",
      ] as const) {
        const { data, error } = await utente.client.from("iscrizioni").select(colonna);
        expect(error, colonna).not.toBeNull();
        expect(data).toBeNull();
      }

      const { data: stella } = await utente.client.from("iscrizioni").select("*").limit(1).single();
      expect(Object.keys(stella ?? {})).not.toContain("posto_progressivo");
      expect(Object.keys(stella ?? {}).filter((k) => k.startsWith("stat_"))).toEqual([]);
    });
  });
describe("una scheda pubblicata ma non finita (§15.3.2, 12/09/2026)", () => {
    let utente: UtenteTest;

    beforeAll(async () => {
      utente = await creaUtente();
      await abilita(utente.id, edizione);
    });

    afterAll(async () => {
      await pulisci({ utenti: [utente] });
    });

    it("senza capienza non accetta iscrizioni", async () => {
      // Since a card may be saved incomplete, it may also be published
      // incomplete. A card that offers no places offers none to anybody, and
      // it says so the way every other unavailable activity does.
      const senzaCapienza = await creaAttivita({ edizione_id: edizione, capienza: null });
      const esito = await iscriviti(utente.client, senzaCapienza);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS003");
    });

    it("senza data non compare nell'elenco, e non si prenota", async () => {
      const senzaData = await creaAttivita({
        edizione_id: edizione,
        data: null,
        ora_inizio: null,
        ora_fine: null,
      });

      const { data } = await utente.client
        .from("attivita_elenco")
        .select("id")
        .eq("id", senzaData);
      expect(data).toEqual([]);

      // attivita_non_cominciata cannot place a moment that is not there, and
      // an unplaceable moment is not one we may call "still ahead".
      const esito = await iscriviti(utente.client, senzaData);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.codice).toBe("IS005");
    });

    it("finita la scheda, l'attività funziona come ogni altra", async () => {
      const attivita = await creaAttivita({
        edizione_id: edizione,
        capienza: null,
        data: null,
        ora_inizio: null,
        ora_fine: null,
      });
      await servizio()
        .from("attivita")
        .update({
          capienza: 3,
          data: aggiungiGiorni(oggiRoma(), 2),
          ora_inizio: "18:00",
          ora_fine: "20:00",
        })
        .eq("id", attivita);

      const esito = await iscriviti(utente.client, attivita);
      expect(esito.ok).toBe(true);
    });
  });
});
