/**
 * SPEC §7, §5.3, §6.1 — le pulizie automatiche notturne (§12 passo 11).
 *
 * La tabella "Conservazione e cancellazione automatica" di §7, verificata
 * riga per riga. Quattro cose sono quelle che contano davvero:
 *
 *   * il legame fra una prenotazione e una persona si recide dopo 30 giorni,
 *     e i cinque valori facoltativi vengono copiati nei campi `stat_` in quel
 *     momento e **solo** se il consenso è attivo (§5.3, regola 19);
 *   * la cancellazione chiesta dalla persona (art. 17) non copia niente,
 *     mai, in nessun caso;
 *   * nessun account viene chiuso senza essere stato avvisato un mese prima;
 *   * ogni pulizia è irraggiungibile da chi non è il mestiere automatico.
 *
 * Le asserzioni guardano sempre e solo le righe che questo file ha creato:
 * il mestiere lavora su tutta la banca dati, e cosa ci trova dipende da cosa
 * hanno lasciato gli altri file.
 *
 * Le email vanno in Mailpit (vitest.config.mts impone POSTA_LOCALE) e nessun
 * indirizzo viene mai stampato (regola 4).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GIORNI_ANONIMIZZAZIONE,
  GIORNI_CHIUSURA_EDIZIONE,
  MESI_ACCOUNT_DORMIENTE,
  MESI_AVVISO_DORMIENZA,
  MESI_CONSERVAZIONE_CONSENSI,
} from "@/config/limits";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import { cancellaMioAccount } from "@/lib/db/diritti";
import { aggiornaDatiFacoltativi, rimuoviDatiFacoltativi } from "@/lib/db/utenti";
import { eseguiPulizie } from "@/lib/pulizie";
import {
  abilita,
  CODICE_PERMESSO_NEGATO,
  contaEmail,
  creaAttivita,
  creaEdizione,
  creaSede,
  creaUtente,
  inserisciIscrizioneDiretta,
  inserisciPrenotazioneDiretta,
  nessunaEmailOltre,
  pulisci,
  pulisciEdizioni,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const CINQUE_CAMPI = {
  eta: "36-50",
  genere: "F",
  professione: "Falegname",
  motivo_visita: "Lavoro da remoto",
  residenza: "Valle Soana",
} as const;

const COLONNE_STAT =
  "id, utente_id, anonimizzata, data, stat_eta, stat_genere, stat_professione, stat_motivo_visita, stat_residenza" as const;

async function prenotazione(id: string) {
  const { data } = await servizio().from("prenotazioni").select(COLONNE_STAT).eq("id", id).single();
  if (!data) throw new Error("prenotazione sparita");
  return data;
}

/** True quando nessuno dei cinque `stat_` porta un valore. */
function statVuoti(riga: Awaited<ReturnType<typeof prenotazione>>): boolean {
  return (
    riga.stat_eta === null &&
    riga.stat_genere === null &&
    riga.stat_professione === null &&
    riga.stat_motivo_visita === null &&
    riga.stat_residenza === null
  );
}

/** Sposta indietro la data dell'ultimo accesso di tanti mesi. */
async function ultimoAccessoMesiFa(utenteId: string, mesi: number): Promise<void> {
  const quando = new Date();
  quando.setMonth(quando.getMonth() - mesi);
  const { error } = await servizio()
    .from("utenti")
    .update({ ultimo_accesso: quando.toISOString() })
    .eq("id", utenteId);
  if (error) throw new Error(`ultimoAccessoMesiFa: ${error.code}`);
}

/**
 * Finge un avviso di dormienza partito tanti mesi fa. Va scritto DOPO
 * ultimoAccessoMesiFa e da solo: il trigger di §7 azzera l'avviso ogni volta
 * che l'ultimo accesso si muove, ed è esattamente quello che deve fare.
 */
async function avvisatoMesiFa(utenteId: string, mesi: number): Promise<void> {
  const quando = new Date();
  quando.setMonth(quando.getMonth() - mesi);
  const { error } = await servizio()
    .from("utenti")
    .update({ avviso_dormienza_il: quando.toISOString() })
    .eq("id", utenteId);
  if (error) throw new Error(`avvisatoMesiFa: ${error.code}`);
}

async function avvisoDi(utenteId: string): Promise<string | null | undefined> {
  const { data } = await servizio()
    .from("utenti")
    .select("avviso_dormienza_il")
    .eq("id", utenteId)
    .maybeSingle();
  return data?.avviso_dormienza_il;
}

async function esiste(utenteId: string): Promise<boolean> {
  const { data } = await servizio().from("utenti").select("id").eq("id", utenteId).maybeSingle();
  return data !== null;
}

// ---------------------------------------------------------------------------

