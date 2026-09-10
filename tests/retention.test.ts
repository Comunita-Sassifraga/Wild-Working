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
  MESI_ACCOUNT_DORMIENTE,
  MESI_AVVISO_DORMIENZA,
  MESI_CONSERVAZIONE_CONSENSI,
} from "@/config/limits";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import { cancellaMioAccount } from "@/lib/db/diritti";
import { aggiornaDatiFacoltativi, rimuoviDatiFacoltativi } from "@/lib/db/utenti";
import { eseguiPulizie } from "@/lib/pulizie";
import {
  CODICE_PERMESSO_NEGATO,
  contaEmail,
  creaSede,
  creaUtente,
  inserisciPrenotazioneDiretta,
  nessunaEmailOltre,
  pulisci,
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
});
