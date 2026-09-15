/**
 * SPEC §6.7 — pannello di amministrazione, e le regole che lo tengono
 * onesto: §6.5 livello 3 (azzeramento del nome pubblico), §8.2 e §8.4
 * (nessuna cancellazione automatica di una prenotazione altrui).
 *
 * Tre cose sono verificate qui più di ogni altra:
 *  - chi non è amministratore non raggiunge niente, nemmeno per errore;
 *  - la schermata di moderazione non porta nessun indirizzo email;
 *  - un cambiamento che lascia fuori una prenotazione la mostra e basta:
 *    non la annulla mai (CLAUDE.md regola 6).
 *
 * Nessun indirizzo email viene stampato (CLAUDE.md regola 4).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, giornoSettimana, oggiRoma } from "@/lib/dates";
import {
  abilitaUtente,
  generaCodici,
  revocaAbilitazione,
  revocaCodice,
} from "@/lib/db/abitanti";
import {
  aggiornaSede,
  aggiungiTermine,
  assegnaReferente,
  azzeraNomePubblico,
  cercaUtentePerEmail,
  chiusureSede,
  creaChiusura,
  creaPeriodo,
  creaSede,
  eliminaChiusura,
  eliminaPeriodo,
  eliminaSede,
  GIORNI_SETTIMANA,
  incarichiAttivi,
  iscrizioniDaVerificare,
  nomeInModerazione,
  nomiInModerazione,
  periodiSede,
  prenotazioniDaVerificare,
  registroModerazioni,
  revocaIncarico,
  rimuoviTermine,
  sedeSingola,
  sediTutte,
  terminiVietati,
} from "@/lib/db/amministrazione";
import { impostaNomePubblico, mioProfilo, segnaAvvisoModerazioneLetto } from "@/lib/db/utenti";
import { posizioneDaColonna } from "@/lib/mappa";
import {
  assegnaIncarico,
  CODICE_PERMESSO_NEGATO,
  creaAttivita,
  creaEdizione,
  creaSede as creaSedeDiProva,
  creaUtente,
  inserisciIscrizioneDiretta,
  inserisciPrenotazioneDiretta,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const OGGI = oggiRoma();
/** Una sede di prova aperta tutti i giorni: così l'esito non dipende da che giorno è. */
const SEMPRE_APERTA = [...GIORNI_SETTIMANA];

/** Tutto ciò che il pannello legge, diviso come lo divide il client tipizzato. */
const TABELLE = ["moderazioni", "termini_vietati"] as const;
/**
 * Le viste del pannello. Le ultime tre sono la sezione «Prenota un abitante»
 * aggiunta dai passi 15 e 20 (§15.9, §15.12): stanno accanto alle altre e
 * passano dalla stessa porta, quindi vale la stessa asserzione senza
 * toglierne nessuna.
 */
const VISTE = [
  "nomi_pubblici_moderazione",
  "prenotazioni_da_verificare",
  "codici_amministrazione",
  "abilitazioni_amministrazione",
  "iscrizioni_da_verificare",
] as const;

