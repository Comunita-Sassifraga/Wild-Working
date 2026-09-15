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
import { ORE_DISDETTA } from "@/config/limits";
import { completa, disdettaTardiva, perSettimana } from "@/lib/abitanti/elenco";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import {
  annullaIscrizione,
  attivitaConLivelli,
  attivitaPubblicate,
  iscrivitiAttivita,
  mieIscrizioni,
  nomiIscritti,
  type AttivitaElencata,
} from "@/lib/db/iscrizioni";
import { rigaPersone } from "@/lib/presenze";
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
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

/**
 * One row as `attivita_elenco` hands it over, for the pure functions of
 * lib/abitanti/elenco.ts: they decide how a card reads, never who may read
 * it, so they can be asked without a database.
 */
const finta = (parti: Partial<AttivitaElencata> = {}): AttivitaElencata => ({
  id: "finta",
  titolo: "Attivita",
  descrizione: null,
  abitanteNome: "Nome",
  luogoGenerico: "Frazione",
  data: "2026-09-26",
  oraInizio: "18:00",
  oraFine: "20:00",
  capienza: 4,
  cosaPortare: null,
  linguaAttivita: null,
  iscritti: 0,
  postiRimasti: 4,
  ancoraAperta: true,
  inizio: "2026-09-26T16:00:00Z",
  ...parti,
});

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

  // ---------------------------------------------------------------------------
  // Step 17 — the same rules, asked the way the pages ask them (§15.14).
  //
  // `/abitanti` and `/abitanti/[id]` never touch a table: they go through
  // lib/db/iscrizioni.ts, under each person's own identity. Everything below
  // is asked through a real client, never through the service one — what a
  // fixture may do is not what a person may do.
  // ---------------------------------------------------------------------------
  describe("il percorso dalle pagine (§15.6, §15.7)", () => {
    describe("l'elenco", () => {
      let abilitato: UtenteTest;
      let estraneo: UtenteTest;
      let domani: string;
      let fraUnaSettimana: string;
      let bozza: string;
      let annullata: string;

      beforeAll(async () => {
        [abilitato, estraneo] = await Promise.all([creaUtente(), creaUtente()]);
        await abilita(abilitato.id, edizione);
        domani = await creaAttivita({
          edizione_id: edizione,
          data: aggiungiGiorni(oggiRoma(), 1),
        });
        fraUnaSettimana = await creaAttivita({
          edizione_id: edizione,
          data: aggiungiGiorni(oggiRoma(), 8),
        });
        bozza = await creaAttivita({
          edizione_id: edizione,
          stato: "BOZZA",
          consenso_raccolto: false,
          consenso_modalita: null,
        });
        annullata = await creaAttivita({ edizione_id: edizione, stato: "ANNULLATA" });
      });

      afterAll(async () => {
        await pulisci({ utenti: [abilitato, estraneo] });
      });

      it("porta le attività pubblicate dell'edizione attiva, in ordine di data", async () => {
        const elenco = await attivitaPubblicate(abilitato.client);
        const ids = elenco.map((a) => a.id);
        expect(ids).toContain(domani);
        expect(ids).toContain(fraUnaSettimana);
        expect(ids.indexOf(domani)).toBeLessThan(ids.indexOf(fraUnaSettimana));

        const date = elenco.flatMap((a) => (a.data ? [a.data] : []));
        expect([...date].sort()).toEqual(date);
      });

      it("non porta le bozze né le annullate", async () => {
        const ids = (await attivitaPubblicate(abilitato.client)).map((a) => a.id);
        expect(ids).not.toContain(bozza);
        expect(ids).not.toContain(annullata);
      });

      it("porta conteggi, mai nomi né identificativi", async () => {
        const riga = (await attivitaPubblicate(abilitato.client)).find((a) => a.id === domani);
        expect(riga?.capienza).toBe(4);
        expect(riga?.iscritti).toBe(0);
        expect(riga?.postiRimasti).toBe(4);

        for (const colonna of ["utente_id", "email", "nome_pubblico"] as const) {
          const { data, error } = await abilitato.client
            .from("attivita_elenco")
            // The column does not exist in the view: PostgREST refuses the select.
            .select(colonna);
          expect(error, colonna).not.toBeNull();
          expect(data).toBeNull();
        }
      });

      it("a chi non è abilitato non porta niente, nemmeno un titolo", async () => {
        expect(await attivitaPubblicate(estraneo.client)).toEqual([]);
      });

      it("a un visitatore non porta niente", async () => {
        expect(await attivitaPubblicate(visitatore())).toEqual([]);
      });

      it("si raggruppa per settimana, e ogni gruppo tiene una settimana sola", () => {
        const righe = [
          finta({ id: "a", data: "2026-09-21" }),
          finta({ id: "b", data: "2026-09-27" }),
          finta({ id: "c", data: "2026-09-28" }),
        ];
        const settimane = perSettimana(righe);
        expect(settimane.map((s) => s.lunedi)).toEqual(["2026-09-21", "2026-09-28"]);
        expect(settimane[0].domenica).toBe("2026-09-27");
        expect(settimane[0].attivita.map((a) => a.id)).toEqual(["a", "b"]);
        expect(settimane[1].attivita.map((a) => a.id)).toEqual(["c"]);
      });

      it("una settimana senza attività non compare", () => {
        const settimane = perSettimana([
          finta({ id: "a", data: "2026-09-21" }),
          finta({ id: "b", data: "2026-10-05" }),
        ]);
        expect(settimane.map((s) => s.lunedi)).toEqual(["2026-09-21", "2026-10-05"]);
      });
    });

    describe("il dettaglio e i due livelli (§15.8)", () => {
      let iscritto: UtenteTest;
      let nonIscritto: UtenteTest;
      let estraneo: UtenteTest;
      let attivita: string;

      beforeAll(async () => {
        [iscritto, nonIscritto, estraneo] = await Promise.all([
          creaUtente(),
          creaUtente(),
          creaUtente(),
        ]);
        for (const u of [iscritto, nonIscritto]) await abilita(u.id, edizione);
        attivita = await creaAttivita({ edizione_id: edizione, capienza: 4 });
      });

      afterAll(async () => {
        await pulisci({ utenti: [iscritto, nonIscritto, estraneo] });
      });

      it("a chi è abilitato dà il livello 1 e niente altro", async () => {
        const trovata = await attivitaConLivelli(nonIscritto.client, attivita);
        expect(trovata).not.toBeNull();
        expect(trovata?.attivita.abitanteNome).toBe("Nome");
        expect(trovata?.attivita.luogoGenerico).toBe("Frazione di prova");
        expect(trovata?.attivita.descrizione).toBe("Racconto dell'abitante, con le sue parole.");
        expect(trovata?.livello2).toBeNull();
      });

      it("il livello 2 arriva iscrivendosi e se ne va annullando, nello stesso istante", async () => {
        const presa = await iscrivitiAttivita(iscritto.client, attivita);
        expect(presa.ok).toBe(true);
        if (!presa.ok) return;

        const dentro = await attivitaConLivelli(iscritto.client, attivita);
        expect(dentro?.livello2?.abitanteCognome).toBe("Cognome");
        expect(dentro?.livello2?.abitanteTelefono).toBe("000 0000000");
        expect(dentro?.livello2?.luogoEsatto).toBe("Via di prova 1, Frazione di prova");

        const mie = await mieIscrizioni(iscritto.client);
        expect(mie.map((i) => i.attivitaId)).toContain(attivita);

        const via = await annullaIscrizione(iscritto.client, presa.id);
        expect(via.ok).toBe(true);

        // Nothing was copied into the page: the view simply stops answering.
        const fuori = await attivitaConLivelli(iscritto.client, attivita);
        expect(fuori?.livello2).toBeNull();
        expect(fuori?.attivita.abitanteNome).toBe("Nome");
      });

      it("a chi non è abilitato non dice nemmeno che l'attività esiste", async () => {
        expect(await attivitaConLivelli(estraneo.client, attivita)).toBeNull();
        expect(await attivitaConLivelli(visitatore(), attivita)).toBeNull();
      });
    });

    describe("chi viene (§15.6, la formula di §6.6)", () => {
      let conNome: UtenteTest;
      let senzaNome: UtenteTest;
      let nonIscritto: UtenteTest;
      let estraneo: UtenteTest;
      let attivita: string;
      let passata: string;

      beforeAll(async () => {
        [conNome, senzaNome, nonIscritto, estraneo] = await Promise.all([
          creaUtente(),
          creaUtente(),
          creaUtente(),
          creaUtente(),
        ]);
        for (const u of [conNome, senzaNome, nonIscritto]) await abilita(u.id, edizione);

        const s = servizio();
        await s
          .from("utenti")
          .update({ nome_pubblico: "Pia", mostra_nome_pubblico: true })
          .eq("id", conNome.id);
        await s
          .from("utenti")
          .update({ nome_pubblico: "Nino", mostra_nome_pubblico: false })
          .eq("id", senzaNome.id);

        attivita = await creaAttivita({ edizione_id: edizione, capienza: 4 });
        for (const u of [conNome, senzaNome]) {
          const esito = await iscrivitiAttivita(u.client, attivita);
          if (!esito.ok) throw new Error(`fixture iscrizione failed: ${esito.motivo}`);
        }

        // An edition that began a week ago, so an activity can be in its past
        // without falling outside it (§15.3.2).
        await s
          .from("edizioni")
          .update({ data_inizio: aggiungiGiorni(oggiRoma(), -7) })
          .eq("id", edizione);
        passata = await creaAttivita({
          edizione_id: edizione,
          data: aggiungiGiorni(oggiRoma(), -1),
          capienza: 4,
        });
        await inserisciIscrizioneDiretta({ attivita_id: passata, utente_id: conNome.id });
      });

      afterAll(async () => {
        await pulisci({ utenti: [conNome, senzaNome, nonIscritto, estraneo] });
      });

      it("porta i nomi di chi ha acceso il nome pubblico, e solo quelli", async () => {
        const nomi = await nomiIscritti(nonIscritto.client, attivita);
        expect(nomi).toEqual(["Pia"]);
      });

      it("gli altri stanno nel conteggio, che è la differenza", async () => {
        const trovata = await attivitaConLivelli(nonIscritto.client, attivita);
        const nomi = await nomiIscritti(nonIscritto.client, attivita);
        expect(trovata?.attivita.iscritti).toBe(2);
        expect((trovata?.attivita.iscritti ?? 0) - nomi.length).toBe(1);
        expect(rigaPersone(nomi, 1)).toBe(
          "Pia + 1 persona che preferisce non condividere pubblicamente il nome",
        );
      });

      it("il nome non porta con sé nessun identificativo", async () => {
        for (const colonna of ["utente_id", "email", "id"] as const) {
          const { data, error } = await nonIscritto.client
            .from("iscritti_attivita")
            .select(colonna);
          expect(error, colonna).not.toBeNull();
          expect(data).toBeNull();
        }
      });

      it("a chi non è abilitato non esce nessun nome", async () => {
        expect(await nomiIscritti(estraneo.client, attivita)).toEqual([]);
        expect(await nomiIscritti(visitatore(), attivita)).toEqual([]);
      });

      it("il giorno dopo l'attività i nomi non escono più a chi non c'era", async () => {
        // §15.11: that communication lasts until the day after the activity.
        expect(await nomiIscritti(nonIscritto.client, passata)).toEqual([]);
      });

      it("ma chi c'era continua a vedere la propria attività", async () => {
        expect(await nomiIscritti(conNome.client, passata)).toEqual(["Pia"]);
      });
    });

    describe("iscriversi e annullare dalle pagine (§15.7)", () => {
      let titolare: UtenteTest;
      let altro: UtenteTest;
      let estraneo: UtenteTest;
      let attivita: string;
      let unPosto: string;
      let cominciata: string;

      beforeAll(async () => {
        [titolare, altro, estraneo] = await Promise.all([
          creaUtente(),
          creaUtente(),
          creaUtente(),
        ]);
        for (const u of [titolare, altro]) await abilita(u.id, edizione);
        attivita = await creaAttivita({ edizione_id: edizione, capienza: 2 });
        unPosto = await creaAttivita({ edizione_id: edizione, capienza: 1 });
        cominciata = await creaAttivita({
          edizione_id: edizione,
          data: oggiRoma(),
          ora_inizio: "00:01",
          ora_fine: "00:02",
          capienza: 4,
        });
      });

      afterAll(async () => {
        await pulisci({ utenti: [titolare, altro, estraneo] });
      });

      it("si prende posto, una volta sola", async () => {
        const presa = await iscrivitiAttivita(titolare.client, attivita);
        expect(presa.ok).toBe(true);

        const seconda = await iscrivitiAttivita(titolare.client, attivita);
        expect(seconda.ok).toBe(false);
        if (!seconda.ok) expect(seconda.motivo).toBe("ISCRIZIONE_DUPLICATA");
      });

      it("a posti esauriti si sente dire che sono esauriti, e nient'altro", async () => {
        // No waiting list to fall into (D22, rule 29).
        const presa = await iscrivitiAttivita(titolare.client, unPosto);
        expect(presa.ok).toBe(true);

        const esito = await iscrivitiAttivita(altro.client, unPosto);
        expect(esito.ok).toBe(false);
        if (!esito.ok) expect(esito.motivo).toBe("POSTI_ESAURITI");
      });

      it("senza abilitazione non si prende posto", async () => {
        const esito = await iscrivitiAttivita(estraneo.client, attivita);
        expect(esito.ok).toBe(false);
        if (!esito.ok) expect(esito.motivo).toBe("NON_ABILITATO");
      });

      it("a attività cominciata non si prende posto", async () => {
        const esito = await iscrivitiAttivita(altro.client, cominciata);
        expect(esito.ok).toBe(false);
        if (!esito.ok) expect(esito.motivo).toBe("ATTIVITA_COMINCIATA");
      });

      it("nessuno annulla l'iscrizione di un altro", async () => {
        const mia = (await mieIscrizioni(titolare.client)).find((i) => i.attivitaId === unPosto);
        expect(mia).toBeTruthy();

        const esito = await annullaIscrizione(altro.client, mia!.id);
        expect(esito.ok).toBe(false);

        const { data } = await servizio()
          .from("iscrizioni")
          .select("stato")
          .eq("id", mia!.id)
          .single();
        expect(data?.stato).toBe("ATTIVA");
      });

      it("il titolare annulla la propria, e il posto torna libero", async () => {
        const mia = (await mieIscrizioni(titolare.client)).find((i) => i.attivitaId === unPosto);
        const esito = await annullaIscrizione(titolare.client, mia!.id);
        expect(esito.ok).toBe(true);

        // Not a promotion: nobody is queued. The place is simply free again,
        // and whoever asks next gets it (§15.7).
        const dopo = await iscrivitiAttivita(altro.client, unPosto);
        expect(dopo.ok).toBe(true);
      });

      it("a attività cominciata non si annulla più", async () => {
        const iscrizione = await inserisciIscrizioneDiretta({
          attivita_id: cominciata,
          utente_id: titolare.id,
        });
        const esito = await annullaIscrizione(titolare.client, iscrizione);
        expect(esito.ok).toBe(false);

        const { data } = await servizio()
          .from("iscrizioni")
          .select("stato")
          .eq("id", iscrizione)
          .single();
        expect(data?.stato).toBe("ATTIVA");
      });
    });

    describe("le frasi che la pagina sceglie", () => {
      it("«Completa» copre i posti finiti e la scheda senza capienza (§15.3.2)", () => {
        expect(completa(finta({ capienza: 4, postiRimasti: 2 }))).toBe(false);
        expect(completa(finta({ capienza: 4, postiRimasti: 0 }))).toBe(true);
        expect(completa(finta({ capienza: null, postiRimasti: 0 }))).toBe(true);
      });

      it("l'avviso delle ultime ore compare solo sotto ORE_DISDETTA (§15.7)", () => {
        const adesso = new Date("2026-09-26T10:00:00Z");
        const fra = (ore: number) =>
          new Date(adesso.getTime() + ore * 3_600_000).toISOString();

        expect(disdettaTardiva(finta({ inizio: fra(ORE_DISDETTA + 1) }), adesso)).toBe(false);
        expect(disdettaTardiva(finta({ inizio: fra(ORE_DISDETTA - 1) }), adesso)).toBe(true);
        // Already begun: there is no button for the sentence to accompany.
        expect(
          disdettaTardiva(finta({ inizio: fra(-1), ancoraAperta: false }), adesso),
        ).toBe(false);
        expect(disdettaTardiva(finta({ inizio: null }), adesso)).toBe(false);
      });
    });
  });
});
