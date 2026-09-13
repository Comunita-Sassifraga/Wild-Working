/**
 * SPEC §15.9 — iscrivere e annullare per conto di qualcuno. §15.14 step 18.
 *
 * The two powers the amministratore has over `iscrizioni` and does not have
 * over `prenotazioni`. They exist because there is no waiting list (D22,
 * rule 29): the swap between somebody who gives a place up and somebody who
 * takes it can only be closed by a person.
 *
 * The file is organised around the three conditions §15.9 sets on them, and
 * the first one is the reason the file exists at all:
 *
 *   **only iscrizioni** — whatever these two actions are asked to do, no
 *   `prenotazione` moves. Rule 6 stands: for desks §8.2 leaves a list to look
 *   at and no button that cancels;
 *   **traced** — `creata_da` and `annullata_da`;
 *   **the person is told** — exactly one email each, and the one about a
 *   cancellation carries the reason if there is one.
 *
 * Plus the list of §15.9 itself: who is coming, with the address to write to,
 * until the day after the activity — and the sentence handed to the
 * proponente, which carries no address at all.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { frasePerProponente } from "@/lib/abitanti/proponente";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import { annullaPerConto, iscriviPerConto, iscrittiAttivita } from "@/lib/db/iscritti";
import {
  avvisaAnnullamentoDaAmministratore,
  avvisaIscrizioneDaAmministratore,
} from "@/lib/posta/abitanti";
import {
  abilita,
  ambienteNelProcesso,
  assegnaIncarico,
  attendiEmail,
  contaEmail,
  creaAttivita,
  creaEdizione,
  creaSede,
  creaUtenti,
  inserisciIscrizioneDiretta,
  inserisciPrenotazioneDiretta,
  iscriviti,
  nessunaEmailOltre,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

/** The row as it really is, read past every policy. Fixtures and assertions only. */
async function riga(id: string) {
  const { data } = await servizio()
    .from("iscrizioni")
    .select("id, utente_id, stato, creata_da, annullata_da, annullata_il, posto_progressivo")
    .eq("id", id)
    .single();
  return data;
}

