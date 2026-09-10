/**
 * SPEC §6.5 — nome pubblico: validazione, elenco dei termini vietati, limite
 * dei cambi al giorno.
 *
 * Questo file copre tutti e tre i livelli: il filtro in scrittura con
 * l'elenco dei termini e il limite dei cambi, l'avviso all'amministratore, e
 * l'azzeramento con l'email che ne informa la persona. Gli ultimi due hanno
 * avuto bisogno del fornitore di posta, costruito al passo 9.
 *
 * Le email finiscono in Mailpit (vitest.config.mts impone POSTA_LOCALE).
 * Nessun indirizzo viene stampato (CLAUDE.md regola 4).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMAIL_MITTENTE, EMAIL_MODERAZIONE, MAX_CAMBI_NOME_GIORNO } from "@/config/limits";
import { oggiRoma } from "@/lib/dates";
import { azzeraNomePubblico } from "@/lib/db/amministrazione";
import { m } from "@/lib/messaggi";
import { avvisaModerazione, avvisaNomeRimosso } from "@/lib/posta/avvisi";
import {
  aggiornaDatiFacoltativi,
  impostaMostraNomePubblico,
  impostaNomePubblico,
  MAX_CARATTERI_NOME,
  mioProfilo,
} from "@/lib/db/utenti";
import {
  ambienteNelProcesso,
  assegnaIncarico,
  attendiEmail,
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

const TERMINE = "idiota";

/** La casella del Direttivo (§10). vitest.config.mts ne impone una di prova. */
const MODERAZIONE = EMAIL_MODERAZIONE ?? "";