describe("§6.7 pannello di amministrazione", () => {
  const anon = visitatore();
  let admin: UtenteTest;
  let utente: UtenteTest;
  const sediDaPulire: string[] = [];
  const edizioniDaPulire: string[] = [];

  async function sedeDiProva(capienza = 1): Promise<string> {
    const id = await creaSedeDiProva({ capienza, giorni_apertura: SEMPRE_APERTA });
    sediDaPulire.push(id);
    return id;
  }

  beforeAll(async () => {
    [admin, utente] = await Promise.all([creaUtente(), creaUtente()]);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
  });

  afterAll(async () => {
    await pulisci({ utenti: [admin, utente], sedi: sediDaPulire, edizioni: edizioniDaPulire });
  });

  // -------------------------------------------------------------------------
  // La porta: §4, §6.7
  // -------------------------------------------------------------------------

  describe("chi non è amministratore non entra", () => {
    it("il visitatore non ha nemmeno il permesso sulle tabelle e sulle viste del pannello", async () => {
      for (const tabella of TABELLE) {
        const { error } = await anon.from(tabella).select("*");
        expect(error?.code, tabella).toBe(CODICE_PERMESSO_NEGATO);
      }
      for (const vista of VISTE) {
        const { error } = await anon.from(vista).select("*");
        expect(error?.code, vista).toBe(CODICE_PERMESSO_NEGATO);
      }
    });

    it("un utente registrato ha il permesso ma non vede nessuna riga", async () => {
      for (const tabella of TABELLE) {
        const { data, error } = await utente.client.from(tabella).select("*");
        expect(error, tabella).toBeNull();
        expect(data, tabella).toEqual([]);
      }
      for (const vista of VISTE) {
        const { data, error } = await utente.client.from(vista).select("*");
        expect(error, vista).toBeNull();
        expect(data, vista).toEqual([]);
      }
    });

    it("un utente registrato non crea sedi, periodi, chiusure o incarichi", async () => {
      const sedeId = await sedeDiProva();
      expect(await creaSede(utente.client, { nome: "Abusiva", comune: "X", capienza: 2 })).toMatchObject({
        ok: false,
      });
      expect(
        await creaPeriodo(utente.client, {
          sede_id: sedeId,
          data_inizio: OGGI,
          data_fine: OGGI,
          etichetta: "Abusivo",
          ricorre_ogni_anno: false,
        }),
      ).toMatchObject({ ok: false });
      expect(
        await creaChiusura(utente.client, {
          sede_id: sedeId,
          data_inizio: OGGI,
          data_fine: OGGI,
          fascia: null,
          creata_da: utente.id,
        }),
      ).toMatchObject({ ok: false });
      expect(await assegnaReferente(utente.client, utente.id, sedeId)).toMatchObject({ ok: false });
    });

    it("un utente registrato non tocca niente della sezione «Prenota un abitante»", async () => {
      // §15.9, passo 15. La sezione nuova è irraggiungibile come tutto il
      // resto del pannello: le tre funzioni rifiutano, e le due viste sono
      // già nell'elenco qui sopra.
      const edizione = await creaEdizione({ nome: "Non tua", attiva: false });
      edizioniDaPulire.push(edizione);

      expect(await generaCodici(utente.client, edizione, 1, "chiave-di-prova")).toMatchObject({
        ok: false,
      });
      expect(await abilitaUtente(utente.client, utente.id)).toMatchObject({ ok: false });
      expect(
        await revocaAbilitazione(utente.client, "00000000-0000-0000-0000-000000000000"),
      ).toMatchObject({ ok: false });
      expect(
        await revocaCodice(utente.client, "00000000-0000-0000-0000-000000000000"),
      ).toMatchObject({ ok: false });

      const { count } = await servizio()
        .from("codici_invito")
        .select("id", { count: "exact", head: true })
        .eq("edizione_id", edizione);
      expect(count).toBe(0);
    });

    it("un utente registrato non azzera il nome pubblico di nessuno", async () => {
      const chi = await creaUtente();
      await impostaNomePubblico(chi.client, { nome: "Rita Prova", mostra: true });

      const esito = await azzeraNomePubblico(utente.client, chi.id);
      expect(esito).toMatchObject({ ok: false, motivo: "NON_AUTORIZZATO" });

      const { data } = await mioProfilo(chi.client, chi.id);
      expect(data?.nome_pubblico).toBe("Rita Prova");
      await pulisci({ utenti: [chi] });
    });
  });

  // -------------------------------------------------------------------------
  // Sedi: §6.7 prima voce, §5.2
  // -------------------------------------------------------------------------

  describe("gestione delle sedi", () => {
    it("l'amministratore aggiunge una sede, la modifica e la elimina", async () => {
      const creata = await creaSede(admin.client, {
        nome: "Sede nuova di prova",
        comune: "Ronco Canavese",
        capienza: 3,
      });
      expect(creata.ok).toBe(true);
      if (!creata.ok) return;

      // I valori non chiesti nel modulo arrivano dai valori predefiniti di
      // §5.2, che stanno nel database e in nessun altro posto.
      const appena = await sedeSingola(admin.client, creata.valore);
      expect(appena?.attiva).toBe(true);
      expect(appena?.sempre_disponibile).toBe(true);
      expect(appena?.giorni_apertura).toEqual(["LUN", "MAR", "MER", "GIO", "VEN", "SAB"]);
      expect(appena?.ora_inizio_mattina).toBe("09:00:00");

      expect(
        await aggiornaSede(admin.client, creata.valore, {
          capienza: 5,
          attiva: false,
          giorni_apertura: ["LUN", "MAR"],
          note: "Le chiavi sono al bar.",
          coordinate: "(7.5512,45.5123)",
        }),
      ).toMatchObject({ ok: true });

      const dopo = await sedeSingola(admin.client, creata.valore);
      expect(dopo?.capienza).toBe(5);
      expect(dopo?.attiva).toBe(false);
      expect(dopo?.giorni_apertura).toEqual(["LUN", "MAR"]);
      // D26: le informazioni della sede si scrivono e si rileggono solo qui.
      expect(dopo?.note).toBe("Le chiavi sono al bar.");
      expect(posizioneDaColonna(dopo?.coordinate)).toEqual({
        latitudine: 45.5123,
        longitudine: 7.5512,
      });

      // Una sede sospesa resta visibile all'amministratore e a nessun altro.
      expect((await sediTutte(admin.client)).some((s) => s.id === creata.valore)).toBe(true);
      expect((await sediTutte(utente.client)).some((s) => s.id === creata.valore)).toBe(false);

      expect(await eliminaSede(admin.client, creata.valore)).toMatchObject({ ok: true });
      expect(await sedeSingola(admin.client, creata.valore)).toBeNull();
    });

    it("una sede con prenotazioni non si elimina: si sospende", async () => {
      const sedeId = await sedeDiProva();
      await inserisciPrenotazioneDiretta({
        utente_id: utente.id,
        sede_id: sedeId,
        data: OGGI,
        fascia: "MATTINA",
      });

      expect(await eliminaSede(admin.client, sedeId)).toMatchObject({
        ok: false,
        motivo: "HA_PRENOTAZIONI",
      });
      expect(await sedeSingola(admin.client, sedeId)).not.toBeNull();

      // La strada che resta è l'interruttore, e non tocca la prenotazione.
      expect(await aggiornaSede(admin.client, sedeId, { attiva: false })).toMatchObject({ ok: true });
      const { data } = await servizio()
        .from("prenotazioni")
        .select("stato")
        .eq("sede_id", sedeId);
      expect(data?.every((r) => r.stato === "ATTIVA")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Periodi e chiusure: §5.7, §5.4, §6.7
  // -------------------------------------------------------------------------

  describe("periodi di attività e chiusure", () => {
    it("l'amministratore aggiunge e toglie un periodo, e la sede compare e scompare", async () => {
      const sedeId = await sedeDiProva();
      await aggiornaSede(admin.client, sedeId, { sempre_disponibile: false });

      // Senza periodi la sede non è prenotabile in nessun giorno (§5.7).
      const prima = await servizio().rpc("sede_prenotabile", {
        p_sede_id: sedeId,
        p_data: OGGI,
        p_fascia: "MATTINA",
      });
      expect(prima.data).toBe(false);

      expect(
        await creaPeriodo(admin.client, {
          sede_id: sedeId,
          data_inizio: OGGI,
          data_fine: OGGI,
          etichetta: "Periodo del pannello",
          ricorre_ogni_anno: false,
        }),
      ).toMatchObject({ ok: true });

      const periodi = await periodiSede(admin.client, sedeId);
      expect(periodi).toHaveLength(1);
      const dopo = await servizio().rpc("sede_prenotabile", {
        p_sede_id: sedeId,
        p_data: OGGI,
        p_fascia: "MATTINA",
      });
      expect(dopo.data).toBe(true);

      expect(await eliminaPeriodo(admin.client, periodi[0].id)).toMatchObject({ ok: true });
      expect(await periodiSede(admin.client, sedeId)).toEqual([]);
    });

    it("una chiusura su una fascia sola chiude quella e lascia aperta l'altra", async () => {
      const sedeId = await sedeDiProva();
      expect(
        await creaChiusura(admin.client, {
          sede_id: sedeId,
          data_inizio: OGGI,
          data_fine: OGGI,
          fascia: "MATTINA",
          creata_da: admin.id,
        }),
      ).toMatchObject({ ok: true });

      const mattina = await servizio().rpc("sede_prenotabile", {
        p_sede_id: sedeId,
        p_data: OGGI,
        p_fascia: "MATTINA",
      });
      const pomeriggio = await servizio().rpc("sede_prenotabile", {
        p_sede_id: sedeId,
        p_data: OGGI,
        p_fascia: "POMERIGGIO",
      });
      expect(mattina.data).toBe(false);
      expect(pomeriggio.data).toBe(true);

      const chiusure = await chiusureSede(admin.client, sedeId);
      expect(chiusure).toHaveLength(1);
      expect(await eliminaChiusura(admin.client, chiusure[0].id)).toMatchObject({ ok: true });
      expect(await chiusureSede(admin.client, sedeId)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Incarichi: §5.6, §6.7
  // -------------------------------------------------------------------------

  describe("incarichi", () => {
    it("assegna e revoca un referente, che vede solo la sua sede", async () => {
      const sedeId = await sedeDiProva();
      const referente = await creaUtente();
      await inserisciPrenotazioneDiretta({
        utente_id: utente.id,
        sede_id: sedeId,
        data: OGGI,
        fascia: "POMERIGGIO",
      });

      const trovato = await cercaUtentePerEmail(admin.client, referente.email);
      expect(trovato).toMatchObject({ ok: true });
      if (!trovato.ok) return;
      expect(trovato.valore.id).toBe(referente.id);

      expect(await assegnaReferente(admin.client, referente.id, sedeId)).toMatchObject({ ok: true });
      // Un secondo incarico uguale non si aggiunge due volte.
      expect(await assegnaReferente(admin.client, referente.id, sedeId)).toMatchObject({
        ok: false,
        motivo: "GIA_PRESENTE",
      });

      const suo = await referente.client
        .from("prenotazioni_referente")
        .select("sede_id")
        .eq("sede_id", sedeId);
      expect(suo.data).toHaveLength(1);

      const elencati = await incarichiAttivi(admin.client);
      const mio = elencati.find((i) => i.utenteId === referente.id);
      expect(mio?.ruolo).toBe("REFERENTE");
      expect(mio?.sedeId).toBe(sedeId);
      expect(mio?.email).toBe(referente.email);

      expect(await revocaIncarico(admin.client, mio!.id)).toMatchObject({ ok: true });
      const dopo = await referente.client.from("prenotazioni_referente").select("sede_id");
      expect(dopo.data).toEqual([]);

      await pulisci({ utenti: [referente] });
    });

    it("un indirizzo che non appartiene a nessuno non assegna niente", async () => {
      const esito = await cercaUtentePerEmail(admin.client, "nessuno-di-nessuno@example.com");
      expect(esito).toMatchObject({ ok: false, motivo: "UTENTE_INESISTENTE" });
    });
  });

  // -------------------------------------------------------------------------
  // Termini vietati: §6.5 livello 1, §6.7
  // -------------------------------------------------------------------------

  describe("elenco dei termini vietati", () => {
    const TERMINE = "termine-del-pannello";

    afterAll(async () => {
      await servizio().from("termini_vietati").delete().eq("termine", TERMINE);
    });

    it("l'amministratore aggiunge, non duplica e rimuove", async () => {
      expect(await aggiungiTermine(admin.client, TERMINE, admin.id)).toMatchObject({ ok: true });
      expect(await aggiungiTermine(admin.client, TERMINE, admin.id)).toMatchObject({
        ok: false,
        motivo: "GIA_PRESENTE",
      });

      const elenco = await terminiVietati(admin.client);
      const voce = elenco.find((t) => t.termine === TERMINE);
      expect(voce).toBeDefined();
      // L'elenco non lo vede nessun altro: conoscerlo è sapere come aggirarlo.
      expect(await terminiVietati(utente.client)).toEqual([]);

      expect(await rimuoviTermine(admin.client, voce!.id)).toMatchObject({ ok: true });
      expect((await terminiVietati(admin.client)).some((t) => t.termine === TERMINE)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Moderazione: §6.5 livello 3, §6.7
  // -------------------------------------------------------------------------

  describe("moderazione dei nomi pubblici", () => {
    it("la schermata di moderazione non porta nessun indirizzo email", async () => {
      const chi = await creaUtente();
      await impostaNomePubblico(chi.client, { nome: "Senza Indirizzo", mostra: true });

      const { data } = await admin.client
        .from("nomi_pubblici_moderazione")
        .select("*")
        .eq("id", chi.id)
        .single();
      expect(data).not.toBeNull();
      expect(data).not.toHaveProperty("email");
      for (const campo of ["eta", "genere", "professione", "motivo_visita", "residenza"]) {
        expect(data, campo).not.toHaveProperty(campo);
      }

      // Nemmeno chiedendola per nome: la colonna non esiste nella vista.
      const chiesta = await admin.client.from("nomi_pubblici_moderazione").select("email");
      expect(chiesta.error).not.toBeNull();

      await pulisci({ utenti: [chi] });
    });

    it("azzera il nome, spegne la spunta, registra, avvisa e non tocca le prenotazioni", async () => {
      const sedeId = await sedeDiProva(2);
      const chi = await creaUtente();
      await impostaNomePubblico(chi.client, { nome: "Nome Da Rimuovere", mostra: true });
      const prenotazione = await inserisciPrenotazioneDiretta({
        utente_id: chi.id,
        sede_id: sedeId,
        data: OGGI,
        fascia: "MATTINA",
      });

      const scheda = await nomeInModerazione(admin.client, chi.id);
      expect(scheda?.nomePubblico).toBe("Nome Da Rimuovere");
      expect(scheda?.mostra).toBe(true);

      const esito = await azzeraNomePubblico(admin.client, chi.id);
      expect(esito).toMatchObject({ ok: true, valore: "Nome Da Rimuovere" });

      const { data: profilo } = await mioProfilo(chi.client, chi.id);
      expect(profilo?.nome_pubblico).toBeNull();
      expect(profilo?.mostra_nome_pubblico).toBe(false);
      // L'avviso di §6.5: la persona lo legge nelle impostazioni.
      expect(profilo?.avviso_moderazione).not.toBeNull();

      const registro = await registroModerazioni(admin.client);
      const riga = registro.find((r) => r.utenteId === chi.id);
      expect(riga?.nomeRimosso).toBe("Nome Da Rimuovere");

      // §6.5: "L'azzeramento non cancella le prenotazioni."
      const { data: dopo } = await servizio()
        .from("prenotazioni")
        .select("stato")
        .eq("id", prenotazione)
        .single();
      expect(dopo?.stato).toBe("ATTIVA");

      // E il nome sparisce subito da chi lo leggeva.
      const { data: pubbliche } = await visitatore()
        .from("presenze_pubbliche")
        .select("nome_pubblico")
        .eq("sede_id", sedeId);
      expect(pubbliche).toEqual([]);

      // Una seconda volta non c'è più niente da rimuovere.
      expect(await azzeraNomePubblico(admin.client, chi.id)).toMatchObject({
        ok: false,
        motivo: "NESSUN_NOME",
      });
      expect(await nomeInModerazione(admin.client, chi.id)).toBeNull();

      await pulisci({ utenti: [chi] });
    });

    it("l'avviso lo chiude solo la persona a cui è rivolto", async () => {
      const chi = await creaUtente();
      await impostaNomePubblico(chi.client, { nome: "Altro Nome", mostra: true });
      await azzeraNomePubblico(admin.client, chi.id);

      // Nessun altro può spegnere l'avviso di qualcun altro.
      const altrui = await segnaAvvisoModerazioneLetto(utente.client, chi.id);
      expect(altrui.error).not.toBeNull();
      const { data: ancora } = await mioProfilo(chi.client, chi.id);
      expect(ancora?.avviso_moderazione).not.toBeNull();

      const proprio = await segnaAvvisoModerazioneLetto(chi.client, chi.id);
      expect(proprio.error).toBeNull();
      const { data: pulito } = await mioProfilo(chi.client, chi.id);
      expect(pulito?.avviso_moderazione).toBeNull();

      await pulisci({ utenti: [chi] });
    });

    it("l'elenco dei nomi in uso porta i nomi pubblici e nessun altro dato", async () => {
      const chi = await creaUtente();
      await impostaNomePubblico(chi.client, { nome: "In Elenco", mostra: true });

      const nomi = await nomiInModerazione(admin.client);
      const voce = nomi.find((n) => n.utenteId === chi.id);
      expect(voce?.nomePubblico).toBe("In Elenco");
      expect(Object.keys(voce ?? {})).toEqual([
        "utenteId",
        "nomePubblico",
        "mostra",
        "avvisoInAttesa",
      ]);

      await pulisci({ utenti: [chi] });
    });
  });

  // -------------------------------------------------------------------------
  // Prenotazioni da controllare: §8.2, §8.4 — e mai un annullamento
  // -------------------------------------------------------------------------

  describe("prenotazioni lasciate fuori da un cambiamento", () => {
    /** Il cuore della regola 6: dopo ogni prova la prenotazione è ancora attiva. */
    async function ancoraAttiva(prenotazioneId: string): Promise<void> {
      const { data } = await servizio()
        .from("prenotazioni")
        .select("stato")
        .eq("id", prenotazioneId)
        .single();
      expect(data?.stato).toBe("ATTIVA");
    }

    it("una capienza abbassata sotto i prenotati", async () => {
      const sedeId = await sedeDiProva(1);
      const chi = await creaUtente();
      const prenotazione = await inserisciPrenotazioneDiretta({
        utente_id: chi.id,
        sede_id: sedeId,
        data: OGGI,
        fascia: "MATTINA",
      });

      expect(await prenotazioniDaVerificare(admin.client, sedeId)).toEqual([]);

      await aggiornaSede(admin.client, sedeId, { capienza: 0 });
      const elenco = await prenotazioniDaVerificare(admin.client, sedeId);
      expect(elenco).toHaveLength(1);
      expect(elenco[0]).toMatchObject({ motivo: "CAPIENZA_RIDOTTA", data: OGGI, fascia: "MATTINA" });
      // §8.4: "l'elenco delle persone da avvisare".
      expect(elenco[0].email).toBe(chi.email);

      await ancoraAttiva(prenotazione);
      await pulisci({ utenti: [chi] });
    });

    it("una chiusura inserita su un giorno già prenotato", async () => {
      const sedeId = await sedeDiProva(4);
      const chi = await creaUtente();
      const prenotazione = await inserisciPrenotazioneDiretta({
        utente_id: chi.id,
        sede_id: sedeId,
        data: OGGI,
        fascia: "POMERIGGIO",
      });

      await creaChiusura(admin.client, {
        sede_id: sedeId,
        data_inizio: OGGI,
        data_fine: OGGI,
        fascia: "POMERIGGIO",
        creata_da: admin.id,
      });

      const elenco = await prenotazioniDaVerificare(admin.client, sedeId);
      expect(elenco).toHaveLength(1);
      expect(elenco[0].motivo).toBe("CHIUSURA");

      await ancoraAttiva(prenotazione);
      await pulisci({ utenti: [chi] });
    });

    it("una sede sospesa, e un giorno della settimana tolto dalle aperture", async () => {
      const sedeId = await sedeDiProva(4);
      const chi = await creaUtente();
      const prenotazione = await inserisciPrenotazioneDiretta({
        utente_id: chi.id,
        sede_id: sedeId,
        data: OGGI,
        fascia: "MATTINA",
      });

      const oggiSettimana = GIORNI_SETTIMANA[giornoSettimana(OGGI) - 1];
      await aggiornaSede(admin.client, sedeId, {
        giorni_apertura: GIORNI_SETTIMANA.filter((g) => g !== oggiSettimana),
      });
      expect((await prenotazioniDaVerificare(admin.client, sedeId))[0]?.motivo).toBe("GIORNO_CHIUSO");

      // Sospesa vince su tutto: è la ragione più urgente da leggere.
      await aggiornaSede(admin.client, sedeId, { attiva: false });
      expect((await prenotazioniDaVerificare(admin.client, sedeId))[0]?.motivo).toBe("SEDE_SOSPESA");

      await ancoraAttiva(prenotazione);
      await pulisci({ utenti: [chi] });
    });

    it("l'elenco non lo vede nessuno che non sia amministratore", async () => {
      const sedeId = await sedeDiProva(1);
      const chi = await creaUtente();
      await inserisciPrenotazioneDiretta({
        utente_id: chi.id,
        sede_id: sedeId,
        data: OGGI,
        fascia: "MATTINA",
      });
      await aggiornaSede(admin.client, sedeId, { capienza: 0 });

      expect(await prenotazioniDaVerificare(utente.client, sedeId)).toEqual([]);
      // Nemmeno la persona che quella prenotazione ce l'ha.
      expect(await prenotazioniDaVerificare(chi.client, sedeId)).toEqual([]);

      await pulisci({ utenti: [chi] });
    });
  });

  // -------------------------------------------------------------------------
  // Iscrizioni da controllare: §6.7, §15.12 — lo stesso elenco, la stessa
  // regola. Il sistema mostra, decide una persona, e non annulla mai niente
  // da solo (regola 6).
  // -------------------------------------------------------------------------

  describe("iscrizioni lasciate fuori da un cambiamento", () => {
    let edizione: string;
    let iscritto: UtenteTest;

    /** Il cuore della regola 6, per le iscrizioni: dopo ogni prova è ancora attiva. */
    async function ancoraAttiva(iscrizioneId: string): Promise<void> {
      const { data } = await servizio()
        .from("iscrizioni")
        .select("stato")
        .eq("id", iscrizioneId)
        .single();
      expect(data?.stato).toBe("ATTIVA");
    }

    beforeAll(async () => {
      // Comincia dieci giorni fa: serve anche un'attività già passata, e la
      // data di un'attività deve stare dentro l'edizione (§15.12).
      edizione = await creaEdizione({ data_inizio: aggiungiGiorni(OGGI, -10) });
      edizioniDaPulire.push(edizione);
      iscritto = await creaUtente();
    });

    afterAll(async () => {
      await pulisci({ utenti: [iscritto] });
    });

    it("una capienza abbassata sotto gli iscritti", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione, capienza: 2, data: OGGI });
      const iscrizione = await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: iscritto.id,
        posto_progressivo: 2,
      });

      expect(await iscrizioniDaVerificare(admin.client)).toEqual([]);

      await servizio().from("attivita").update({ capienza: 1 }).eq("id", attivita);

      const elenco = (await iscrizioniDaVerificare(admin.client)).filter(
        (r) => r.attivitaId === attivita,
      );
      expect(elenco).toHaveLength(1);
      expect(elenco[0].motivo).toBe("CAPIENZA_RIDOTTA");
      expect(elenco[0].data).toBe(OGGI);
      // §8.4, come per le prenotazioni: «l'elenco delle persone da avvisare».
      expect(elenco[0].email).toBe(iscritto.email);

      await ancoraAttiva(iscrizione);
    });

    it("un'attività tornata in bozza perché il consenso è stato tolto", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione, capienza: 4, data: OGGI });
      const iscrizione = await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: iscritto.id,
      });

      await servizio()
        .from("attivita")
        .update({
          stato: "BOZZA",
          consenso_raccolto: false,
          consenso_modalita: null,
          consenso_raccolto_il: null,
        })
        .eq("id", attivita);

      const elenco = (await iscrizioniDaVerificare(admin.client)).filter(
        (r) => r.attivitaId === attivita,
      );
      expect(elenco).toHaveLength(1);
      expect(elenco[0].motivo).toBe("ATTIVITA_RITIRATA");

      // §15.12: «Gli iscritti restano e vanno avvisati a mano».
      await ancoraAttiva(iscrizione);
    });

    it("un'attività a posto non compare, e nemmeno una già passata", async () => {
      const aPosto = await creaAttivita({ edizione_id: edizione, capienza: 4, data: OGGI });
      await inserisciIscrizioneDiretta({ attivita_id: aPosto, utente_id: iscritto.id });

      const passata = await creaAttivita({
        edizione_id: edizione,
        capienza: 4,
        data: aggiungiGiorni(OGGI, -1),
      });
      await inserisciIscrizioneDiretta({
        attivita_id: passata,
        utente_id: iscritto.id,
        posto_progressivo: 4,
      });
      await servizio().from("attivita").update({ capienza: 1 }).eq("id", passata);

      const elenco = await iscrizioniDaVerificare(admin.client);
      expect(elenco.map((r) => r.attivitaId)).not.toContain(aPosto);
      expect(elenco.map((r) => r.attivitaId)).not.toContain(passata);
    });

    it("un'iscrizione annullata esce dall'elenco", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione, capienza: 2, data: OGGI });
      const iscrizione = await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: iscritto.id,
        posto_progressivo: 2,
      });
      await servizio().from("attivita").update({ capienza: 1 }).eq("id", attivita);
      expect(
        (await iscrizioniDaVerificare(admin.client)).filter((r) => r.attivitaId === attivita),
      ).toHaveLength(1);

      await servizio()
        .from("iscrizioni")
        .update({ stato: "ANNULLATA", annullata_il: new Date().toISOString() })
        .eq("id", iscrizione);

      expect(
        (await iscrizioniDaVerificare(admin.client)).filter((r) => r.attivitaId === attivita),
      ).toEqual([]);
    });

    it("l'elenco non lo vede nessuno che non sia amministratore", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione, capienza: 2, data: OGGI });
      await inserisciIscrizioneDiretta({
        attivita_id: attivita,
        utente_id: iscritto.id,
        posto_progressivo: 2,
      });
      await servizio().from("attivita").update({ capienza: 1 }).eq("id", attivita);

      expect(await iscrizioniDaVerificare(utente.client)).toEqual([]);
      // Nemmeno la persona che quell'iscrizione ce l'ha.
      expect(await iscrizioniDaVerificare(iscritto.client)).toEqual([]);
    });
  });
});