describe("§15.9 iscrivere e annullare per conto di qualcuno", () => {
  const edizioni: string[] = [];
  let edizione: string;
  let admin: UtenteTest;
  let partecipante: UtenteTest;
  let subentrante: UtenteTest;
  /** Signed in, but never abilitato: §15.9 refuses to sign them up. */
  let estraneo: UtenteTest;
  let utenti: UtenteTest[];

  beforeAll(async () => {
    // The emails are built and sent by the app itself, which makes its own
    // backend client: the test has to run with the same environment the
    // application reads (as tests/moderazione.test.ts does).
    ambienteNelProcesso();

    edizione = await creaEdizione();
    edizioni.push(edizione);

    [admin, partecipante, subentrante, estraneo] = await creaUtenti(4);
    utenti = [admin, partecipante, subentrante, estraneo];

    // An amministratore is global: never a sede (§5.6).
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
    await abilita(partecipante.id, edizione);
    await abilita(subentrante.id, edizione);
  });

  afterAll(async () => {
    await pulisci({ utenti, edizioni });
  });

  // -------------------------------------------------------------------------
  // Lo scambio di posto: le due azioni, nell'ordine in cui si usano
  // -------------------------------------------------------------------------

  describe("lo scambio di posto", () => {
    let attivita: string;
    let iscrizione: string;

    beforeAll(async () => {
      attivita = await creaAttivita({ edizione_id: edizione, capienza: 1 });
      const esito = await iscriviti(partecipante.client, attivita);
      if (!esito.ok) throw new Error(`fixture: iscrizione rifiutata (${esito.codice})`);
      iscrizione = esito.id;
    });

    it("l'attività è al completo, e finché lo è l'amministratore non può forzarla (§15.12)", async () => {
      const esito = await iscriviPerConto(admin.client, attivita, subentrante.id);
      expect(esito).toMatchObject({ ok: false, motivo: "POSTI_ESAURITI" });

      // Il vincolo è lo stesso di tutti: nessuna riga in più, e nessuno stato
      // d'attesa in cui cadere (rule 29).
      const { data } = await servizio()
        .from("iscrizioni")
        .select("id, stato")
        .eq("attivita_id", attivita);
      expect(data?.length).toBe(1);
    });

    it("l'amministratore annulla l'iscrizione di un altro, e la traccia resta in annullata_da", async () => {
      const esito = await annullaPerConto(admin.client, iscrizione);
      expect(esito).toMatchObject({ ok: true, valore: partecipante.id });

      const r = await riga(iscrizione);
      expect(r?.stato).toBe("ANNULLATA");
      expect(r?.annullata_da).toBe(admin.id);
      expect(r?.annullata_il).not.toBeNull();
      // L'iscrizione resta di chi era: annullarla non la trasferisce.
      expect(r?.utente_id).toBe(partecipante.id);
    });

    it("annullare due volte la stessa iscrizione viene rifiutato", async () => {
      const esito = await annullaPerConto(admin.client, iscrizione);
      expect(esito).toMatchObject({ ok: false, motivo: "ISCRIZIONE_NON_TROVATA" });
    });

    it("poi iscrive chi subentra, e la traccia resta in creata_da", async () => {
      const esito = await iscriviPerConto(admin.client, attivita, subentrante.id);
      expect(esito.ok).toBe(true);
      if (!esito.ok) return;

      const r = await riga(esito.valore);
      expect(r?.utente_id).toBe(subentrante.id);
      expect(r?.creata_da).toBe(admin.id);
      expect(r?.stato).toBe("ATTIVA");
      // Il posto liberato è tornato disponibile, non riassegnato da una coda.
      expect(r?.posto_progressivo).toBe(1);
    });

    it("chi subentra vede subito il livello 2, come chi si è iscritto da sé (§15.8)", async () => {
      const { data } = await subentrante.client
        .from("attivita_iscritto")
        .select("abitante_cognome, abitante_telefono, luogo_esatto")
        .eq("id", attivita)
        .maybeSingle();
      expect(data?.abitante_telefono).not.toBeNull();
      expect(data?.luogo_esatto).not.toBeNull();
    });

    it("chi è uscito lo ha perso nello stesso istante (§15.12)", async () => {
      const { data } = await partecipante.client
        .from("attivita_iscritto")
        .select("abitante_telefono")
        .eq("id", attivita)
        .maybeSingle();
      expect(data).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Chi può essere iscritto, e da chi
  // -------------------------------------------------------------------------

  describe("i rifiuti", () => {
    let attivita: string;

    beforeAll(async () => {
      attivita = await creaAttivita({ edizione_id: edizione, capienza: 4 });
    });

    it("una persona senza abilitazione non viene iscritta (§15.9, 13/09/2026)", async () => {
      const esito = await iscriviPerConto(admin.client, attivita, estraneo.id);
      expect(esito).toMatchObject({ ok: false, motivo: "NON_ABILITATO" });

      const { data } = await servizio()
        .from("iscrizioni")
        .select("id")
        .eq("attivita_id", attivita);
      expect(data?.length ?? 0).toBe(0);
    });

    it("la stessa persona non viene iscritta due volte alla stessa attività", async () => {
      const sua = await creaAttivita({ edizione_id: edizione, capienza: 3 });
      expect((await iscriviPerConto(admin.client, sua, subentrante.id)).ok).toBe(true);

      const esito = await iscriviPerConto(admin.client, sua, subentrante.id);
      expect(esito).toMatchObject({ ok: false, motivo: "ISCRIZIONE_DUPLICATA" });
    });

    it("un'attività già cominciata non accetta più nessuno, nemmeno dal pannello (§15.7)", async () => {
      const passata = await creaAttivita({
        edizione_id: edizione,
        capienza: 4,
        data: oggiRoma(),
        ora_inizio: "00:01",
        ora_fine: "00:02",
      });
      const esito = await iscriviPerConto(admin.client, passata, subentrante.id);
      expect(esito).toMatchObject({ ok: false, motivo: "ATTIVITA_COMINCIATA" });
    });

    it("chi non è amministratore non può chiamare nessuna delle due azioni", async () => {
      const esito = await iscriviPerConto(partecipante.client, attivita, partecipante.id);
      expect(esito).toMatchObject({ ok: false, motivo: "NON_AUTORIZZATO" });

      const iscrizione = await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: partecipante.id,
      });
      const altro = await annullaPerConto(subentrante.client, iscrizione);
      expect(altro).toMatchObject({ ok: false, motivo: "NON_AUTORIZZATO" });
      expect((await riga(iscrizione))?.stato).toBe("ATTIVA");

      // E nemmeno un visitatore che non ha fatto l'accesso.
      const anonimo = await visitatore().rpc("annulla_per_conto", {
        p_iscrizione_id: iscrizione,
      });
      expect(anonimo.error).not.toBeNull();
    });

    it("il titolare può ancora annullare la propria iscrizione da sé (§15.7)", async () => {
      const mia = await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: subentrante.id,
        posto_progressivo: 3,
      });
      const { data } = await subentrante.client
        .from("iscrizioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", mia)
        .select("id");
      expect(data?.length).toBe(1);
      // Annullata da sé: annullata_da è la persona, non l'amministratore.
      expect((await riga(mia))?.annullata_da).toBe(subentrante.id);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 6: nessuna delle due azioni tocca una prenotazione. Mai.
  // -------------------------------------------------------------------------

  describe("le prenotazioni restano fuori (rule 6, §8.2)", () => {
    let sede: string;
    let prenotazione: string;
    let attivita: string;
    let iscrizione: string;

    beforeAll(async () => {
      sede = await creaSede({ capienza: 4 });
      prenotazione = await inserisciPrenotazioneDiretta({
        utente_id: partecipante.id,
        sede_id: sede,
        data: aggiungiGiorni(oggiRoma(), 3),
        fascia: "MATTINA",
      });
      attivita = await creaAttivita({ edizione_id: edizione, capienza: 4 });
      iscrizione = await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: partecipante.id,
      });
    });

    afterAll(async () => {
      await pulisci({ sedi: [sede] });
    });

    it("annullare per conto con l'identificativo di una prenotazione non annulla niente", async () => {
      const esito = await annullaPerConto(admin.client, prenotazione);
      expect(esito).toMatchObject({ ok: false, motivo: "ISCRIZIONE_NON_TROVATA" });

      const { data } = await servizio()
        .from("prenotazioni")
        .select("stato")
        .eq("id", prenotazione)
        .single();
      expect(data?.stato).toBe("ATTIVA");
    });

    it("iscrivere per conto con l'identificativo di una sede non crea e non tocca niente", async () => {
      const esito = await iscriviPerConto(admin.client, sede, partecipante.id);
      expect(esito).toMatchObject({ ok: false, motivo: "ATTIVITA_NON_DISPONIBILE" });

      const { data } = await servizio()
        .from("prenotazioni")
        .select("id, stato")
        .eq("sede_id", sede);
      expect(data?.length).toBe(1);
      expect(data?.[0].stato).toBe("ATTIVA");
    });

    it("annullare davvero un'iscrizione lascia la prenotazione della stessa persona dov'era", async () => {
      const esito = await annullaPerConto(admin.client, iscrizione);
      expect(esito).toMatchObject({ ok: true });

      const { data } = await servizio()
        .from("prenotazioni")
        .select("stato")
        .eq("utente_id", partecipante.id);
      expect(data?.every((p) => p.stato === "ATTIVA")).toBe(true);
    });

    it("l'amministratore non ha nessun modo di annullare una prenotazione altrui (§8.2)", async () => {
      const { data } = await admin.client
        .from("prenotazioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", prenotazione)
        .select("id");
      expect(data?.length ?? 0).toBe(0);
      const { data: dopo } = await servizio()
        .from("prenotazioni")
        .select("stato")
        .eq("id", prenotazione)
        .single();
      expect(dopo?.stato).toBe("ATTIVA");
    });
  });

  // -------------------------------------------------------------------------
  // «La persona lo viene a sapere» — §15.9, §15.10 righe tre e quattro
  // -------------------------------------------------------------------------

  describe("le due email (§15.10)", () => {
    let attivita: string;
    let scheda: NonNullable<Awaited<ReturnType<typeof schedaDi>>>;

    // Letta con il client dell'amministratore: attivita_amministrazione è
    // chiusa a chiunque altro, e il client di servizio non è un amministratore
    // — non ha nessun incarico, perché non è nessuno (§15.8, livello 3).
    async function schedaDi(id: string) {
      const { data } = await admin.client
        .from("attivita_amministrazione")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data;
    }

    beforeAll(async () => {
      attivita = await creaAttivita({ edizione_id: edizione, capienza: 4 });
      const letta = await schedaDi(attivita);
      if (!letta) throw new Error("fixture: scheda non letta");
      scheda = letta;
    });

    it("l'iscrizione fatta dall'amministratore manda esattamente un'email, e dice che è stato lui", async () => {
      const prima = await contaEmail(subentrante.email);
      expect(await avvisaIscrizioneDaAmministratore(subentrante.id, scheda)).toMatchObject({
        ok: true,
      });

      const email = await attendiEmail(subentrante.email, prima);
      expect(email.oggetto).toContain(scheda.titolo ?? "");
      // Come la conferma: i dati di livello 2 di §15.8 (§15.10 riga tre).
      expect(email.testo).toContain(scheda.abitante_telefono ?? "");
      expect(email.testo).toContain(scheda.luogo_esatto ?? "");
      expect(email.testo).toContain(scheda.abitante_cognome ?? "");
      // Più la riga che dice chi l'ha iscritta e a chi scrivere (§15.9).
      expect(email.testo).toContain("non tu");

      // Una sola, e a nessun altro.
      expect(await nessunaEmailOltre(subentrante.email, prima + 1)).toBe(0);
      expect(await contaEmail(admin.email)).toBe(0);
    });

    it("l'annullamento fatto dall'amministratore manda esattamente un'email, con il motivo se c'è", async () => {
      const prima = await contaEmail(partecipante.email);
      expect(
        await avvisaAnnullamentoDaAmministratore(
          partecipante.id,
          scheda,
          "si è liberato un posto per chi era in lista da prima",
        ),
      ).toMatchObject({ ok: true });

      const email = await attendiEmail(partecipante.email, prima);
      expect(email.testo).toContain("si è liberato un posto");
      expect(email.testo.toLowerCase()).toContain("annullata");
      expect(await nessunaEmailOltre(partecipante.email, prima + 1)).toBe(0);
    });

    it("nessuna email porta l'indirizzo di un'altra persona (rule 4)", async () => {
      const email = await attendiEmail(partecipante.email);
      for (const altro of [admin, subentrante, estraneo]) {
        expect(email.testo).not.toContain(altro.email);
      }
      // Nemmeno il proprio: a chi legge non serve, e ripeterlo lo mette in un
      // testo che può essere inoltrato.
      expect(email.testo).not.toContain(partecipante.email);
    });
  });

  // -------------------------------------------------------------------------
  // L'elenco degli iscritti, e cosa si passa al proponente — §15.9
  // -------------------------------------------------------------------------

  describe("l'elenco degli iscritti (§15.9)", () => {
    let attivita: string;
    let conNome: UtenteTest;
    let senzaNome: UtenteTest;

    beforeAll(async () => {
      [conNome, senzaNome] = [subentrante, partecipante];
      await servizio()
        .from("utenti")
        .update({ nome_pubblico: "Ambrogio", mostra_nome_pubblico: true })
        .eq("id", conNome.id);
      // Un nome scritto ma con l'interruttore spento: non deve uscire (rule 3).
      await servizio()
        .from("utenti")
        .update({ nome_pubblico: "Berenice", mostra_nome_pubblico: false })
        .eq("id", senzaNome.id);

      attivita = await creaAttivita({ edizione_id: edizione, capienza: 5 });
      await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: conNome.id });
      await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: senzaNome.id,
        posto_progressivo: 2,
      });
    });

    it("porta l'indirizzo email di ciascuno, che è il solo recapito che l'app conosce", async () => {
      const elenco = await iscrittiAttivita(admin.client, attivita);
      expect(elenco.length).toBe(2);
      expect(elenco.map((i) => i.email).sort()).toEqual(
        [conNome.email, senzaNome.email].sort(),
      );
    });

    it("porta il nome pubblico solo di chi ha acceso l'interruttore (rule 3)", async () => {
      const elenco = await iscrittiAttivita(admin.client, attivita);
      const nomi = elenco.map((i) => i.nomePubblico);
      expect(nomi).toContain("Ambrogio");
      expect(nomi).not.toContain("Berenice");
    });

    it("non porta nessuno dei cinque campi facoltativi, e nessun posto_progressivo (rules 15, 16)", async () => {
      const { data } = await admin.client
        .from("iscritti_amministrazione")
        .select("*")
        .eq("attivita_id", attivita);
      const colonne = Object.keys(data?.[0] ?? {});
      for (const vietata of [
        "eta",
        "genere",
        "professione",
        "motivo_visita",
        "residenza",
        "posto_progressivo",
        "stat_eta",
        "stat_genere",
        "stat_professione",
        "stat_motivo_visita",
        "stat_residenza",
      ]) {
        expect(colonne).not.toContain(vietata);
      }
    });

    it("non lo legge nessuno che non sia amministratore", async () => {
      for (const chi of [partecipante, subentrante, estraneo]) {
        const { data } = await chi.client.from("iscritti_amministrazione").select("*");
        expect(data ?? []).toEqual([]);
      }
      const { data: anonimo } = await visitatore().from("iscritti_amministrazione").select("*");
      expect(anonimo ?? []).toEqual([]);
    });

    it("sparisce il giorno dopo l'attività, e il giorno dell'attività c'è ancora", async () => {
      // Un'edizione passata, spenta, per datare le attività all'indietro:
      // §15.3.2 rifiuta una data fuori dall'edizione.
      const passata = await creaEdizione({
        attiva: false,
        data_inizio: aggiungiGiorni(oggiRoma(), -20),
        data_fine: aggiungiGiorni(oggiRoma(), -1),
      });
      edizioni.push(passata);

      const ieri = await creaAttivita({
        edizione_id: passata,
        capienza: 3,
        data: aggiungiGiorni(oggiRoma(), -1),
      });
      const altroIeri = await creaAttivita({
        edizione_id: passata,
        capienza: 3,
        data: aggiungiGiorni(oggiRoma(), -2),
      });
      await inserisciIscrizioneDiretta({ attivita_id: ieri, utente_id: conNome.id });
      await inserisciIscrizioneDiretta({ attivita_id: altroIeri, utente_id: conNome.id });

      // Ieri: l'attività è passata, ma siamo nel giorno successivo.
      expect((await iscrittiAttivita(admin.client, ieri)).length).toBe(1);
      // L'altro ieri: il giorno successivo è già passato anche lui.
      expect((await iscrittiAttivita(admin.client, altroIeri)).length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Quello che si passa al proponente — §15.9, con la formula di §6.6
  // -------------------------------------------------------------------------

  describe("quello che si passa al proponente (§15.9)", () => {
    it("dice quante persone vengono e i nomi di chi ne ha lasciato uno, e nessun indirizzo", () => {
      const iscritti = [
        { stato: "ATTIVA" as const, nomePubblico: "Luca" },
        { stato: "ATTIVA" as const, nomePubblico: "Anna" },
        { stato: "ATTIVA" as const, nomePubblico: null },
        { stato: "ANNULLATA" as const, nomePubblico: "Ugo" },
      ].map((p, n) => ({
        id: `i${n}`,
        utenteId: `u${n}`,
        email: `persona${n}@example.com`,
        nomePubblico: p.nomePubblico,
        stato: p.stato,
        perContoDiAltri: false,
        annullataDaAltri: false,
      }));

      const frase = frasePerProponente(iscritti, "2026-09-26");

      // Tre vengono: chi ha annullato non viene contato, perché non viene.
      expect(frase).toContain("in tre");
      expect(frase).toContain("Anna, Luca");
      expect(frase).not.toContain("Ugo");
      for (const i of iscritti) expect(frase).not.toContain(i.email);
      for (const i of iscritti) expect(frase).not.toContain(i.utenteId);
    });

    it("con nessun nome pubblico resta solo il numero", () => {
      const frase = frasePerProponente(
        [
          {
            id: "i",
            utenteId: "u",
            email: "persona@example.com",
            nomePubblico: null,
            stato: "ATTIVA",
            perContoDiAltri: false,
            annullataDaAltri: false,
          },
        ],
        "2026-09-26",
      );
      expect(frase).toContain("una persona");
      expect(frase).not.toContain("lasciato il nome");
    });

    it("una scheda senza data ha comunque una frase da consegnare (§15.3.2)", () => {
      expect(frasePerProponente([], null)).toContain("questa attività");
    });

    it("scrive i numeri in lettere, come la formula di §15.9", () => {
      const gruppo = (quanti: number) =>
        Array.from({ length: quanti }, (_, n) => ({
          id: `i${n}`,
          utenteId: `u${n}`,
          email: `persona${n}@example.com`,
          nomePubblico: null,
          stato: "ATTIVA" as const,
          perContoDiAltri: false,
          annullataDaAltri: false,
        }));

      expect(frasePerProponente(gruppo(8), "2026-09-26")).toContain("in otto");
      // Le decine perdono la vocale davanti a uno e otto: ventuno, quarantotto.
      expect(frasePerProponente(gruppo(21), "2026-09-26")).toContain("in ventuno");
      expect(frasePerProponente(gruppo(48), "2026-09-26")).toContain("in quarantotto");
      expect(frasePerProponente(gruppo(30), "2026-09-26")).toContain("in trenta");
    });
  });
});
