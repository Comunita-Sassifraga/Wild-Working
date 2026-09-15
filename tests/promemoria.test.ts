/**
 * SPEC §6.3 — il promemoria della sera prima (decisione del 10/09: la
 * prenotazione non manda più una conferma, manda un promemoria) — e, dal
 * passo 19, SPEC §15.10: il secondo elenco che il giro notturno acquisisce
 * senza diventare una seconda esecuzione, e le altre email del modulo.
 *
 * Il file ha tre parti, e la prima non si tocca: quello che il promemoria
 * delle postazioni fa oggi deve continuare a farlo identico, perché è già in
 * esercizio ed è la cosa che §15.14 indica come rompibile dal passo 19. Le
 * due parti nuove stanno sotto, non dentro.
 *
 * Le regole verificate qui sono quattro, e sono tutte regole di sostanza:
 * una sola email a persona anche con più prenotazioni; niente per una
 * prenotazione annullata; mai due volte; e niente a chi prenota dopo che il
 * giro di quel giorno è già passato.
 *
 * Le asserzioni contano le email di una persona sola, mai quelle del giro
 * intero: il mestiere lavora su tutta la banca dati, e quante prenotazioni
 * trovi dipende da cosa hanno lasciato gli altri file.
 *
 * Le email vanno in Mailpit (vitest.config.mts impone POSTA_LOCALE): nessun
 * indirizzo raggiunge una casella vera, e nessuno viene stampato (regola 4).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EMAIL_ASSISTENZA_ABITANTI } from "@/config/limits";
import { aggiungiGiorni, dataEstesa, oggiRoma } from "@/lib/dates";
import { annullaAttivita, attivitaSingola } from "@/lib/db/attivita";
import { m } from "@/lib/messaggi";
import {
  avvisaAttivitaAnnullata,
  avvisaIscrizioneAlDirettivo,
  confermaAnnullamento,
  confermaIscrizione,
} from "@/lib/posta/abitanti";
import { inviaPromemoria, inviaPromemoriaAttivita } from "@/lib/posta/promemoria";
import {
  abilita,
  ambienteNelProcesso,
  assegnaIncarico,
  attendiEmail,
  contaEmail,
  creaAttivita,
  creaEdizione,
  creaSede,
  creaUtente,
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

/** La casella dell'associazione, come la impone vitest.config.mts (§15.13). */
const DIRETTIVO = EMAIL_ASSISTENZA_ABITANTI ?? "";

const ORARI = {
  ora_inizio_mattina: "09:00",
  ora_fine_mattina: "13:00",
  ora_inizio_pomeriggio: "14:00",
  ora_fine_pomeriggio: "18:00",
};