describe("§5.3 anonimizzazione delle prenotazioni oltre 30 giorni", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];

  const VECCHIA = aggiungiGiorni(oggiRoma(), -(GIORNI_ANONIMIZZAZIONE + 1));
  const RECENTE = aggiungiGiorni(oggiRoma(), -(GIORNI_ANONIMIZZAZIONE - 1));
  const FUTURA = aggiungiGiorni(oggiRoma(), 1);

  let sedeId: string;
  let conConsenso: UtenteTest;
  let senzaConsenso: UtenteTest;
  let revocato: UtenteTest;

  // Una per persona e per data: l'indice unico di §8.1 non ammette due volte
  // lo stesso posto sullo stesso giorno e fascia.
  let posto = 0;
  async function prenota(u: UtenteTest, data: string): Promise<string> {
    posto += 1;
    return inserisciPrenotazioneDiretta({
      utente_id: u.id,
      sede_id: sedeId,
      data,
      fascia: "MATTINA",
      posto_progressivo: posto,
    });
  }

  let vecchiaConsenso: string;
  let vecchiaSenza: string;
  let vecchiaRevocata: string;
  let recente: string;
  let futura: string;

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 50 });
    sedi.push(sedeId);

    [conConsenso, senzaConsenso, revocato] = await Promise.all([
      creaUtente(),
      creaUtente(),
      creaUtente(),
    ]);
    utenti.push(conConsenso, senzaConsenso, revocato);

    await aggiornaDatiFacoltativi(conConsenso.client, conConsenso.id, CINQUE_CAMPI);
    // Compila e poi revoca: al momento dell'anonimizzazione il consenso non
    // c'è più, e non deve restare traccia di quello che aveva scritto.
    await aggiornaDatiFacoltativi(revocato.client, revocato.id, CINQUE_CAMPI);
    await rimuoviDatiFacoltativi(revocato.client, revocato.id);

    vecchiaConsenso = await prenota(conConsenso, VECCHIA);
    vecchiaSenza = await prenota(senzaConsenso, VECCHIA);
    vecchiaRevocata = await prenota(revocato, VECCHIA);
    recente = await prenota(conConsenso, RECENTE);
    futura = await prenota(conConsenso, FUTURA);
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it("prima del giro nessuna prenotazione porta un valore stat_", async () => {
    for (const id of [vecchiaConsenso, vecchiaSenza, vecchiaRevocata, recente, futura]) {
      const riga = await prenotazione(id);
      expect(riga.anonimizzata).toBe(false);
      expect(statVuoti(riga)).toBe(true);
    }
  });

  it("il giro notturno recide il legame delle prenotazioni oltre 30 giorni", async () => {
    const esito = await eseguiPulizie(servizio());
    expect(esito.falliti).toEqual([]);
    expect(esito.prenotazioniAnonimizzate).toBeGreaterThanOrEqual(3);

    for (const id of [vecchiaConsenso, vecchiaSenza, vecchiaRevocata]) {
      const riga = await prenotazione(id);
      expect(riga.anonimizzata).toBe(true);
      expect(riga.utente_id).toBeNull();
    }
  });

  it("lascia intatte le prenotazioni più recenti e quelle future", async () => {
    for (const id of [recente, futura]) {
      const riga = await prenotazione(id);
      expect(riga.anonimizzata).toBe(false);
      expect(riga.utente_id).not.toBeNull();
      expect(statVuoti(riga)).toBe(true);
    }
  });

  it("copia i cinque valori quando il consenso è attivo", async () => {
    const riga = await prenotazione(vecchiaConsenso);
    expect(riga.stat_eta).toBe(CINQUE_CAMPI.eta);
    expect(riga.stat_genere).toBe(CINQUE_CAMPI.genere);
    expect(riga.stat_professione).toBe(CINQUE_CAMPI.professione);
    expect(riga.stat_motivo_visita).toBe(CINQUE_CAMPI.motivo_visita);
    expect(riga.stat_residenza).toBe(CINQUE_CAMPI.residenza);
  });

  it("non copia niente quando il consenso non c'è mai stato", async () => {
    expect(statVuoti(await prenotazione(vecchiaSenza))).toBe(true);
  });

  it("non copia niente quando il consenso è stato revocato", async () => {
    expect(statVuoti(await prenotazione(vecchiaRevocata))).toBe(true);
  });

  it("non ricopia e non torna indietro a un secondo giro", async () => {
    const primaDelSecondo = await prenotazione(vecchiaSenza);
    await eseguiPulizie(servizio());
    const dopo = await prenotazione(vecchiaSenza);
    expect(dopo).toEqual(primaDelSecondo);
    expect(statVuoti(dopo)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("§5.3 la cancellazione chiesta dalla persona non copia niente", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];
  let sedeId: string;
  let u: UtenteTest;
  let passata: string;

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 4 });
    sedi.push(sedeId);
    u = await creaUtente();
    utenti.push(u);
    await aggiornaDatiFacoltativi(u.client, u.id, CINQUE_CAMPI);
    passata = await inserisciPrenotazioneDiretta({
      utente_id: u.id,
      sede_id: sedeId,
      data: aggiungiGiorni(oggiRoma(), -1),
      fascia: "MATTINA",
    });
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it("art. 17: la prenotazione resta anonima e senza nessun valore stat_", async () => {
    await cancellaMioAccount(u.client);
    const riga = await prenotazione(passata);
    expect(riga.anonimizzata).toBe(true);
    expect(riga.utente_id).toBeNull();
    expect(statVuoti(riga)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("§7 account dormienti: avviso a 23 mesi, chiusura a 24", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];
  let sedeId: string;

  /** Ferma da poco più di 23 mesi, mai avvisata: stanotte va avvisata. */
  let daAvvisare: UtenteTest;
  /** Ferma da 20 mesi: non la tocca nessuno. */
  let ancoraAttiva: UtenteTest;
  /** Ferma da 25 mesi e avvisata due mesi fa: stanotte si chiude. */
  let daChiudere: UtenteTest;
  /** Ferma da 25 mesi ma mai avvisata: stanotte va avvisata, non chiusa. */
  let maiAvvisata: UtenteTest;
  /** Ferma da 25 mesi e avvisata ieri: il mese di preavviso non è passato. */
  let avvisataIeri: UtenteTest;

  let prenotazioneDaChiudere: string;
  let visteDaAvvisare = 0;
  let visteMaiAvvisata = 0;
  let visteAvvisataIeri = 0;

  const PREAVVISO_MESI = MESI_ACCOUNT_DORMIENTE - MESI_AVVISO_DORMIENZA;

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 10 });
    sedi.push(sedeId);

    [daAvvisare, ancoraAttiva, daChiudere, maiAvvisata, avvisataIeri] = await Promise.all([
      creaUtente(),
      creaUtente(),
      creaUtente(),
      creaUtente(),
      creaUtente(),
    ]);
    utenti.push(daAvvisare, ancoraAttiva, daChiudere, maiAvvisata, avvisataIeri);

    // La persona che si chiude aveva dato il consenso e ha una presenza di
    // ieri, non ancora anonimizzata dal giro dei 30 giorni.
    await aggiornaDatiFacoltativi(daChiudere.client, daChiudere.id, CINQUE_CAMPI);
    prenotazioneDaChiudere = await inserisciPrenotazioneDiretta({
      utente_id: daChiudere.id,
      sede_id: sedeId,
      data: aggiungiGiorni(oggiRoma(), -1),
      fascia: "MATTINA",
    });

    await ultimoAccessoMesiFa(daAvvisare.id, MESI_AVVISO_DORMIENZA + 1);
    await ultimoAccessoMesiFa(ancoraAttiva.id, MESI_AVVISO_DORMIENZA - 3);
    await ultimoAccessoMesiFa(daChiudere.id, MESI_ACCOUNT_DORMIENTE + 1);
    await ultimoAccessoMesiFa(maiAvvisata.id, MESI_ACCOUNT_DORMIENTE + 1);
    await ultimoAccessoMesiFa(avvisataIeri.id, MESI_ACCOUNT_DORMIENTE + 1);

    // L'avviso si scrive dopo, e da solo: muovere l'ultimo accesso lo azzera.
    await avvisatoMesiFa(daChiudere.id, PREAVVISO_MESI + 1);
    await avvisatoMesiFa(avvisataIeri.id, 0);

    visteDaAvvisare = await contaEmail(daAvvisare.email);
    visteMaiAvvisata = await contaEmail(maiAvvisata.email);
    visteAvvisataIeri = await contaEmail(avvisataIeri.email);
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it("un solo giro avvisa chi va avvisato e chiude solo chi era già stato avvisato", async () => {
    const esito = await eseguiPulizie(servizio());
    expect(esito.falliti).toEqual([]);

    // Avvisate: la dormiente da 23 mesi e quella da 25 mai avvisata.
    expect(esito.avvisiInviati).toBeGreaterThanOrEqual(2);
    expect(esito.avvisiFalliti).toBe(0);
    expect(await avvisoDi(daAvvisare.id)).not.toBeNull();
    expect(await avvisoDi(maiAvvisata.id)).not.toBeNull();

    // Chiusa: solo quella avvisata due mesi fa.
    expect(esito.accountChiusi).toBeGreaterThanOrEqual(1);
    expect(await esiste(daChiudere.id)).toBe(false);
    expect(await esiste(maiAvvisata.id)).toBe(true);
    expect(await esiste(avvisataIeri.id)).toBe(true);
    expect(await esiste(ancoraAttiva.id)).toBe(true);
  });

  it("chi è fermo da meno di 23 mesi non viene avvisato", async () => {
    expect(await avvisoDi(ancoraAttiva.id)).toBeNull();
  });

  it("l'avviso arriva a chi va avvisato, e a nessun altro", async () => {
    expect(await contaEmail(daAvvisare.email)).toBe(visteDaAvvisare + 1);
    expect(await contaEmail(maiAvvisata.email)).toBe(visteMaiAvvisata + 1);
    expect(await nessunaEmailOltre(avvisataIeri.email, visteAvvisataIeri)).toBe(0);
    expect(await contaEmail(ancoraAttiva.email)).toBe(0);
  });

  it("un secondo giro non manda un secondo avviso alla stessa persona", async () => {
    const prima = await contaEmail(daAvvisare.email);
    await eseguiPulizie(servizio());
    expect(await nessunaEmailOltre(daAvvisare.email, prima)).toBe(0);
  });

  it("chi torna e accede riparte da zero: l'avviso si azzera", async () => {
    expect(await avvisoDi(daAvvisare.id)).not.toBeNull();
    await servizio()
      .from("utenti")
      .update({ ultimo_accesso: new Date().toISOString() })
      .eq("id", daAvvisare.id);
    expect(await avvisoDi(daAvvisare.id)).toBeNull();
  });

  it("chiudendo un account dormiente le prenotazioni tengono i valori stat_", async () => {
    const riga = await prenotazione(prenotazioneDaChiudere);
    expect(riga.anonimizzata).toBe(true);
    expect(riga.utente_id).toBeNull();
    expect(riga.stat_eta).toBe(CINQUE_CAMPI.eta);
    expect(riga.stat_residenza).toBe(CINQUE_CAMPI.residenza);
  });

  it("la persona non può toccare da sé la data del proprio avviso", async () => {
    const { error } = await ancoraAttiva.client
      .from("utenti")
      .update({ avviso_dormienza_il: null })
      .eq("id", ancoraAttiva.id);
    expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);
  });
});

