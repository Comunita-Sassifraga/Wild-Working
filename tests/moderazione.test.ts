/**
 * SPEC §6.5 — nome pubblico: validazione, elenco dei termini vietati, limite
 * dei cambi al giorno.
 *
 * Questo file copre il primo dei tre livelli di moderazione, l'unico che
 * esiste al passo 6. L'avviso all'amministratore (passo 9, serve il fornitore
 * di posta) e l'azzeramento dal pannello (passo 8) restano in fondo come
 * `it.todo`: si vedono a ogni esecuzione finché non saranno costruiti.
 *
 * Nessun indirizzo email viene stampato (CLAUDE.md regola 4).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_CAMBI_NOME_GIORNO } from "@/config/limits";
import {
  aggiornaDatiFacoltativi,
  impostaMostraNomePubblico,
  impostaNomePubblico,
  MAX_CARATTERI_NOME,
  mioProfilo,
} from "@/lib/db/utenti";
import {
  assegnaIncarico,
  CODICE_PERMESSO_NEGATO,
  creaUtente,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const TERMINE = "idiota";

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
  async function utenteNuovo(): Promise<UtenteTest> {
    const nuovo = await creaUtente();
    usaEGetta.push(nuovo);
    return nuovo;
  }

  beforeAll(async () => {
    [u, cambi, admin] = await Promise.all([creaUtente(), creaUtente(), creaUtente()]);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
  });

  afterAll(async () => {
    await servizio().from("termini_vietati").delete().eq("termine", TERMINE);
    await pulisci({ utenti: [u, cambi, admin, ...usaEGetta] });
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
  // Livelli 2 e 3: esistono nei passi che portano il loro contesto.
  // -------------------------------------------------------------------------

  it.todo(
    "passo 9 — un nome salvato o cambiato manda una sola email a EMAIL_MODERAZIONE, con nome_pubblico e utente_id e nessun indirizzo email",
  );
  it.todo(
    "passo 8 — l'azzeramento dell'amministratore svuota il nome, spegne mostra_nome_pubblico, avvisa l'utente e non tocca le sue prenotazioni",
  );
});