describe("§6.3 promemoria della sera prima", () => {
  const anon = visitatore();
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];
  const domani = aggiungiGiorni(oggiRoma(), 1);
  const dopodomani = aggiungiGiorni(oggiRoma(), 2);

  let sedeId: string;

  async function utenteNuovo(): Promise<UtenteTest> {
    const u = await creaUtente();
    utenti.push(u);
    return u;
  }

  // Le prenotazioni sono inserite direttamente, senza passare da prenota_slot:
  // il numero del posto se lo assegna il test, uno per ciascuna, perché
  // l'indice unico di §8.1 non ammette due volte lo stesso.
  let posto = 0;
  async function prenota(u: UtenteTest, fascia: "MATTINA" | "POMERIGGIO", data = domani) {
    posto += 1;
    return inserisciPrenotazioneDiretta({
      utente_id: u.id,
      sede_id: sedeId,
      data,
      fascia,
      posto_progressivo: posto,
    });
  }

  beforeAll(async () => {
    sedeId = await creaSede({
      capienza: 40,
      nome: "Ronco Coworking di prova",
      comune: "Ronco Canavese",
      indirizzo: "via della Prova 1",
      note: "Le chiavi sono al bar.",
      ...ORARI,
    });
    sedi.push(sedeId);
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  // -------------------------------------------------------------------------
  // Una persona, un messaggio.
  // -------------------------------------------------------------------------

  it("manda una sola email a chi ha prenotato tutta la giornata, con le due fasce dentro", async () => {
    const u = await utenteNuovo();
    await prenota(u, "MATTINA");
    await prenota(u, "POMERIGGIO");

    expect((await inviaPromemoria(servizio(), { giorno: domani })).falliti).toBe(0);

    const email = await attendiEmail(u.email);
    expect(await contaEmail(u.email)).toBe(1);
    expect(email.da).toBe("noreply@wildworking.sassifraga.org");
    expect(email.oggetto).toContain("Ronco Coworking di prova");
    // Il giorno per esteso, le due fasce con il proprio orario, e le
    // informazioni pratiche della sede (§5.2).
    expect(email.testo).toContain(dataEstesa(domani));
    expect(email.testo).toContain("Mattina, 09:00–13:00");
    expect(email.testo).toContain("Pomeriggio, 14:00–18:00");
    expect(email.testo).toContain("via della Prova 1");
    expect(email.testo).toContain("Le chiavi sono al bar.");
    // L'invito ad annullare e la strada per farlo (decisione del 10/09).
    expect(email.testo).toContain("ti chiediamo di annullare");
    expect(email.testo).toContain("Vai a Le mie prenotazioni per annullare");
    expect(email.testo).toContain("http://127.0.0.1:3000/prenotazioni");
  });

  it("al mestiere non arriva il numero del posto", async () => {
    const u = await utenteNuovo();
    await prenota(u, "MATTINA", dopodomani);

    const { data } = await servizio().rpc("promemoria_da_inviare", { p_giorno: dopodomani });
    const riga = (data ?? []).find((r) => r.utente_id === u.id);
    expect(riga).toBeDefined();
    expect(Object.keys(riga ?? {})).not.toContain("posto_progressivo");
  });

  it("non manda niente per una prenotazione annullata", async () => {
    const u = await utenteNuovo();
    const id = await prenota(u, "MATTINA");
    await servizio().from("prenotazioni").update({ stato: "ANNULLATA" }).eq("id", id);

    await inviaPromemoria(servizio(), { giorno: domani });
    expect(await nessunaEmailOltre(u.email)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Mai due volte. È il database a impedirlo, non un controllo qui (§8.1).
  // -------------------------------------------------------------------------

  it("un secondo giro sullo stesso giorno non manda niente", async () => {
    const u = await utenteNuovo();
    await prenota(u, "MATTINA");

    await inviaPromemoria(servizio(), { giorno: domani });
    await attendiEmail(u.email);

    await inviaPromemoria(servizio(), { giorno: domani });
    expect(await nessunaEmailOltre(u.email, 1)).toBe(0);
  });

  it("due giri contemporanei mandano una sola email", async () => {
    const u = await utenteNuovo();
    await prenota(u, "POMERIGGIO");

    await Promise.all([
      inviaPromemoria(servizio(), { giorno: domani }),
      inviaPromemoria(servizio(), { giorno: domani }),
    ]);

    await attendiEmail(u.email);
    expect(await contaEmail(u.email)).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Chi prenota tardi non riceve nulla — §8.4, decisione del 10/09.
  //
  // Non è una condizione scritta nel codice: è come funziona il calendario.
  // Il giro della sera guarda domani; una prenotazione fatta dopo, per
  // domani, non incontra più nessun giro, perché quello del giorno dopo
  // guarda già oltre.
  // -------------------------------------------------------------------------

  it("chi prenota dopo il giro della sera non riceve il promemoria", async () => {
    const u = await utenteNuovo();
    await inviaPromemoria(servizio(), { giorno: domani });

    const id = await prenota(u, "MATTINA");

    // Il giro della sera dopo, che guarda al giorno successivo.
    await inviaPromemoria(servizio(), { giorno: dopodomani });

    expect(await nessunaEmailOltre(u.email)).toBe(0);
    const { data } = await servizio()
      .from("prenotazioni")
      .select("promemoria_inviato_il")
      .eq("id", id)
      .single();
    expect(data?.promemoria_inviato_il).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Chi può far partire il giro.
  // -------------------------------------------------------------------------

  it("nessuno, se non il ruolo di servizio, può far partire i promemoria", async () => {
    const u = await utenteNuovo();
    const id = await prenota(u, "MATTINA");

    for (const client of [anon, u.client]) {
      const { data, error } = await client.rpc("promemoria_da_inviare", { p_giorno: domani });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }

    // E soprattutto: nessuna riga è stata presa in carico dal tentativo.
    const { data } = await servizio()
      .from("prenotazioni")
      .select("promemoria_inviato_il")
      .eq("id", id)
      .single();
    expect(data?.promemoria_inviato_il).toBeNull();
    expect(await contaEmail(u.email)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // La memoria del mestiere non è affare di nessun altro.
  // -------------------------------------------------------------------------

  it("la colonna promemoria_inviato_il non è leggibile da chi è collegato", async () => {
    const u = await utenteNuovo();
    await prenota(u, "MATTINA");

    const { error } = await u.client.from("prenotazioni").select("promemoria_inviato_il");
    expect(error).not.toBeNull();

    // Nemmeno di rimbalzo, dalla pagina "Le mie prenotazioni".
    const { data } = await u.client.from("mie_prenotazioni").select("*").limit(1);
    expect(Object.keys(data?.[0] ?? {})).not.toContain("promemoria_inviato_il");
  });
});

// ---------------------------------------------------------------------------
// §15.10 — il secondo elenco del giro notturno.
//
// «Il promemoria delle attività non è un secondo giro notturno: si aggiunge a
// quello che parte già alle ORA_PROMEMORIA. Una sola esecuzione, due elenchi.»
// Due elenchi vuol dire anche due messaggi, ed è la differenza fra questa
// lettura e l'altra: c'è un test apposta che la fissa.
//
// Le regole di sostanza sono le stesse di §6.3, riverificate per le
// iscrizioni: una sola email a persona, niente per un'iscrizione annullata,
// mai due volte, e niente a chi si iscrive dopo che il giro è passato.
// ---------------------------------------------------------------------------

describe("§15.10 il promemoria delle attività", () => {
  const anon = visitatore();
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];
  const edizioni: string[] = [];
  const domani = aggiungiGiorni(oggiRoma(), 1);
  const dopodomani = aggiungiGiorni(oggiRoma(), 2);

  let edizione: string;

  async function utenteNuovo(): Promise<UtenteTest> {
    const u = await creaUtente();
    utenti.push(u);
    await abilita(u.id, edizione);
    return u;
  }

  /** Una scheda con i dati di livello 2 dentro, per il giorno che serve. */
  async function attivitaPer(data: string, extra: Record<string, unknown> = {}) {
    return creaAttivita({
      edizione_id: edizione,
      data,
      capienza: 10,
      abitante_nome: "Maria",
      abitante_cognome: "Ghiglione",
      abitante_telefono: "011 0000000",
      luogo_esatto: "Via del Forno 3, Ronco Canavese",
      cosa_portare: "Scarponi",
      ...extra,
    });
  }

  beforeAll(async () => {
    // Le email le costruisce e le manda l'applicazione, che si fa il proprio
    // client di servizio: il test deve girare con lo stesso ambiente che
    // l'applicazione legge (come in tests/moderazione.test.ts).
    ambienteNelProcesso();
    edizione = await creaEdizione();
    edizioni.push(edizione);
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi, edizioni });
  });

  // -------------------------------------------------------------------------
  // Una persona, un messaggio — e dentro tutto quello che serve quella sera.
  // -------------------------------------------------------------------------

  it("manda una sola email a chi ha due attività domani, con dentro tutte e due", async () => {
    const u = await utenteNuovo();
    const prima = await attivitaPer(domani, { titolo: "Cena da Maria", ora_inizio: "19:00" });
    const seconda = await attivitaPer(domani, {
      titolo: "Passeggiata al mattino",
      ora_inizio: "09:00",
      abitante_nome: "Giulio",
      abitante_cognome: "Perinetto",
      luogo_esatto: "Piazza di prova 2, Ingria",
    });
    await inserisciIscrizioneDiretta({ attivita_id: prima, utente_id: u.id });
    await inserisciIscrizioneDiretta({ attivita_id: seconda, utente_id: u.id });

    expect((await inviaPromemoriaAttivita(servizio(), { giorno: domani })).falliti).toBe(0);

    const email = await attendiEmail(u.email);
    expect(await contaEmail(u.email)).toBe(1);
    expect(email.da).toBe("noreply@wildworking.sassifraga.org");
    expect(email.oggetto).toBe("Le tue attività di domani");
    expect(email.testo).toContain(dataEstesa(domani));
    expect(email.testo).toContain("Cena da Maria");
    expect(email.testo).toContain("Passeggiata al mattino");
    // I dati di livello 2 di §15.8: chi ha un posto ci ha diritto, ed è
    // esattamente quello che la sera prima serve.
    expect(email.testo).toContain("Maria Ghiglione");
    expect(email.testo).toContain("Via del Forno 3, Ronco Canavese");
    expect(email.testo).toContain("011 0000000");
    // La frase di §15.6 viaggia insieme al numero, che è di un terzo.
    expect(email.testo).toContain("Non usarlo per altro.");
    // L'invito ad annullare e la strada per farlo.
    expect(email.testo).toContain("ti chiediamo di annullare");
    expect(email.testo).toContain("http://127.0.0.1:3000/abitanti");
  });

  it("con una sola attività l'oggetto la nomina", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani, { titolo: "Il forno di Giulio" });
    await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });

    await inviaPromemoriaAttivita(servizio(), { giorno: domani });

    const email = await attendiEmail(u.email);
    expect(email.oggetto).toBe("Domani: Il forno di Giulio");
  });

  it("al mestiere non arriva il numero del posto, né la descrizione", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(dopodomani);
    await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });

    const { data } = await servizio().rpc("promemoria_attivita_da_inviare", {
      p_giorno: dopodomani,
    });
    const riga = (data ?? []).find((r) => r.utente_id === u.id);
    expect(riga).toBeDefined();
    expect(Object.keys(riga ?? {})).not.toContain("posto_progressivo");
    // La descrizione è testo di un'altra persona e si legge in pagina, per
    // intero: in una casella di posta non ci va (regola 26).
    expect(Object.keys(riga ?? {})).not.toContain("descrizione");
  });

  it("non manda niente per un'iscrizione annullata", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani);
    const id = await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });
    await servizio().from("iscrizioni").update({ stato: "ANNULLATA" }).eq("id", id);

    await inviaPromemoriaAttivita(servizio(), { giorno: domani });
    expect(await nessunaEmailOltre(u.email)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Mai due volte. È il database a impedirlo, non un controllo qui (§8.1).
  // -------------------------------------------------------------------------

  it("un secondo giro sullo stesso giorno non manda niente", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani);
    await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });

    await inviaPromemoriaAttivita(servizio(), { giorno: domani });
    await attendiEmail(u.email);

    await inviaPromemoriaAttivita(servizio(), { giorno: domani });
    expect(await nessunaEmailOltre(u.email, 1)).toBe(0);
  });

  it("due giri contemporanei mandano una sola email", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani);
    await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });

    await Promise.all([
      inviaPromemoriaAttivita(servizio(), { giorno: domani }),
      inviaPromemoriaAttivita(servizio(), { giorno: domani }),
    ]);

    await attendiEmail(u.email);
    expect(await contaEmail(u.email)).toBe(1);
  });

  it("chi si iscrive dopo il giro della sera non riceve il promemoria", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani);
    await inviaPromemoriaAttivita(servizio(), { giorno: domani });

    const id = await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });

    // Il giro della sera dopo, che guarda al giorno successivo.
    await inviaPromemoriaAttivita(servizio(), { giorno: dopodomani });

    expect(await nessunaEmailOltre(u.email)).toBe(0);
    const { data } = await servizio()
      .from("iscrizioni")
      .select("promemoria_inviato_il")
      .eq("id", id)
      .single();
    expect(data?.promemoria_inviato_il).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Un'attività riportata in bozza dopo l'iscrizione — §15.12, e la stessa
  // lettura di §6.3 per una chiusura inserita dopo la prenotazione: la riga
  // resta valida finché una persona non interviene, quindi il promemoria
  // parte lo stesso (regola 6).
  // -------------------------------------------------------------------------

  it("parte anche se l'attività è tornata in bozza: l'iscrizione è ancora valida", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani, { titolo: "Serata tornata in bozza" });
    await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });
    await servizio()
      .from("attivita")
      .update({ stato: "BOZZA", consenso_raccolto: false, consenso_modalita: null })
      .eq("id", attivita);

    await inviaPromemoriaAttivita(servizio(), { giorno: domani });

    const email = await attendiEmail(u.email);
    expect(email.testo).toContain("Serata tornata in bozza");
  });

  // -------------------------------------------------------------------------
  // Due elenchi, una sola esecuzione — e nessuno dei due prende le righe
  // dell'altro.
  // -------------------------------------------------------------------------

  it("chi domani ha una postazione e un'attività riceve due messaggi, uno per elenco", async () => {
    const u = await utenteNuovo();
    const sedeId = await creaSede({
      capienza: 10,
      nome: "Ingria Coworking di prova",
      comune: "Ingria",
      ora_inizio_mattina: "09:00",
      ora_fine_mattina: "13:00",
      ora_inizio_pomeriggio: "14:00",
      ora_fine_pomeriggio: "18:00",
    });
    sedi.push(sedeId);
    await inserisciPrenotazioneDiretta({
      utente_id: u.id,
      sede_id: sedeId,
      data: domani,
      fascia: "MATTINA",
      posto_progressivo: 1,
    });
    const attivita = await attivitaPer(domani, { titolo: "Cena dopo il lavoro" });
    const iscrizione = await inserisciIscrizioneDiretta({
      attivita_id: attivita,
      utente_id: u.id,
    });

    // Il giro delle postazioni, da solo: manda il suo messaggio e non tocca
    // l'iscrizione.
    await inviaPromemoria(servizio(), { giorno: domani });
    const postazioni = await attendiEmail(u.email);
    expect(postazioni.oggetto).toContain("Ingria Coworking di prova");
    expect(postazioni.testo).not.toContain("Cena dopo il lavoro");
    const { data: primaDelSecondo } = await servizio()
      .from("iscrizioni")
      .select("promemoria_inviato_il")
      .eq("id", iscrizione)
      .single();
    expect(primaDelSecondo?.promemoria_inviato_il).toBeNull();

    // Il secondo elenco, nella stessa esecuzione: il secondo messaggio.
    await inviaPromemoriaAttivita(servizio(), { giorno: domani });
    const attivitaEmail = await attendiEmail(u.email, 1);
    expect(attivitaEmail.oggetto).toBe("Domani: Cena dopo il lavoro");
    expect(await contaEmail(u.email)).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Chi può far partire il giro, e chi può leggerne la memoria.
  // -------------------------------------------------------------------------

  it("nessuno, se non il ruolo di servizio, può far partire i promemoria delle attività", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani);
    const id = await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });

    for (const client of [anon, u.client]) {
      const { data, error } = await client.rpc("promemoria_attivita_da_inviare", {
        p_giorno: domani,
      });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }

    // E soprattutto: nessuna riga è stata presa in carico dal tentativo.
    const { data } = await servizio()
      .from("iscrizioni")
      .select("promemoria_inviato_il")
      .eq("id", id)
      .single();
    expect(data?.promemoria_inviato_il).toBeNull();
    expect(await contaEmail(u.email)).toBe(0);
  });

  it("la colonna promemoria_inviato_il delle iscrizioni non è leggibile da chi è collegato", async () => {
    const u = await utenteNuovo();
    const attivita = await attivitaPer(domani);
    await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });

    const { error } = await u.client.from("iscrizioni").select("promemoria_inviato_il");
    expect(error).not.toBeNull();

    // Nemmeno di rimbalzo, da una riga letta per intero.
    const { data } = await u.client.from("iscrizioni").select("*").limit(1);
    expect(Object.keys(data?.[0] ?? {})).not.toContain("promemoria_inviato_il");
  });
});