// ---------------------------------------------------------------------------

describe("§7 il registro dei consensi si conserva 24 mesi dopo la chiusura", () => {
  const utenti: UtenteTest[] = [];
  let u: UtenteTest;

  async function consensiDi(utenteId: string) {
    const { data } = await servizio().from("consensi").select("tipo").eq("utente_id", utenteId);
    return data ?? [];
  }

  async function chiusuraDi(utenteId: string) {
    const { data } = await servizio()
      .from("account_chiusi")
      .select("utente_id")
      .eq("utente_id", utenteId)
      .maybeSingle();
    return data;
  }

  beforeAll(async () => {
    u = await creaUtente();
    utenti.push(u);
    await aggiornaDatiFacoltativi(u.client, u.id, CINQUE_CAMPI);
    await cancellaMioAccount(u.client);
  });

  afterAll(async () => {
    await pulisci({ utenti });
  });

  it("la chiusura annota la data e le righe di consenso restano", async () => {
    expect(await chiusuraDi(u.id)).not.toBeNull();
    expect((await consensiDi(u.id)).length).toBeGreaterThan(0);
  });

  it("prima dei 24 mesi non viene cancellato niente", async () => {
    const { data } = await servizio().rpc("cancella_consensi_scaduti", {
      p_mesi: MESI_CONSERVAZIONE_CONSENSI,
    });
    expect(data).toBe(0);
    expect((await consensiDi(u.id)).length).toBeGreaterThan(0);
  });

  it("dopo i 24 mesi spariscono le righe e la data di chiusura con loro", async () => {
    const quando = new Date();
    quando.setMonth(quando.getMonth() - (MESI_CONSERVAZIONE_CONSENSI + 1));
    await servizio()
      .from("account_chiusi")
      .update({ chiuso_il: quando.toISOString() })
      .eq("utente_id", u.id);

    const { data } = await servizio().rpc("cancella_consensi_scaduti", {
      p_mesi: MESI_CONSERVAZIONE_CONSENSI,
    });
    expect(data).toBeGreaterThan(0);
    expect(await consensiDi(u.id)).toEqual([]);
    expect(await chiusuraDi(u.id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("§6.1 le richieste di accesso mai completate spariscono", () => {
  const utenti: UtenteTest[] = [];
  let mai: string;
  let completata: UtenteTest;

  async function esisteInAuth(id: string): Promise<boolean> {
    const { data } = await servizio().auth.admin.getUserById(id);
    return Boolean(data?.user);
  }

  beforeAll(async () => {
    completata = await creaUtente();
    utenti.push(completata);
    // Chi chiede un link e non lo apre: Auth registra l'indirizzo, il
    // profilo non nasce (§6.1 punto 4).
    const { data, error } = await servizio().auth.admin.createUser({
      email: `mai-usata-${randomUUID()}@example.com`,
      email_confirm: false,
    });
    if (error || !data.user) throw new Error("createUser fallita");
    mai = data.user.id;
  });

  afterAll(async () => {
    await pulisci({ utenti });
    await servizio().auth.admin.deleteUser(mai);
  });

  it("una richiesta mai aperta non crea nessun profilo", async () => {
    expect(await esiste(mai)).toBe(false);
    expect(await esisteInAuth(mai)).toBe(true);
  });

  it("finché non sono passate le ore previste resta dov'è", async () => {
    const { data } = await servizio().rpc("cancella_richieste_incomplete", { p_ore: 24 });
    expect(data).toBe(0);
    expect(await esisteInAuth(mai)).toBe(true);
  });

  it("passate le ore sparisce, e chi è entrato davvero resta", async () => {
    const { data } = await servizio().rpc("cancella_richieste_incomplete", { p_ore: 0 });
    expect(data).toBeGreaterThan(0);
    expect(await esisteInAuth(mai)).toBe(false);
    expect(await esisteInAuth(completata.id)).toBe(true);
    expect(await esiste(completata.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("§6.1 le impronte delle richieste di link durano un'ora", () => {
  const impronta = `prova-${randomUUID()}`;

  beforeAll(async () => {
    const { error } = await servizio()
      .from("richieste_link")
      .insert({ impronta_email: impronta, impronta_rete: impronta });
    if (error) throw new Error(`insert richieste_link: ${error.code}`);
  });

  async function quante(): Promise<number> {
    const { count } = await servizio()
      .from("richieste_link")
      .select("id", { count: "exact", head: true })
      .eq("impronta_email", impronta);
    return count ?? 0;
  }

  it("un'impronta appena scritta resta", async () => {
    await servizio().rpc("cancella_impronte_scadute");
    expect(await quante()).toBe(1);
  });

  it("un'impronta più vecchia di un'ora sparisce", async () => {
    const quando = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await servizio()
      .from("richieste_link")
      .update({ richiesta_il: quando.toISOString() })
      .eq("impronta_email", impronta);

    const { data } = await servizio().rpc("cancella_impronte_scadute");
    expect(data).toBeGreaterThan(0);
    expect(await quante()).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("§6.8 persone distinte per mese", () => {
  const utenti: UtenteTest[] = [];
  const sedi: string[] = [];
  let sedeA: string;
  let sedeB: string;

  /** Primo giorno del mese, tanti mesi fa: tutto quel mese è oltre i 30 giorni. */
  function primoDelMeseFa(mesi: number): string {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - mesi);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const MESE = primoDelMeseFa(4);
  const giorno = (n: number) => `${MESE.slice(0, 8)}${String(n).padStart(2, "0")}`;
  const G05 = giorno(5);
  const G12 = giorno(12);
  const G20 = giorno(20);

  /** Quanti giorni fa è una data: serve a scegliere dove cade la soglia. */
  function giorniFa(data: string): number {
    return Math.round((Date.parse(oggiRoma()) - Date.parse(data)) / 86_400_000);
  }

  async function personeDi(sedeId: string | null): Promise<number> {
    const q = servizio().from("persone_per_mese").select("persone").eq("mese", MESE);
    const { data } = await (sedeId === null ? q.is("sede_id", null) : q.eq("sede_id", sedeId))
      .maybeSingle();
    return data?.persone ?? 0;
  }

  // Un numero di posto diverso per ogni riga: l'indice unico di §8.1 non
  // ammette due volte lo stesso posto sullo stesso giorno e fascia.
  let posto = 0;
  async function prenota(
    u: UtenteTest,
    data: string,
    fascia: "MATTINA" | "POMERIGGIO",
    sedeId: string,
  ): Promise<string> {
    posto += 1;
    return inserisciPrenotazioneDiretta({
      utente_id: u.id,
      sede_id: sedeId,
      data,
      fascia,
      posto_progressivo: posto,
    });
  }

  /** Tre presenze nello stesso mese, di cui una giornata intera. Vale 1. */
  let ripetuta: UtenteTest;
  /** Una sola presenza. Vale 1. */
  let unaVolta: UtenteTest;
  /** Due sedi nello stesso mese: 1 su ciascuna, 1 sul totale. */
  let dueSedi: UtenteTest;
  /** Solo una giornata intera: due righe recise insieme, vale 1. */
  let giornataIntera: UtenteTest;
  /** Presenze agli estremi del mese: recise in due notti diverse. Vale 1. */
  let spalmata: UtenteTest;
  /** Una prenotazione annullata: non è una presenza, vale 0. */
  let annullata: UtenteTest;

  let totaleIniziale = 0;

  beforeAll(async () => {
    sedeA = await creaSede({ capienza: 50 });
    sedeB = await creaSede({ capienza: 50 });
    sedi.push(sedeA, sedeB);

    [ripetuta, unaVolta, dueSedi, giornataIntera, spalmata, annullata] = await Promise.all([
      creaUtente(),
      creaUtente(),
      creaUtente(),
      creaUtente(),
      creaUtente(),
      creaUtente(),
    ]);
    utenti.push(ripetuta, unaVolta, dueSedi, giornataIntera, spalmata, annullata);

    await prenota(ripetuta, G05, "MATTINA", sedeA);
    await prenota(ripetuta, G05, "POMERIGGIO", sedeA);
    await prenota(ripetuta, G12, "MATTINA", sedeA);

    await prenota(unaVolta, G05, "MATTINA", sedeA);

    // Due sedi lo stesso giorno: fasce diverse, perché §6.3 non ammette due
    // prenotazioni attive della stessa persona sulla stessa fascia.
    await prenota(dueSedi, G12, "MATTINA", sedeA);
    await prenota(dueSedi, G12, "POMERIGGIO", sedeB);

    await prenota(giornataIntera, G20, "MATTINA", sedeA);
    await prenota(giornataIntera, G20, "POMERIGGIO", sedeA);

    await prenota(spalmata, G05, "MATTINA", sedeA);
    await prenota(spalmata, G20, "MATTINA", sedeA);

    const idAnnullata = await prenota(annullata, G20, "POMERIGGIO", sedeA);
    await servizio().from("prenotazioni").update({ stato: "ANNULLATA" }).eq("id", idAnnullata);

    totaleIniziale = await personeDi(null);
  });

  afterAll(async () => {
    await pulisci({ utenti, sedi });
  });

  it("prima di recidere qualcosa il mese non ha ancora un conteggio di sede", async () => {
    expect(await personeDi(sedeA)).toBe(0);
    expect(await personeDi(sedeB)).toBe(0);
  });

  it("chi ha ancora una presenza in quel mese non viene contato troppo presto", async () => {
    // Soglia a metà mese: escono le presenze del 5, restano quelle del 12 e
    // del 20. Solo chi non ha più niente in quel mese viene contato.
    const { error } = await servizio().rpc("anonimizza_prenotazioni", {
      p_giorni: giorniFa(G12),
    });
    expect(error).toBeNull();

    // Contata: solo unaVolta. ripetuta ha ancora il 12, spalmata ha il 20.
    expect(await personeDi(sedeA)).toBe(1);
    expect(await personeDi(null)).toBe(totaleIniziale + 1);
  });

  it("al taglio seguente ciascuna persona è contata una volta sola", async () => {
    const { error } = await servizio().rpc("anonimizza_prenotazioni", {
      p_giorni: GIORNI_ANONIMIZZAZIONE,
    });
    expect(error).toBeNull();

    // Cinque persone hanno usato la sede A in quel mese: unaVolta, ripetuta
    // (tre presenze, una delle quali giornata intera), dueSedi, spalmata
    // (recisa in due notti diverse) e giornataIntera (due righe insieme).
    // La settima persona, quella annullata, non c'è stata.
    expect(await personeDi(sedeA)).toBe(5);
  });

  it("chi ha usato due sedi conta in entrambe, ma una volta sola nel totale", async () => {
    expect(await personeDi(sedeB)).toBe(1);
    // Totale: le stesse cinque persone della sede A. dueSedi non conta due
    // volte, quindi la somma delle sedi (5 + 1) è più alta del totale.
    expect(await personeDi(null)).toBe(totaleIniziale + 5);
  });

  it("un terzo giro non conta più niente: non c'è più niente da recidere", async () => {
    await servizio().rpc("anonimizza_prenotazioni", { p_giorni: GIORNI_ANONIMIZZAZIONE });
    expect(await personeDi(sedeA)).toBe(5);
    expect(await personeDi(null)).toBe(totaleIniziale + 5);
  });

  it("chiudendo un account il mese passato viene contato, quello futuro no", async () => {
    const u = await creaUtente();
    utenti.push(u);
    const meseFuturo = `${oggiRoma().slice(0, 8)}01`;

    await prenota(u, G12, "POMERIGGIO", sedeA);
    await prenota(u, aggiungiGiorni(oggiRoma(), 1), "MATTINA", sedeA);

    const primaFuturo = await servizio()
      .from("persone_per_mese")
      .select("persone")
      .eq("mese", meseFuturo)
      .eq("sede_id", sedeA)
      .maybeSingle();

    await cancellaMioAccount(u.client);

    // La presenza passata c'è stata: il mese guadagna una persona.
    expect(await personeDi(sedeA)).toBe(6);
    expect(await personeDi(null)).toBe(totaleIniziale + 6);

    // La prenotazione futura è stata annullata dalla cancellazione: non è
    // una presenza, e il mese in corso non guadagna niente.
    const dopoFuturo = await servizio()
      .from("persone_per_mese")
      .select("persone")
      .eq("mese", meseFuturo)
      .eq("sede_id", sedeA)
      .maybeSingle();
    expect(dopoFuturo.data?.persone ?? 0).toBe(primaFuturo.data?.persone ?? 0);
  });

  it("nessuna riga porta un'email, un nome pubblico o un identificativo", async () => {
    const { data } = await servizio().from("persone_per_mese").select("*").limit(1).single();
    expect(Object.keys(data ?? {}).sort()).toEqual(["id", "mese", "persone", "sede_id"]);
  });
});

// ---------------------------------------------------------------------------

describe("§7 le pulizie sono irraggiungibili da chi non è il mestiere", () => {
  const anon = visitatore();
  const utenti: UtenteTest[] = [];
  let u: UtenteTest;

  beforeAll(async () => {
    u = await creaUtente();
    utenti.push(u);
  });

  afterAll(async () => {
    await pulisci({ utenti });
  });

  const mestieri = [
    ["anonimizza_prenotazioni", { p_giorni: GIORNI_ANONIMIZZAZIONE }],
    ["avvisi_dormienza_da_inviare", { p_mesi: MESI_AVVISO_DORMIENZA }],
    [
      "cancella_account_dormienti",
      { p_mesi: MESI_ACCOUNT_DORMIENTE, p_mesi_avviso: MESI_AVVISO_DORMIENZA },
    ],
    ["cancella_richieste_incomplete", { p_ore: 24 }],
    ["cancella_impronte_scadute", {}],
    ["cancella_consensi_scaduti", { p_mesi: MESI_CONSERVAZIONE_CONSENSI }],
    ["conta_persone_in_uscita", { p_soglia: oggiRoma() }],
    // Le quattro di §15.11, aggiunte dal passo 20: stessa porta chiusa.
    ["anonimizza_iscrizioni", { p_giorni: GIORNI_ANONIMIZZAZIONE }],
    ["cancella_accessi_edizioni_chiuse", { p_giorni: GIORNI_CHIUSURA_EDIZIONE }],
    ["cancella_dati_abitanti", {}],
    ["cancella_tentativi_scaduti", {}],
  ] as const;

  // La chiamata è uniforme apposta: i tipi generati danno a ciascuna
  // pulizia la propria forma, ma qui conta solo che venga rifiutata.
  type ChiamataLibera = (nome: string, argomenti: object) => PromiseLike<{ error: unknown }>;
  function comeSeFosse(client: (typeof anon) | UtenteTest["client"]): ChiamataLibera {
    return client.rpc.bind(client) as unknown as ChiamataLibera;
  }

  for (const [nome, argomenti] of mestieri) {
    it(`${nome} è chiusa a chi non ha fatto accesso`, async () => {
      const { error } = await comeSeFosse(anon)(nome, argomenti);
      expect(error).not.toBeNull();
    });

    it(`${nome} è chiusa anche a chi ha fatto accesso`, async () => {
      const { error } = await comeSeFosse(u.client)(nome, argomenti);
      expect(error).not.toBeNull();
    });
  }

  it("la data di chiusura degli account non è leggibile da nessuno", async () => {
    const daFuori = await anon.from("account_chiusi").select("utente_id");
    expect(daFuori.error).not.toBeNull();
    const daDentro = await u.client.from("account_chiusi").select("utente_id");
    expect(daDentro.error).not.toBeNull();
  });

  // Il passo 12 aprirà questa tabella all'amministratore, insieme alle altre
  // statistiche. Finché non lo fa, non la legge nessuno.
  it("i conteggi delle persone per mese non sono ancora leggibili da nessuno", async () => {
    const daFuori = await anon.from("persone_per_mese").select("persone");
    expect(daFuori.error).not.toBeNull();
    const daDentro = await u.client.from("persone_per_mese").select("persone");
    expect(daDentro.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §15.11 — le quattro pulizie di «Prenota un abitante» (passo 20).
//
// Si agganciano allo stesso giro notturno, che resta uno solo (§15.1 punto 5).
// Tutto quello che il file già asserisce sulle prenotazioni deve continuare a
// valere: qui si aggiunge, non si tocca niente.
// ---------------------------------------------------------------------------

const COLONNE_STAT_ISCRIZIONE =
  "id, utente_id, anonimizzata, stat_eta, stat_genere, stat_professione, stat_motivo_visita, stat_residenza" as const;

async function iscrizione(id: string) {
  const { data } = await servizio()
    .from("iscrizioni")
    .select(COLONNE_STAT_ISCRIZIONE)
    .eq("id", id)
    .single();
  if (!data) throw new Error("iscrizione sparita");
  return data;
}

function statIscrizioneVuoti(riga: Awaited<ReturnType<typeof iscrizione>>): boolean {
  return (
    riga.stat_eta === null &&
    riga.stat_genere === null &&
    riga.stat_professione === null &&
    riga.stat_motivo_visita === null &&
    riga.stat_residenza === null
  );
}

describe("§15.11 anonimizzazione delle iscrizioni oltre 30 giorni dall'attività", () => {
  const utenti: UtenteTest[] = [];
  const edizioni: string[] = [];
  let conConsenso: UtenteTest;
  let senzaConsenso: UtenteTest;
  let daAnonimizzare: string;
  let senzaCinqueValori: string;
  let ancoraSua: string;

  beforeAll(async () => {
    const edizione = await creaEdizione({
      attiva: false,
      data_inizio: aggiungiGiorni(oggiRoma(), -(GIORNI_ANONIMIZZAZIONE + 40)),
      data_fine: aggiungiGiorni(oggiRoma(), 10),
    });
    edizioni.push(edizione);

    const vecchia = await creaAttivita({
      edizione_id: edizione,
      capienza: 4,
      data: aggiungiGiorni(oggiRoma(), -(GIORNI_ANONIMIZZAZIONE + 10)),
    });
    const recente = await creaAttivita({ edizione_id: edizione, capienza: 4, data: oggiRoma() });

    [conConsenso, senzaConsenso] = await Promise.all([creaUtente(), creaUtente()]);
    utenti.push(conConsenso, senzaConsenso);
    await aggiornaDatiFacoltativi(conConsenso.client, conConsenso.id, CINQUE_CAMPI);

    daAnonimizzare = await inserisciIscrizioneDiretta({
      attivita_id: vecchia,
      utente_id: conConsenso.id,
      posto_progressivo: 1,
    });
    senzaCinqueValori = await inserisciIscrizioneDiretta({
      attivita_id: vecchia,
      utente_id: senzaConsenso.id,
      posto_progressivo: 2,
    });
    ancoraSua = await inserisciIscrizioneDiretta({
      attivita_id: recente,
      utente_id: conConsenso.id,
      posto_progressivo: 1,
    });
  });

  afterAll(async () => {
    await pulisci({ utenti, edizioni });
  });

  it("prima del giro nessuna iscrizione porta un valore stat_", async () => {
    for (const id of [daAnonimizzare, senzaCinqueValori, ancoraSua]) {
      const riga = await iscrizione(id);
      expect(riga.anonimizzata, id).toBe(false);
      expect(statIscrizioneVuoti(riga), id).toBe(true);
    }
  });

  it("il giro recide il legame delle iscrizioni oltre 30 giorni dalla data dell'attività", async () => {
    const esito = await eseguiPulizie(servizio());
    expect(esito.falliti).toEqual([]);
    expect(esito.iscrizioniAnonimizzate).toBeGreaterThanOrEqual(2);

    const riga = await iscrizione(daAnonimizzare);
    expect(riga.utente_id).toBeNull();
    expect(riga.anonimizzata).toBe(true);
  });

  it("copia i cinque valori quando il consenso è attivo", async () => {
    const riga = await iscrizione(daAnonimizzare);
    expect(riga.stat_eta).toBe(CINQUE_CAMPI.eta);
    expect(riga.stat_genere).toBe(CINQUE_CAMPI.genere);
    expect(riga.stat_professione).toBe(CINQUE_CAMPI.professione);
    expect(riga.stat_motivo_visita).toBe(CINQUE_CAMPI.motivo_visita);
    expect(riga.stat_residenza).toBe(CINQUE_CAMPI.residenza);
  });

  it("non copia niente quando il consenso non c'è mai stato", async () => {
    const riga = await iscrizione(senzaCinqueValori);
    expect(riga.anonimizzata).toBe(true);
    expect(statIscrizioneVuoti(riga)).toBe(true);
  });

  it("lascia intatta l'iscrizione a un'attività non ancora passata", async () => {
    const riga = await iscrizione(ancoraSua);
    expect(riga.utente_id).toBe(conConsenso.id);
    expect(riga.anonimizzata).toBe(false);
    expect(statIscrizioneVuoti(riga)).toBe(true);
  });

  it("un secondo giro non ricopia e non torna indietro", async () => {
    const prima = await iscrizione(daAnonimizzare);
    await servizio().from("utenti").update(CINQUE_CAMPI).eq("id", senzaConsenso.id);
    await eseguiPulizie(servizio());

    expect(await iscrizione(daAnonimizzare)).toEqual(prima);
    // Già recisa al primo giro: il consenso arrivato dopo non la raggiunge
    // più (regola 19, "non ricopiare e non tornare indietro").
    expect(statIscrizioneVuoti(await iscrizione(senzaCinqueValori))).toBe(true);
  });
});

describe("§15.11 abilitazioni e codici di un'edizione chiusa", () => {
  const utenti: UtenteTest[] = [];
  const edizioni: string[] = [];
  let chi: UtenteTest;
  let chiusaDaTempo: string;
  let chiusaIeri: string;

  /** Un cartoncino, di cui resta solo l'impronta (§15.3.5). */
  async function cartoncino(edizione: string, progressivo: number): Promise<void> {
    const { error } = await servizio()
      .from("codici_invito")
      .insert({
        edizione_id: edizione,
        progressivo,
        impronta: "impronta-di-prova-" + randomUUID(),
      });
    if (error) throw new Error("cartoncino: " + error.code);
  }

  const conta = async (tabella: "abilitazioni" | "codici_invito", edizione: string) => {
    const { count } = await servizio()
      .from(tabella)
      .select("id", { count: "exact", head: true })
      .eq("edizione_id", edizione);
    return count ?? 0;
  };

  beforeAll(async () => {
    chi = await creaUtente();
    utenti.push(chi);

    chiusaDaTempo = await creaEdizione({
      attiva: false,
      data_inizio: aggiungiGiorni(oggiRoma(), -(GIORNI_CHIUSURA_EDIZIONE + 40)),
      data_fine: aggiungiGiorni(oggiRoma(), -(GIORNI_CHIUSURA_EDIZIONE + 1)),
    });
    chiusaIeri = await creaEdizione({
      attiva: false,
      data_inizio: aggiungiGiorni(oggiRoma(), -30),
      data_fine: aggiungiGiorni(oggiRoma(), -1),
    });
    edizioni.push(chiusaDaTempo, chiusaIeri);

    await abilita(chi.id, chiusaDaTempo);
    await abilita(chi.id, chiusaIeri);
    await cartoncino(chiusaDaTempo, 1);
    await cartoncino(chiusaIeri, 1);
  });

  afterAll(async () => {
    await pulisci({ utenti, edizioni });
  });

  it("prima del giro ci sono entrambe", async () => {
    expect(await conta("abilitazioni", chiusaDaTempo)).toBe(1);
    expect(await conta("codici_invito", chiusaDaTempo)).toBe(1);
  });

  it("spariscono abilitazione e impronta di un'edizione chiusa da abbastanza tempo", async () => {
    const esito = await eseguiPulizie(servizio());
    expect(esito.falliti).toEqual([]);
    expect(esito.accessiEdizioniChiuse).toBeGreaterThanOrEqual(2);

    expect(await conta("abilitazioni", chiusaDaTempo)).toBe(0);
    expect(await conta("codici_invito", chiusaDaTempo)).toBe(0);
  });

  it("restano quelle di un'edizione chiusa da poco", async () => {
    expect(await conta("abilitazioni", chiusaIeri)).toBe(1);
    expect(await conta("codici_invito", chiusaIeri)).toBe(1);
  });
});

describe("§15.11 i dati degli abitanti di un'edizione chiusa", () => {
  const edizioni: string[] = [];
  let cancellabile: string;
  let intatta: string;

  const campi =
    "titolo, descrizione, abitante_nome, abitante_cognome, abitante_telefono, abitante_note_interne, luogo_generico, luogo_esatto, cosa_portare, lingua_attivita, data, capienza, consenso_raccolto, consenso_modalita, consenso_raccolto_il" as const;

  const carta = async (id: string) => {
    const { data } = await servizio().from("attivita").select(campi).eq("id", id).single();
    if (!data) throw new Error("attività sparita");
    return data;
  };

  beforeAll(async () => {
    const finita = await creaEdizione({
      attiva: false,
      data_inizio: aggiungiGiorni(oggiRoma(), -30),
      data_fine: aggiungiGiorni(oggiRoma(), -1),
    });
    const inCorso = await creaEdizione({
      attiva: false,
      data_inizio: aggiungiGiorni(oggiRoma(), -1),
      data_fine: aggiungiGiorni(oggiRoma(), 20),
    });
    edizioni.push(finita, inCorso);

    cancellabile = await creaAttivita({
      edizione_id: finita,
      capienza: 6,
      data: aggiungiGiorni(oggiRoma(), -2),
      abitante_note_interne: "Nota interna di prova",
      cosa_portare: "Scarpe comode",
      lingua_attivita: "Italiano",
    });
    intatta = await creaAttivita({ edizione_id: inCorso, capienza: 6, data: oggiRoma() });
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
  });

  it("prima del giro la carta è piena", async () => {
    const prima = await carta(cancellabile);
    expect(prima.titolo).not.toBeNull();
    expect(prima.descrizione).not.toBeNull();
    expect(prima.abitante_cognome).not.toBeNull();
  });

  it("dopo il giro non resta nessuno dei tre livelli, titolo e descrizione compresi", async () => {
    const esito = await eseguiPulizie(servizio());
    expect(esito.falliti).toEqual([]);
    expect(esito.datiAbitantiCancellati).toBeGreaterThanOrEqual(1);

    const dopo = await carta(cancellabile);
    for (const campo of [
      "titolo",
      "descrizione",
      "abitante_nome",
      "abitante_cognome",
      "abitante_telefono",
      "abitante_note_interne",
      "luogo_generico",
      "luogo_esatto",
      "cosa_portare",
      "lingua_attivita",
    ] as const) {
      expect(dopo[campo], campo).toBeNull();
    }
  });

  it("restano la data, la capienza e la dichiarazione di consenso", async () => {
    const dopo = await carta(cancellabile);
    expect(dopo.data).toBe(aggiungiGiorni(oggiRoma(), -2));
    expect(dopo.capienza).toBe(6);
    expect(dopo.consenso_raccolto).toBe(true);
    expect(dopo.consenso_modalita).not.toBeNull();
    expect(dopo.consenso_raccolto_il).not.toBeNull();
  });

  it("un'edizione ancora aperta non viene toccata", async () => {
    const dopo = await carta(intatta);
    expect(dopo.titolo).not.toBeNull();
    expect(dopo.abitante_cognome).not.toBeNull();
    expect(dopo.descrizione).not.toBeNull();
  });

  it("un secondo giro non ha più niente da svuotare su quella carta", async () => {
    const prima = await carta(cancellabile);
    await eseguiPulizie(servizio());
    expect(await carta(cancellabile)).toEqual(prima);
  });
});

describe("§15.11 i tentativi di inserimento del codice durano un'ora", () => {
  const utenti: UtenteTest[] = [];
  let chi: UtenteTest;
  let vecchio: string;
  let appena: string;

  async function tentativo(utenteId: string, minutiFa: number): Promise<string> {
    const quando = new Date(Date.now() - minutiFa * 60_000).toISOString();
    const { data, error } = await servizio()
      .from("tentativi_codice")
      .insert({ utente_id: utenteId, tentato_il: quando })
      .select("id")
      .single();
    if (error) throw new Error("tentativo: " + error.code);
    return data.id;
  }

  const esisteTentativo = async (id: string) => {
    const { data } = await servizio()
      .from("tentativi_codice")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    return data !== null;
  };

  beforeAll(async () => {
    chi = await creaUtente();
    utenti.push(chi);
    vecchio = await tentativo(chi.id, 90);
    appena = await tentativo(chi.id, 5);
  });

  afterAll(async () => {
    await pulisci({ utenti });
  });

  it("un tentativo più vecchio di un'ora sparisce, uno appena fatto resta", async () => {
    expect(await esisteTentativo(vecchio)).toBe(true);

    const esito = await eseguiPulizie(servizio());
    expect(esito.falliti).toEqual([]);
    expect(esito.tentativiScaduti).toBeGreaterThanOrEqual(1);

    expect(await esisteTentativo(vecchio)).toBe(false);
    expect(await esisteTentativo(appena)).toBe(true);
  });
});