describe("§6.5 nome pubblico e moderazione", () => {
  const anon = visitatore();
  let u: UtenteTest;
  let cambi: UtenteTest;
  let admin: UtenteTest;

  /**
   * A person may change their name MAX_CAMBI_NOME_GIORNO times a day, and
   * that limit is the point of half this file: every test that needs a
   * *successful* save takes a fresh person, so that one test never eats the
   * allowance of the next. Refused saves cost nothing — the whole call rolls
   * back — so they all share `u`.
   */
  const usaEGetta: UtenteTest[] = [];
  /** Sedi create per la prova dell'azzeramento, rimosse alla fine. */
  const sedi: string[] = [];
  async function utenteNuovo(): Promise<UtenteTest> {
    const nuovo = await creaUtente();
    usaEGetta.push(nuovo);
    return nuovo;
  }

  beforeAll(async () => {
    // avvisaNomeRimosso() costruisce da sé il client di servizio, per leggere
    // un indirizzo che l'amministratore non può vedere (§6.7).
    ambienteNelProcesso();
    expect(MODERAZIONE).not.toBe("");
    [u, cambi, admin] = await Promise.all([creaUtente(), creaUtente(), creaUtente()]);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
  });

  afterAll(async () => {
    await servizio().from("termini_vietati").delete().eq("termine", TERMINE);
    await pulisci({ utenti: [u, cambi, admin, ...usaEGetta], sedi });
  });

  // -------------------------------------------------------------------------
  // Formato del nome (§6.5, regole tecniche)
  // -------------------------------------------------------------------------

  it("salva un nome normale e lo restituisce", async () => {
    const esito = await impostaNomePubblico(u.client, { nome: "  Pia Rossi  ", mostra: true });
    expect(esito.ok && esito.nome).toBe("Pia Rossi");
    expect(esito.ok && esito.mostra).toBe(true);
  });

  it("rifiuta un nome più lungo del massimo", async () => {
    const esito = await impostaNomePubblico(u.client, {
      nome: "a".repeat(MAX_CARATTERI_NOME + 1),
      mostra: true,
    });
    expect(esito).toMatchObject({ ok: false, motivo: "TROPPO_LUNGO" });
  });

  it.each([
    ["un indirizzo email", "scrivimi@example.com"],
    ["un link", "https://sassifraga.org"],
    ["un indirizzo di sito senza protocollo", "www.sassifraga.org"],
    ["un dominio nudo", "Pia su sassifraga.org"],
    ["un numero di telefono", "Pia 333 123 4567"],
    ["un prefisso internazionale", "Pia +39"],
  ])("rifiuta un nome che contiene %s", async (_caso, nome) => {
    const esito = await impostaNomePubblico(u.client, { nome, mostra: true });
    expect(esito).toMatchObject({ ok: false, motivo: "CONTIENE_CONTATTO" });
  });

  it.each(["Pia 90", "Chiara B.", "Anna del Bar Soana"])(
    "lascia passare «%s»",
    async (nome) => {
      const chi = await utenteNuovo();
      const esito = await impostaNomePubblico(chi.client, { nome, mostra: true });
      expect(esito.ok, nome).toBe(true);
    },
  );

  it("un nome rifiutato non cambia quello salvato", async () => {
    const esito = await impostaNomePubblico(u.client, { nome: "scrivimi@example.com", mostra: true });
    expect(esito.ok).toBe(false);
    const { data } = await mioProfilo(u.client, u.id);
    expect(data?.nome_pubblico).toBe("Pia Rossi");
  });

  it("il nome non si scrive per nessun'altra strada che la funzione", async () => {
    const { error } = await u.client
      .from("utenti")
      .update({ nome_pubblico: "Scorciatoia" })
      .eq("id", u.id);
    expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);
  });

  // -------------------------------------------------------------------------
  // Elenco dei termini vietati (§6.5, livello 1)
  // -------------------------------------------------------------------------

  it("l'elenco dei termini è irraggiungibile al visitatore e a un utente qualsiasi", async () => {
    // Il visitatore non ha nemmeno il permesso sulla tabella; l'utente
    // registrato ce l'ha, ma la politica di accesso non gli lascia vedere
    // nessuna riga. In entrambi i casi l'elenco non esce.
    const { error } = await anon.from("termini_vietati").select("termine");
    expect(error?.code, "visitatore").toBe(CODICE_PERMESSO_NEGATO);

    await servizio().from("termini_vietati").insert({ termine: "riga di prova" });
    const { data, error: erroreUtente } = await u.client.from("termini_vietati").select("termine");
    expect(erroreUtente).toBeNull();
    expect(data, "utente").toEqual([]);
    await servizio().from("termini_vietati").delete().eq("termine", "riga di prova");
  });

  it("l'amministratore aggiunge un termine senza toccare il codice", async () => {
    const { error } = await admin.client.from("termini_vietati").insert({ termine: TERMINE });
    expect(error).toBeNull();
    const { data } = await admin.client.from("termini_vietati").select("termine").eq("termine", TERMINE);
    expect(data?.length).toBe(1);
  });

  it("un nome che contiene un termine vietato è rifiutato, ovunque si trovi", async () => {
    for (const nome of ["Idiota", "IDIOTA", "Idiòta", "seiunidiota", "idiota77"]) {
      const esito = await impostaNomePubblico(u.client, { nome, mostra: true });
      expect(esito, nome).toMatchObject({ ok: false, motivo: "NON_CONSENTITO" });
    }
  });

  it("un nome che non lo contiene passa", async () => {
    const chi = await utenteNuovo();
    const esito = await impostaNomePubblico(chi.client, { nome: "Chiara Bianchi", mostra: true });
    expect(esito.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Limite dei cambi al giorno (§6.5, livello 2; §10)
  // -------------------------------------------------------------------------

  it(`accetta ${MAX_CAMBI_NOME_GIORNO} cambi in un giorno e rifiuta il successivo`, async () => {
    for (let i = 1; i <= MAX_CAMBI_NOME_GIORNO; i++) {
      const esito = await impostaNomePubblico(cambi.client, { nome: `Nome ${i}`, mostra: true });
      expect(esito.ok, `cambio ${i}`).toBe(true);
    }
    const oltre = await impostaNomePubblico(cambi.client, { nome: "Nome di troppo", mostra: true });
    expect(oltre).toMatchObject({ ok: false, motivo: "TROPPI_CAMBI" });

    const { data } = await mioProfilo(cambi.client, cambi.id);
    expect(data?.nome_pubblico).toBe(`Nome ${MAX_CAMBI_NOME_GIORNO}`);
  });

  it("risalvare lo stesso nome non consuma un cambio", async () => {
    const esito = await impostaNomePubblico(cambi.client, {
      nome: `Nome ${MAX_CAMBI_NOME_GIORNO}`,
      mostra: false,
    });
    expect(esito).toMatchObject({ ok: true, mostra: false });
  });

  it("accendere e spegnere l'interruttore non consuma il limite", async () => {
    const chi = await utenteNuovo();
    for (let i = 0; i < MAX_CAMBI_NOME_GIORNO + 2; i++) {
      const { error } = await impostaMostraNomePubblico(chi.client, chi.id, i % 2 === 0);
      expect(error).toBeNull();
    }
    const esito = await impostaNomePubblico(chi.client, { nome: "Nadia", mostra: true });
    expect(esito.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Schermata del primo accesso (§6.1 punto 5): nome pubblico e cinque campi
  // insieme. Un nome rifiutato non deve portarsi via quello che è già stato
  // compilato.
  // -------------------------------------------------------------------------

  it("un nome rifiutato lascia intatti i dati facoltativi salvati prima", async () => {
    const chi = await utenteNuovo();
    await aggiornaDatiFacoltativi(chi.client, chi.id, {
      eta: "36-50",
      professione: "Guida escursionistica",
    });
    const esito = await impostaNomePubblico(chi.client, {
      nome: "www.esempio.it",
      mostra: true,
    });
    expect(esito).toMatchObject({ ok: false, motivo: "CONTIENE_CONTATTO" });

    const { data } = await mioProfilo(chi.client, chi.id);
    expect(data?.eta).toBe("36-50");
    expect(data?.professione).toBe("Guida escursionistica");
    // Il nome e l'interruttore si salvano insieme: se il nome è rifiutato,
    // non resta acceso nemmeno l'interruttore.
    expect(data?.nome_pubblico).toBeNull();
    expect(data?.mostra_nome_pubblico).toBe(false);
  });

  it("nome e cinque campi insieme registrano entrambi i consensi", async () => {
    const chi = await utenteNuovo();
    await aggiornaDatiFacoltativi(chi.client, chi.id, { eta: "26-35" });
    const esito = await impostaNomePubblico(chi.client, { nome: "Nadia Ferrero", mostra: true });
    expect(esito.ok).toBe(true);

    const { data } = await servizio()
      .from("consensi")
      .select("tipo, valore")
      .eq("utente_id", chi.id)
      .order("data_ora");
    expect(data).toEqual([
      { tipo: "DATI_FACOLTATIVI", valore: "DATO" },
      { tipo: "NOME_PUBBLICO", valore: "DATO" },
    ]);
  });

  it("il registro dei cambi non è leggibile da nessuno", async () => {
    for (const [chi, client] of [
      ["visitatore", anon],
      ["utente", u.client],
      ["amministratore", admin.client],
    ] as const) {
      const { error } = await client.from("cambi_nome").select("utente_id");
      expect(error?.code, chi).toBe(CODICE_PERMESSO_NEGATO);
    }
  });

  // -------------------------------------------------------------------------
  // Azzeramento da parte dell'amministratore (§6.5, livello 3)
  //
  // La schermata che lo comanda è verificata in tests/amministrazione.test.ts.
  // Qui si controlla la sostanza della regola di §6.5: cosa succede alla
  // persona, e soprattutto cosa non le succede.
  // -------------------------------------------------------------------------

  it("l'azzeramento svuota il nome, spegne la spunta, avvisa la persona e non tocca le sue prenotazioni", async () => {
    const chi = await utenteNuovo();
    await impostaNomePubblico(chi.client, { nome: "Nome Da Moderare", mostra: true });

    const sedeId = await creaSede({ capienza: 2 });
    sedi.push(sedeId);
    const prenotazione = await inserisciPrenotazioneDiretta({
      utente_id: chi.id,
      sede_id: sedeId,
      data: oggiRoma(),
      fascia: "MATTINA",
    });

    const esito = await azzeraNomePubblico(admin.client, chi.id);
    expect(esito).toMatchObject({ ok: true, valore: "Nome Da Moderare" });

    const { data } = await mioProfilo(chi.client, chi.id);
    expect(data?.nome_pubblico).toBeNull();
    expect(data?.mostra_nome_pubblico).toBe(false);
    // L'avviso che la persona legge nelle impostazioni al primo accesso
    // successivo. L'email che dice la stessa cosa arriva al passo 9.
    expect(data?.avviso_moderazione).not.toBeNull();

    // "L'azzeramento non cancella le prenotazioni e non chiude l'account."
    const { data: dopo } = await servizio()
      .from("prenotazioni")
      .select("stato")
      .eq("id", prenotazione)
      .single();
    expect(dopo?.stato).toBe("ATTIVA");

    // E resta registrato: chi, quando, quale nome (§5.9, §6.7).
    const { data: registro } = await admin.client
      .from("moderazioni")
      .select("nome_rimosso, amministratore_id")
      .eq("utente_id", chi.id);
    expect(registro).toEqual([
      { nome_rimosso: "Nome Da Moderare", amministratore_id: admin.id },
    ]);
  });

  it("solo l'amministratore può azzerare un nome", async () => {
    const chi = await utenteNuovo();
    await impostaNomePubblico(chi.client, { nome: "Nome Protetto", mostra: true });

    expect(await azzeraNomePubblico(u.client, chi.id)).toMatchObject({
      ok: false,
      motivo: "NON_AUTORIZZATO",
    });
    // Nemmeno la persona sulla propria riga: la sua strada è cambiare nome.
    expect(await azzeraNomePubblico(chi.client, chi.id)).toMatchObject({ ok: false });

    const { data } = await mioProfilo(chi.client, chi.id);
    expect(data?.nome_pubblico).toBe("Nome Protetto");
  });

  // -------------------------------------------------------------------------
  // Livello 2, l'avviso all'amministratore — costruito al passo 9.
  //
  // Chi decide se l'email parte è il database: `cambiato` dice se il testo del
  // nome è davvero cambiato. `salvaComeLaPagina` fa esattamente quello che fa
  // la Server Action delle impostazioni, e nient'altro.
  // -------------------------------------------------------------------------

  async function salvaComeLaPagina(chi: UtenteTest, nome: string) {
    const esito = await impostaNomePubblico(chi.client, { nome, mostra: true });
    if (esito.ok && esito.cambiato && esito.nome) {
      await avvisaModerazione({ nomePubblico: esito.nome, utenteId: chi.id });
    }
    return esito;
  }

  it("un nome salvato o cambiato manda una sola email a EMAIL_MODERAZIONE, con nome_pubblico e utente_id e nessun indirizzo", async () => {
    const chi = await utenteNuovo();
    const prima = await contaEmail(MODERAZIONE);

    await salvaComeLaPagina(chi, "Nome Da Controllare");

    const email = await attendiEmail(MODERAZIONE, prima);
    expect(email.testo).toContain("Nome Da Controllare");
    expect(email.testo).toContain(chi.id);
    // "L'email non contiene l'indirizzo email dell'utente, né alcun altro suo
    // dato": l'identificativo interno basta ad agire (§6.5, regola 4).
    expect(email.testo).not.toContain(chi.email);
    expect(email.testo).not.toContain("@example.com");

    // Risalvare lo stesso nome non è una modifica: non manda niente.
    await salvaComeLaPagina(chi, "Nome Da Controllare");
    expect(await nessunaEmailOltre(MODERAZIONE, prima + 1)).toBe(0);

    // Nemmeno spegnere e riaccendere la spunta della visibilità.
    await impostaMostraNomePubblico(chi.client, chi.id, false);
    await impostaMostraNomePubblico(chi.client, chi.id, true);
    expect(await nessunaEmailOltre(MODERAZIONE, prima + 1)).toBe(0);

    // Un nome davvero diverso, invece, sì.
    await salvaComeLaPagina(chi, "Nome Diverso");
    await attendiEmail(MODERAZIONE, prima + 1);
  });

  it("il cambio di troppo nella giornata non manda nessun avviso", async () => {
    const chi = await utenteNuovo();
    const prima = await contaEmail(MODERAZIONE);

    for (let n = 1; n <= MAX_CAMBI_NOME_GIORNO; n++) {
      expect((await salvaComeLaPagina(chi, `Nome numero ${n}`)).ok).toBe(true);
    }
    await attendiEmail(MODERAZIONE, prima + MAX_CAMBI_NOME_GIORNO - 1);

    const oltre = await salvaComeLaPagina(chi, "Nome di troppo");
    expect(oltre).toMatchObject({ ok: false, motivo: "TROPPI_CAMBI" });
    expect(await nessunaEmailOltre(MODERAZIONE, prima + MAX_CAMBI_NOME_GIORNO)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Livello 3, l'avviso alla persona — anch'esso al passo 9.
  // -------------------------------------------------------------------------

  it("l'azzeramento manda alla persona l'email di §6.5, con lo stesso testo dell'avviso nelle impostazioni", async () => {
    const chi = await utenteNuovo();
    await impostaNomePubblico(chi.client, { nome: "Nome Da Togliere", mostra: true });

    expect((await azzeraNomePubblico(admin.client, chi.id)).ok).toBe(true);
    // Quello che fa la Server Action del pannello, subito dopo l'azzeramento.
    expect(await avvisaNomeRimosso(chi.id)).toMatchObject({ ok: true });

    const email = await attendiEmail(chi.email);
    expect(email.da).toBe(EMAIL_MITTENTE);
    expect(email.oggetto).toBe(m.posta.azzeramento.oggetto);
    // Lo stesso testo che la persona ritrova nelle impostazioni: una fonte
    // sola, così le due frasi non possono divergere.
    expect(email.testo).toBe(m.impostazioni.moderazione.testo);
  });
});
