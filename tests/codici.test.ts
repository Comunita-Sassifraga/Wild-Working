/**
 * SPEC §15.3.5, §15.3.6, §15.4 — i cartoncini e le abilitazioni.
 *
 * Il file che CLAUDE.md chiede insieme al passo 15. Quattro cose sopra a
 * tutte le altre:
 *
 *  - un codice vale una volta sola e produce **una** abilitazione;
 *  - il rifiuto è **identico** per codice sconosciuto, già usato e revocato:
 *    chi prova non deve poter distinguere i tre casi, altrimenti il "già
 *    usato" diventa un modo per sapere quali cartoncini esistono;
 *  - il codice in chiaro non si conserva e non torna più indietro dopo la
 *    schermata di generazione;
 *  - i numeri progressivi non si riusano mai, nemmeno dopo una revoca.
 *
 * Nessun indirizzo email viene stampato (regola 4), e nessun codice in
 * chiaro finisce in un messaggio di questo file (regola 23).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { improntaCodice, normalizzaCodice, nuovoCodice } from "@/lib/abitanti/codici";
import { MAX_TENTATIVI_CODICE_ORA, PREFISSO_CODICE } from "@/config/limits";
import {
  abilitaUtente,
  abilitazioniEdizione,
  accendiEdizione,
  codiciEdizione,
  consumaCodice,
  generaCodici,
  revocaAbilitazione,
  revocaCodice,
  sonoAbilitato,
} from "@/lib/db/abitanti";
import {
  CHIAVE_CODICI,
  assegnaIncarico,
  creaEdizione,
  creaUtente,
  pulisci,
  pulisciEdizioni,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

/** Genera cartoncini come farebbe il pannello, e restituisce i codici in chiaro. */
async function cartoncini(
  admin: UtenteTest,
  edizione: string,
  quanti: number,
): Promise<{ progressivo: number; codice: string }[]> {
  const esito = await generaCodici(admin.client, edizione, quanti, CHIAVE_CODICI);
  if (!esito.ok) throw new Error(`generaCodici rifiutato: ${esito.motivo}`);
  return esito.valore;
}