// ---------------------------------------------------------------------------
// §15.10 — le altre email del modulo: la conferma, l'annullamento fatto dalla
// persona, l'attività che non si farà, e — dal 15/09/2026 — l'avviso che
// arriva alla casella dell'associazione a ogni iscrizione.
//
// Le due dell'amministratore stanno in tests/iscrizioni-amministratore.test.ts,
// dove sono nate insieme alle azioni di cui §15.9 le fa condizione.
// ---------------------------------------------------------------------------

describe("§15.10 le email di «Prenota un abitante»", () => {
  const edizioni: string[] = [];
  let edizione: string;
  let admin: UtenteTest;
  let persona: UtenteTest;
  let altra: UtenteTest;
  let utenti: UtenteTest[];

  beforeAll(async () => {
    ambienteNelProcesso();
    edizione = await creaEdizione();
    edizioni.push(edizione);

    [admin, persona, altra] = await creaUtenti(3);
    utenti = [admin, persona, altra];
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
    await abilita(persona.id, edizione);
    await abilita(altra.id, edizione);
  });

  afterAll(async () => {
    await pulisci({ utenti, edizioni });
  });

  /** La scheda per intero, come la legge il pannello (§15.8 livello 3). */
  async function scheda(id: string) {
    const letta = await attivitaSingola(admin.client, id);
    if (!letta) throw new Error("fixture: scheda non letta");
    return letta;
  }

  it("la conferma porta i dati di livello 2 e la strada per annullare", async () => {
    const attivita = await creaAttivita({
      edizione_id: edizione,
      titolo: "Cena da Maria",
      abitante_nome: "Maria",
      abitante_cognome: "Ghiglione",
      abitante_telefono: "011 0000000",
      luogo_esatto: "Via del Forno 3, Ronco Canavese",
      cosa_portare: "Una bottiglia",
    });
    const prima = await contaEmail(persona.email);

    expect(await confermaIscrizione(persona.id, await scheda(attivita))).toMatchObject({ ok: true });

    const email = await attendiEmail(persona.email, prima);
    expect(email.oggetto).toBe("Hai un posto in Cena da Maria");
    expect(email.testo).toContain("Maria Ghiglione");
    expect(email.testo).toContain("Via del Forno 3, Ronco Canavese");
    expect(email.testo).toContain("011 0000000");
    expect(email.testo).toContain("Una bottiglia");
    expect(email.testo).toContain(`http://127.0.0.1:3000/abitanti/${attivita}`);
    // La descrizione no: è testo di un'altra persona e si legge in pagina,
    // per intero (regola 26).
    expect(email.testo).not.toContain("Racconto dell'abitante");
    expect(await nessunaEmailOltre(persona.email, prima + 1)).toBe(0);
  });

  it("l'annullamento è sobrio e non restituisce i dati di livello 2", async () => {
    const attivita = await creaAttivita({
      edizione_id: edizione,
      titolo: "Passeggiata di prova",
      abitante_cognome: "Ghiglione",
      abitante_telefono: "011 0000000",
      luogo_esatto: "Via del Forno 3, Ronco Canavese",
    });
    const letta = await scheda(attivita);
    const prima = await contaEmail(persona.email);

    // Come la manda l'azione: livello 2 tolto, perché il posto è stato
    // lasciato e §15.8 lo toglie nello stesso istante (§15.12).
    expect(
      await confermaAnnullamento(persona.id, {
        ...letta,
        abitante_cognome: null,
        abitante_telefono: null,
        luogo_esatto: null,
      }),
    ).toMatchObject({ ok: true });

    const email = await attendiEmail(persona.email, prima);
    expect(email.oggetto).toContain("Passeggiata di prova");
    expect(email.testo).toContain("Il posto è tornato libero");
    expect(email.testo).not.toContain("Ghiglione");
    expect(email.testo).not.toContain("011 0000000");
    expect(email.testo).not.toContain("Via del Forno 3");
    expect(await nessunaEmailOltre(persona.email, prima + 1)).toBe(0);
  });

  it("l'attività annullata restituisce chi ha perso il posto, e a ciascuno arriva un'email col motivo", async () => {
    const attivita = await creaAttivita({
      edizione_id: edizione,
      titolo: "Serata di prova",
      capienza: 4,
    });
    for (const u of [persona, altra]) {
      const esito = await iscriviti(u.client, attivita);
      if (!esito.ok) throw new Error(`fixture: iscrizione rifiutata (${esito.codice})`);
    }
    const letta = await scheda(attivita);
    const primaPersona = await contaEmail(persona.email);
    const primaAltra = await contaEmail(altra.email);

    // Le persone arrivano dalla stessa istruzione che le annulla: fra una
    // lettura e un annullamento ci starebbe chi prende l'ultimo posto e non
    // viene mai avvisato.
    const esito = await annullaAttivita(admin.client, attivita);
    expect(esito).toMatchObject({ ok: true });
    if (!esito.ok) return;
    expect([...esito.valore].sort()).toEqual([persona.id, altra.id].sort());

    for (const u of [persona, altra]) {
      expect(await avvisaAttivitaAnnullata(u.id, letta, "l'abitante si è ammalato")).toMatchObject({
        ok: true,
      });
    }

    const email = await attendiEmail(persona.email, primaPersona);
    expect(email.oggetto).toBe("Serata di prova non si farà");
    expect(email.testo).toContain("l'abitante si è ammalato");
    expect(email.testo).toContain("http://127.0.0.1:3000/abitanti");
    expect(await nessunaEmailOltre(persona.email, primaPersona + 1)).toBe(0);
    expect(await nessunaEmailOltre(altra.email, primaAltra + 1)).toBe(0);

    // E le iscrizioni sono davvero annullate, con la firma di chi ha agito.
    const { data } = await servizio()
      .from("iscrizioni")
      .select("stato, annullata_da")
      .eq("attivita_id", attivita);
    expect(data?.every((r) => r.stato === "ANNULLATA" && r.annullata_da === admin.id)).toBe(true);
  });

  it("senza motivo l'email non ne inventa uno, e nessuna porta l'indirizzo di qualcuno", async () => {
    const attivita = await creaAttivita({ edizione_id: edizione, titolo: "Senza spiegazioni" });
    const prima = await contaEmail(altra.email);

    expect(await avvisaAttivitaAnnullata(altra.id, await scheda(attivita), "")).toMatchObject({
      ok: true,
    });

    const email = await attendiEmail(altra.email, prima);
    expect(email.testo).not.toContain("Il motivo:");
    for (const u of [admin, persona, altra]) {
      expect(email.testo).not.toContain(u.email);
    }
  });

  /**
   * L'avviso al Direttivo — §15.10, ultima riga, aggiunto il 15/09/2026.
   *
   * È l'unica email del modulo che non va alla persona di cui parla, e
   * l'unica che porta un indirizzo email nel corpo: lo stesso che §15.9
   * mostra già nel pannello, allo stesso lettore e per la stessa ragione.
   * Quello che si prova qui è dove arriva, cosa porta e — soprattutto —
   * cosa non porta: niente livello 2, e niente verso la persona.
   */
  describe("l'avviso al Direttivo a ogni iscrizione", () => {
    const attesa = {
      titolo: "Cena di prova al Direttivo",
      abitante_nome: "Maria",
      abitante_cognome: "Ghiglione",
      abitante_telefono: "011 0000000",
      luogo_generico: "Ronco Canavese",
      luogo_esatto: "Via del Forno 3, Ronco Canavese",
      capienza: 6,
    };

    it("arriva alla casella dell'associazione con l'attività, l'indirizzo dell'iscritto e i posti rimasti", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione, ...attesa });
      const esito = await iscriviti(persona.client, attivita);
      if (!esito.ok) throw new Error(`fixture: iscrizione rifiutata (${esito.codice})`);
      const primaDirettivo = await contaEmail(DIRETTIVO);
      const primaPersona = await contaEmail(persona.email);

      expect(
        await avvisaIscrizioneAlDirettivo(persona.id, await scheda(attivita), {
          postiRimasti: 5,
          perConto: false,
        }),
      ).toMatchObject({ ok: true });

      const email = await attendiEmail(DIRETTIVO, primaDirettivo);
      expect(email.oggetto).toBe("Nuova iscrizione: Cena di prova al Direttivo");
      expect(email.testo).toContain(persona.email);
      expect(email.testo).toContain("Ronco Canavese");
      expect(email.testo).toContain("Maria");
      expect(email.testo).toContain("Posti ancora liberi: 5");
      expect(email.testo).toContain(
        `http://127.0.0.1:3000/amministrazione/attivita/${attivita}/iscritti`,
      );
      // Livello 2 fuori: chi legge questa casella lo vede tutto nel pannello
      // (§15.8), e una casella di posta non è dove tenerlo per anni.
      expect(email.testo).not.toContain("Ghiglione");
      expect(email.testo).not.toContain("011 0000000");
      expect(email.testo).not.toContain("Via del Forno 3");
      // Uno solo, e niente di tutto questo alla persona.
      expect(await nessunaEmailOltre(DIRETTIVO, primaDirettivo + 1)).toBe(0);
      expect(await nessunaEmailOltre(persona.email, primaPersona)).toBe(0);
    });

    it("quando l'iscrizione la fa l'amministratore, l'avviso lo dice", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione, ...attesa });
      const prima = await contaEmail(DIRETTIVO);

      expect(
        await avvisaIscrizioneAlDirettivo(altra.id, await scheda(attivita), {
          postiRimasti: 6,
          perConto: true,
        }),
      ).toMatchObject({ ok: true });

      const email = await attendiEmail(DIRETTIVO, prima);
      expect(email.testo).toContain("da chi si occupa del servizio");
      expect(email.testo).toContain(altra.email);
      expect(await nessunaEmailOltre(DIRETTIVO, prima + 1)).toBe(0);
    });

    it("senza casella configurata non parte niente, e non si ripiega su un altro indirizzo", async () => {
      const attivita = await creaAttivita({ edizione_id: edizione, ...attesa });
      const letta = await scheda(attivita);
      const primaDirettivo = await contaEmail(DIRETTIVO);
      const primaPersona = await contaEmail(persona.email);

      vi.stubEnv("EMAIL_ASSISTENZA_ABITANTI", "");
      vi.resetModules();
      try {
        const { avvisaIscrizioneAlDirettivo: senzaCasella } = await import("@/lib/posta/abitanti");
        expect(await senzaCasella(persona.id, letta, { postiRimasti: 6, perConto: false })).toEqual({
          ok: false,
          motivo: "EMAIL_ASSISTENZA_ABITANTI non configurata",
        });
      } finally {
        vi.unstubAllEnvs();
        vi.resetModules();
      }

      // E in particolare: non è finito nell'indirizzo istituzionale del piè
      // di pagina, che è quello che `assistenza()` mostra in pagina quando la
      // variabile manca. Una casella non si deduce da un testo.
      expect(await nessunaEmailOltre(DIRETTIVO, primaDirettivo)).toBe(0);
      expect(await nessunaEmailOltre(persona.email, primaPersona)).toBe(0);
      expect(await contaEmail(m.pieDiPagina.email)).toBe(0);
    });
  });
});