describe("§15.3.5 e §15.4 — cartoncini, tentativi, abilitazioni", () => {
  const edizioni: string[] = [];
  const utenti: UtenteTest[] = [];
  let admin: UtenteTest;
  let edizione: string;

  /** Un utente nuovo, registrato per la pulizia finale. */
  async function partecipante(): Promise<UtenteTest> {
    const u = await creaUtente();
    utenti.push(u);
    return u;
  }

  beforeAll(async () => {
    admin = await creaUtente();
    utenti.push(admin);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
    edizione = await creaEdizione({ nome: "Edizione dei cartoncini" });
    edizioni.push(edizione);
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
    await pulisci({ utenti });
  });

  // -------------------------------------------------------------------------
  // Il formato — §15.4
  // -------------------------------------------------------------------------

  describe("il formato del codice", () => {
    it("non contiene nessun carattere ambiguo", () => {
      // §15.4: niente O e zero, niente I, 1 e L insieme. Lo digita una
      // persona su un telefono, al freddo, con poca luce.
      for (let i = 0; i < 200; i++) {
        const parte = nuovoCodice().slice(PREFISSO_CODICE.length + 1);
        expect(parte).not.toMatch(/[O0I1L]/);
        expect(parte).toMatch(/^[A-Z2-9]+$/);
      }
    });

    it("si riconosce comunque lo si scriva", () => {
      const codice = nuovoCodice();
      const minuscolo = codice.toLowerCase();
      const spezzato = codice.replace("-", " ").toLowerCase();
      const senzaNiente = codice.replace("-", "");
      const atteso = improntaCodice(codice, CHIAVE_CODICI);
      for (const scritto of [minuscolo, spezzato, senzaNiente, ` ${codice} `]) {
        expect(improntaCodice(scritto, CHIAVE_CODICI)).toBe(atteso);
      }
      expect(normalizzaCodice(spezzato)).toBe(senzaNiente);
    });

    it("due codici generati di fila non sono mai lo stesso", () => {
      const visti = new Set<string>();
      for (let i = 0; i < 500; i++) visti.add(nuovoCodice());
      expect(visti.size).toBeGreaterThan(400);
    });
  });

  // -------------------------------------------------------------------------
  // La generazione — §15.3.5
  // -------------------------------------------------------------------------

  describe("la generazione", () => {
    it("assegna numeri progressivi e non conserva nessun codice in chiaro", async () => {
      const generati = await cartoncini(admin, edizione, 3);
      expect(generati).toHaveLength(3);
      expect(generati.map((c) => c.progressivo)).toEqual([1, 2, 3]);

      // Il punto di tutto: nel database non c'è nessuno dei tre codici, né
      // in una colonna né in un'altra. Solo impronte irreversibili.
      const { data } = await servizio().from("codici_invito").select("*").eq("edizione_id", edizione);
      const tutto = JSON.stringify(data);
      for (const c of generati) {
        expect(tutto).not.toContain(c.codice);
        expect(tutto).not.toContain(normalizzaCodice(c.codice));
      }
      // L'impronta invece c'è, ed è quella che il consumo confronterà.
      for (const c of generati) {
        expect(tutto).toContain(improntaCodice(c.codice, CHIAVE_CODICI));
      }
    });

    it("continua la numerazione invece di ricominciare", async () => {
      const dopo = await cartoncini(admin, edizione, 2);
      expect(dopo.map((c) => c.progressivo)).toEqual([4, 5]);
    });

    it("l'elenco del pannello non porta mai un codice né un'impronta", async () => {
      const elenco = await codiciEdizione(admin.client, edizione);
      expect(elenco.length).toBeGreaterThan(0);
      const testo = JSON.stringify(elenco);
      expect(testo).not.toContain("impronta");
      for (const riga of elenco) expect(Object.keys(riga)).not.toContain("impronta");
    });

    it("nessuno che non sia amministratore genera, revoca o legge cartoncini", async () => {
      const chiunque = await partecipante();

      const generato = await generaCodici(chiunque.client, edizione, 1, CHIAVE_CODICI);
      expect(generato).toEqual({ ok: false, motivo: "NON_AUTORIZZATO" });

      const elenco = await codiciEdizione(chiunque.client, edizione);
      expect(elenco).toEqual([]);

      const { data: diretto } = await chiunque.client.from("codici_invito").select("*");
      expect(diretto ?? []).toEqual([]);

      const { data: daVisitatore } = await visitatore().from("codici_amministrazione").select("*");
      expect(daVisitatore ?? []).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Il consumo — §15.4
  // -------------------------------------------------------------------------

  describe("il consumo del codice", () => {
    it("vale una volta sola e crea esattamente un'abilitazione", async () => {
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      const persona = await partecipante();

      expect(await sonoAbilitato(persona.client)).toBe(false);
      expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe("ABILITATO");
      expect(await sonoAbilitato(persona.client)).toBe(true);

      const { data } = await servizio()
        .from("abilitazioni")
        .select("id, origine, attiva")
        .eq("utente_id", persona.id)
        .eq("edizione_id", edizione);
      expect(data).toHaveLength(1);
      expect(data?.[0].origine).toBe("CODICE");
      expect(data?.[0].attiva).toBe(true);

      // Il cartoncino risulta consumato, e da chi.
      const { data: riga } = await servizio()
        .from("codici_invito")
        .select("usato_il, utente_id")
        .eq("edizione_id", edizione)
        .eq("progressivo", cartoncino.progressivo)
        .single();
      expect(riga?.usato_il).not.toBeNull();
      expect(riga?.utente_id).toBe(persona.id);
    });

    it("un secondo tentativo di un'altra persona viene rifiutato", async () => {
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      const prima = await partecipante();
      const seconda = await partecipante();

      expect(await consumaCodice(prima.client, cartoncino.codice, CHIAVE_CODICI)).toBe("ABILITATO");
      expect(await consumaCodice(seconda.client, cartoncino.codice, CHIAVE_CODICI)).toBe("RIFIUTATO");
      expect(await sonoAbilitato(seconda.client)).toBe(false);
    });

    it("a chi lo ha già usato si dice soltanto che è già abilitato", async () => {
      // L'unica eccezione che §15.4 concede al messaggio unico, e vale solo
      // per la stessa persona che quel cartoncino l'ha consumato.
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      const persona = await partecipante();

      expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe("ABILITATO");
      expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe(
        "GIA_ABILITATO",
      );

      const { count } = await servizio()
        .from("abilitazioni")
        .select("id", { count: "exact", head: true })
        .eq("utente_id", persona.id);
      expect(count).toBe(1);
    });

    it("chi è stato revocato non rientra ridigitando il proprio cartoncino", async () => {
      // Trovato provando la schermata il 12/09/2026, e scritto in §15.4:
      // l'eccezione del «già abilitato» vale per chi è dentro davvero, non
      // per chi è stato messo fuori. Altrimenti la revoca non revoca niente.
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      const persona = await partecipante();
      expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe(
        "ABILITATO",
      );

      const elenco = await abilitazioniEdizione(admin.client, edizione);
      const sua = elenco.find((a) => a.utente_id === persona.id);
      await revocaAbilitazione(admin.client, sua?.id ?? "");

      // Il rifiuto ordinario, identico a quello di uno sconosciuto: dice a
      // chi scrivere, che è quello che questa persona deve fare.
      expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe(
        "RIFIUTATO",
      );
      expect(await sonoAbilitato(persona.client)).toBe(false);
    });

    it("chi è già abilitato non brucia il cartoncino di un altro", async () => {
      const [mio] = await cartoncini(admin, edizione, 1);
      const [altrui] = await cartoncini(admin, edizione, 1);
      const persona = await partecipante();

      expect(await consumaCodice(persona.client, mio.codice, CHIAVE_CODICI)).toBe("ABILITATO");
      expect(await consumaCodice(persona.client, altrui.codice, CHIAVE_CODICI)).toBe(
        "GIA_ABILITATO",
      );

      const { data } = await servizio()
        .from("codici_invito")
        .select("usato_il")
        .eq("edizione_id", edizione)
        .eq("progressivo", altrui.progressivo)
        .single();
      expect(data?.usato_il).toBeNull();
    });

    it("il rifiuto è identico per codice sconosciuto, già usato e revocato", async () => {
      // Il cuore di §15.4. Se i tre casi rispondessero in modo diverso,
      // provare un codice diventerebbe un modo per sapere cosa esiste.
      const [usato] = await cartoncini(admin, edizione, 1);
      const [daRevocare] = await cartoncini(admin, edizione, 1);
      const titolare = await partecipante();
      expect(await consumaCodice(titolare.client, usato.codice, CHIAVE_CODICI)).toBe("ABILITATO");

      const elenco = await codiciEdizione(admin.client, edizione);
      const riga = elenco.find((c) => c.progressivo === daRevocare.progressivo);
      expect(await revocaCodice(admin.client, riga?.id ?? "")).toEqual({
        ok: true,
        valore: undefined,
      });

      const sconosciuto = nuovoCodice();
      const risposte: string[] = [];
      for (const codice of [sconosciuto, usato.codice, daRevocare.codice]) {
        const persona = await partecipante();
        risposte.push(await consumaCodice(persona.client, codice, CHIAVE_CODICI));
      }
      expect(risposte).toEqual(["RIFIUTATO", "RIFIUTATO", "RIFIUTATO"]);
      expect(new Set(risposte).size).toBe(1);
    });

    it("un codice di un'altra edizione non funziona", async () => {
      const altra = await creaEdizione({ nome: "Edizione chiusa", attiva: false });
      edizioni.push(altra);
      const [vecchio] = await cartoncini(admin, altra, 1);

      const persona = await partecipante();
      expect(await consumaCodice(persona.client, vecchio.codice, CHIAVE_CODICI)).toBe("RIFIUTATO");
      expect(await sonoAbilitato(persona.client)).toBe(false);
    });

    it("fuori da un'edizione attiva non si consuma niente", async () => {
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      const persona = await partecipante();

      await accendiEdizione(admin.client, edizione, false);
      try {
        expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe(
          "MODULO_CHIUSO",
        );
        const { data } = await servizio()
          .from("codici_invito")
          .select("usato_il")
          .eq("edizione_id", edizione)
          .eq("progressivo", cartoncino.progressivo)
          .single();
        expect(data?.usato_il).toBeNull();
      } finally {
        await accendiEdizione(admin.client, edizione, true);
      }
    });

    it("un visitatore non consuma niente", async () => {
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      const { error } = await visitatore().rpc("consuma_codice", {
        p_impronta: improntaCodice(cartoncino.codice, CHIAVE_CODICI),
        p_max_tentativi: MAX_TENTATIVI_CODICE_ORA,
      });
      expect(error).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Il limite orario — §15.4, §15.3.6
  // -------------------------------------------------------------------------

  describe("il limite dei tentativi", () => {
    it(`al tentativo numero ${MAX_TENTATIVI_CODICE_ORA + 1} in un'ora si ferma`, async () => {
      const persona = await partecipante();

      for (let i = 0; i < MAX_TENTATIVI_CODICE_ORA; i++) {
        expect(await consumaCodice(persona.client, nuovoCodice(), CHIAVE_CODICI)).toBe("RIFIUTATO");
      }
      expect(await consumaCodice(persona.client, nuovoCodice(), CHIAVE_CODICI)).toBe(
        "TROPPI_TENTATIVI",
      );

      // E si ferma anche davanti a un codice buono: il limite viene prima.
      const [buono] = await cartoncini(admin, edizione, 1);
      expect(await consumaCodice(persona.client, buono.codice, CHIAVE_CODICI)).toBe(
        "TROPPI_TENTATIVI",
      );
      expect(await sonoAbilitato(persona.client)).toBe(false);

      const { count } = await servizio()
        .from("tentativi_codice")
        .select("id", { count: "exact", head: true })
        .eq("utente_id", persona.id);
      expect(count).toBe(MAX_TENTATIVI_CODICE_ORA);
    });

    it("i tentativi si contano per persona, non per tutti insieme", async () => {
      const persona = await partecipante();
      // Un'altra persona ha appena esaurito i suoi: questa parte da zero.
      const [buono] = await cartoncini(admin, edizione, 1);
      expect(await consumaCodice(persona.client, buono.codice, CHIAVE_CODICI)).toBe("ABILITATO");
    });

    it("la tabella dei tentativi non la legge né un visitatore né un utente", async () => {
      const persona = await partecipante();
      const { data: daUtente } = await persona.client.from("tentativi_codice").select("*");
      expect(daUtente ?? []).toEqual([]);
      const { data: daVisitatore } = await visitatore().from("tentativi_codice").select("*");
      expect(daVisitatore ?? []).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Revoca del cartoncino e numeri — §15.3.5, §15.4
  // -------------------------------------------------------------------------

  describe("la revoca di un cartoncino", () => {
    it("non riusa mai il numero, nemmeno dopo la revoca", async () => {
      const [perso] = await cartoncini(admin, edizione, 1);
      const elenco = await codiciEdizione(admin.client, edizione);
      const riga = elenco.find((c) => c.progressivo === perso.progressivo);
      expect(await revocaCodice(admin.client, riga?.id ?? "")).toEqual({
        ok: true,
        valore: undefined,
      });

      const [nuovo] = await cartoncini(admin, edizione, 1);
      expect(nuovo.progressivo).toBe(perso.progressivo + 1);

      // E il numero revocato resta lì, unico dentro l'edizione.
      const dopo = await codiciEdizione(admin.client, edizione);
      const numeri = dopo.map((c) => c.progressivo);
      expect(new Set(numeri).size).toBe(numeri.length);
      expect(numeri).toContain(perso.progressivo);
    });

    it("un cartoncino già usato non si revoca: si revoca l'abilitazione", async () => {
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      const persona = await partecipante();
      expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe(
        "ABILITATO",
      );

      const elenco = await codiciEdizione(admin.client, edizione);
      const riga = elenco.find((c) => c.progressivo === cartoncino.progressivo);
      expect(await revocaCodice(admin.client, riga?.id ?? "")).toEqual({
        ok: false,
        motivo: "CODICE_GIA_USATO",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Abilitazione manuale e revoca puntuale — §15.3.4, §15.4
  // -------------------------------------------------------------------------

  describe("abilitare a mano e revocare", () => {
    it("abilita una persona già registrata, con origine MANUALE", async () => {
      const persona = await partecipante();
      const esito = await abilitaUtente(admin.client, persona.id);
      expect(esito.ok).toBe(true);
      expect(await sonoAbilitato(persona.client)).toBe(true);

      const { data } = await servizio()
        .from("abilitazioni")
        .select("origine")
        .eq("utente_id", persona.id)
        .eq("edizione_id", edizione);
      expect(data).toHaveLength(1);
      expect(data?.[0].origine).toBe("MANUALE");
    });

    it("riabilitare riaccende la riga che c'è, non ne crea una seconda", async () => {
      // §15.3.4, chiarito il 12/09/2026: due righe vorrebbero dire due
      // risposte alla domanda «questa persona può entrare?».
      const persona = await partecipante();
      const [cartoncino] = await cartoncini(admin, edizione, 1);
      expect(await consumaCodice(persona.client, cartoncino.codice, CHIAVE_CODICI)).toBe(
        "ABILITATO",
      );

      const elenco = await abilitazioniEdizione(admin.client, edizione);
      const sua = elenco.find((a) => a.utente_id === persona.id);
      expect(await revocaAbilitazione(admin.client, sua?.id ?? "")).toEqual({
        ok: true,
        valore: undefined,
      });
      expect(await sonoAbilitato(persona.client)).toBe(false);

      // Riabilitata a mano: origine diversa, riga la stessa.
      expect((await abilitaUtente(admin.client, persona.id)).ok).toBe(true);
      expect(await sonoAbilitato(persona.client)).toBe(true);

      const { data } = await servizio()
        .from("abilitazioni")
        .select("id, attiva, revocata_il")
        .eq("utente_id", persona.id)
        .eq("edizione_id", edizione);
      expect(data).toHaveLength(1);
      expect(data?.[0].id).toBe(sua?.id);
      expect(data?.[0].attiva).toBe(true);
      expect(data?.[0].revocata_il).toBeNull();
    });

    it("la revoca annota chi e quando, e non tocca nessuna prenotazione", async () => {
      const persona = await partecipante();
      expect((await abilitaUtente(admin.client, persona.id)).ok).toBe(true);

      const elenco = await abilitazioniEdizione(admin.client, edizione);
      const sua = elenco.find((a) => a.utente_id === persona.id);
      await revocaAbilitazione(admin.client, sua?.id ?? "");

      const { data } = await servizio()
        .from("abilitazioni")
        .select("attiva, revocata_il, revocata_da")
        .eq("id", sua?.id ?? "")
        .single();
      expect(data?.attiva).toBe(false);
      expect(data?.revocata_il).not.toBeNull();
      expect(data?.revocata_da).toBe(admin.id);
    });

    it("una revoca già fatta non si rifà, e un identificativo inventato non passa", async () => {
      const persona = await partecipante();
      expect((await abilitaUtente(admin.client, persona.id)).ok).toBe(true);
      const elenco = await abilitazioniEdizione(admin.client, edizione);
      const sua = elenco.find((a) => a.utente_id === persona.id);

      await revocaAbilitazione(admin.client, sua?.id ?? "");
      expect(await revocaAbilitazione(admin.client, sua?.id ?? "")).toEqual({
        ok: false,
        motivo: "NON_TROVATO",
      });
      expect(
        await revocaAbilitazione(admin.client, "00000000-0000-0000-0000-000000000000"),
      ).toEqual({ ok: false, motivo: "NON_TROVATO" });
    });

    it("nessuno che non sia amministratore abilita o revoca, nemmeno sé stesso", async () => {
      const persona = await partecipante();
      const altra = await partecipante();

      expect(await abilitaUtente(persona.client, persona.id)).toEqual({
        ok: false,
        motivo: "NON_AUTORIZZATO",
      });
      expect(await abilitaUtente(persona.client, altra.id)).toEqual({
        ok: false,
        motivo: "NON_AUTORIZZATO",
      });
      expect(await sonoAbilitato(persona.client)).toBe(false);

      expect((await abilitaUtente(admin.client, altra.id)).ok).toBe(true);
      const elenco = await abilitazioniEdizione(admin.client, edizione);
      const sua = elenco.find((a) => a.utente_id === altra.id);
      expect(await revocaAbilitazione(persona.client, sua?.id ?? "")).toEqual({
        ok: false,
        motivo: "NON_AUTORIZZATO",
      });
      expect(await sonoAbilitato(altra.client)).toBe(true);
    });

    it("l'elenco delle abilitazioni non lo vede nessun altro", async () => {
      const persona = await partecipante();
      expect(await abilitazioniEdizione(persona.client, edizione)).toEqual([]);
      const { data } = await visitatore().from("abilitazioni_amministrazione").select("*");
      expect(data ?? []).toEqual([]);
    });

    it("non si abilita chi non si è mai registrato", async () => {
      // §15.4: non esiste, e non deve esistere, un «abilita questo indirizzo»
      // per una persona che non è ancora mai entrata.
      expect(await abilitaUtente(admin.client, "00000000-0000-0000-0000-000000000000")).toEqual({
        ok: false,
        motivo: "NON_TROVATO",
      });
    });
  });
});
