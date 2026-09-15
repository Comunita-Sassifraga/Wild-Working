/**
 * SPEC §7, §8.4 — diritti dell'interessato (§12 step 10).
 *
 * Two rights, two halves of this file.
 *
 * "Scarica i miei dati" (art. 15, art. 20): the file carries the profile, the
 * bookings still linked to the person and their own consent rows — and never
 * another person's anything, never `posto_progressivo` (§8.1), never the
 * `stat_` columns (§5.3).
 *
 * "Cancella il mio account" (art. 17): bookings that can still be cancelled
 * are freed, every booking is cut loose WITHOUT copying stat_* (rule 19),
 * the consent register keeps its rows and gains the revocations, and the
 * account itself — profile and sign-in identity — is gone. Nobody can aim
 * the erasure at somebody else.
 *
 * Email addresses of test users are never printed (rule 4).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import { cancellaMioAccount, mieiDati } from "@/lib/db/diritti";
import { prenotaPosto } from "@/lib/db/prenotazioni";
import { aggiornaDatiFacoltativi, impostaNomePubblico } from "@/lib/db/utenti";
import {
  abilita,
  assegnaIncarico,
  creaAttivita,
  creaEdizione,
  creaSede,
  creaUtente,
  inserisciIscrizioneDiretta,
  inserisciPrenotazioneDiretta,
  pulisci,
  pulisciEdizioni,
  servizio,
  type UtenteTest,
} from "./setup/supabase";

const IERI = aggiungiGiorni(oggiRoma(), -1);
const DOMANI = aggiungiGiorni(oggiRoma(), 1);

/**
 * These fixtures book "yesterday" and "tomorrow" whatever day the suite runs
 * on, and a sede created with the default giorni_apertura (LUN–SAB) is shut
 * on Sundays: the file failed every Saturday. What it asserts is art. 15 and
 * art. 17, never the opening days, so its sedi open all week — the same
 * choice tests/chi-ce.test.ts and tests/booking-window.test.ts already make.
 */
const OGNI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;

async function consensiDi(utenteId: string) {
  const { data } = await servizio()
    .from("consensi")
    .select("tipo, valore")
    .eq("utente_id", utenteId)
    .order("data_ora");
  return data ?? [];
}

async function prenotazioniDi(utenteId: string) {
  const { data } = await servizio()
    .from("prenotazioni")
    .select("id, utente_id, stato, anonimizzata, data, stat_eta, stat_genere, stat_professione, stat_motivo_visita, stat_residenza")
    .eq("utente_id", utenteId);
  return data ?? [];
}

describe("§7 scarica i miei dati", () => {
  let sedeId: string;
  let u: UtenteTest;
  let altro: UtenteTest;
  const edizioni: string[] = [];

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 4, giorni_apertura: [...OGNI_GIORNO] });
    [u, altro] = await Promise.all([creaUtente(), creaUtente()]);

    await aggiornaDatiFacoltativi(u.client, u.id, {
      eta: "36-50",
      genere: "F",
      professione: "Falegname",
      motivo_visita: "Lavoro da remoto",
      residenza: "Valle Soana",
    });
    await impostaNomePubblico(u.client, { nome: "Ada", mostra: true });

    // One booking for tomorrow, one already past — both still linked.
    const esito = await prenotaPosto(u.client, { sedeId, data: DOMANI, fascia: "MATTINA" });
    if (!esito.ok) throw new Error("fixture booking failed");
    await inserisciPrenotazioneDiretta({
      utente_id: u.id,
      sede_id: sedeId,
      data: IERI,
      fascia: "POMERIGGIO",
    });
    await inserisciPrenotazioneDiretta({
      utente_id: altro.id,
      sede_id: sedeId,
      data: DOMANI,
      fascia: "POMERIGGIO",
    });

    // Un posto su un'attività di «Prenota un abitante» (§15.11): l'esporta-
    // zione deve portarlo, e deve portarne il solo livello 1 (regola 24).
    const edizione = await creaEdizione({
      data_inizio: aggiungiGiorni(oggiRoma(), -10),
      data_fine: aggiungiGiorni(oggiRoma(), 20),
    });
    edizioni.push(edizione);
    const attivita = await creaAttivita({ edizione_id: edizione, capienza: 4, data: DOMANI });
    await inserisciIscrizioneDiretta({ attivita_id: attivita, utente_id: u.id });
    await inserisciIscrizioneDiretta({
      attivita_id: attivita,
      utente_id: altro.id,
      posto_progressivo: 2,
    });
  });

  afterAll(async () => {
    await pulisci({ utenti: [u, altro], sedi: [sedeId], edizioni });
  });

  it("porta il profilo, le prenotazioni e il registro dei consensi", async () => {
    const dati = await mieiDati(u.client, u.id);
    expect(dati).not.toBeNull();
    expect(dati?.profilo.email).toBe(u.email);
    expect(dati?.profilo.nome_pubblico).toBe("Ada");
    expect(dati?.profilo.professione).toBe("Falegname");
    expect(dati?.profilo.residenza).toBe("Valle Soana");
    expect(dati?.generato_il).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // The past booking too: art. 15 is about everything still linked, not
    // only about what the booking window shows (§6.4).
    const giorni = (dati?.prenotazioni ?? []).map((p) => p.data).sort();
    expect(giorni).toEqual([IERI, DOMANI].sort());

    const tipi = (dati?.consensi ?? []).map((c) => `${c.tipo}:${c.valore}`);
    expect(tipi).toContain("DATI_FACOLTATIVI:DATO");
    expect(tipi).toContain("NOME_PUBBLICO:DATO");
  });

  it("porta anche le iscrizioni alle attività, con il solo livello 1", async () => {
    const dati = await mieiDati(u.client, u.id);
    expect(dati?.iscrizioni).toHaveLength(1);
    const iscrizione = dati!.iscrizioni[0];
    expect(iscrizione.data).toBe(DOMANI);
    expect(iscrizione.stato).toBe("ATTIVA");
    expect(iscrizione.titolo).not.toBeNull();
    expect(iscrizione.proposta_da).not.toBeNull();

    // §15.8: cognome, telefono e indirizzo esatto sono dati dell'abitante e
    // non finiscono in un file che si conserva per anni (regola 24).
    const colonne = Object.keys(iscrizione);
    for (const vietata of ["abitante_cognome", "abitante_telefono", "luogo_esatto", "note"]) {
      expect(colonne, vietata).not.toContain(vietata);
    }
  });

  it("non porta il numero del posto né i campi stat_, né per le prenotazioni né per le iscrizioni", async () => {
    const dati = await mieiDati(u.client, u.id);
    const testo = JSON.stringify(dati);
    expect(testo).not.toContain("posto_progressivo");
    expect(testo).not.toContain("stat_");
  });

  it("non porta niente di un'altra persona", async () => {
    const dati = await mieiDati(u.client, u.id);
    const testo = JSON.stringify(dati);
    expect(testo).not.toContain(altro.email);
    expect(testo).not.toContain(altro.id);
    // The other person's booking is on the same sede, same day: only the
    // access policy keeps it out. Same for the place on the same activity.
    expect(dati?.prenotazioni).toHaveLength(2);
    expect(dati?.iscrizioni).toHaveLength(1);
  });

  it("chiesto per un altro identificativo non restituisce i dati di quello", async () => {
    // The helper takes an id, but the policies pin every row to the caller:
    // asking for somebody else's returns nothing at all.
    const dati = await mieiDati(u.client, altro.id);
    expect(dati).toBeNull();
  });
});

describe("§7 art. 17 cancella il mio account", () => {
  let sedeId: string;
  let u: UtenteTest;
  let vicino: UtenteTest;
  let idFuturo: string;
  let idPassato: string;
  const edizioni: string[] = [];
  let iscrizioneFutura: string;
  let iscrizionePassata: string;
  let attivitaFutura: string;
  let codiceId: string;
  let tentativoId: string;

  beforeAll(async () => {
    // Capacity of one, so the freed seat can be claimed by somebody else.
    sedeId = await creaSede({ capienza: 1, giorni_apertura: [...OGNI_GIORNO] });
    [u, vicino] = await Promise.all([creaUtente(), creaUtente()]);
    await assegnaIncarico(u.id, "REFERENTE", sedeId);

    await aggiornaDatiFacoltativi(u.client, u.id, {
      eta: "26-35",
      genere: "M",
      professione: "Fotografo",
      motivo_visita: "Vacanza",
      residenza: "Canavese",
    });
    await impostaNomePubblico(u.client, { nome: "Bruno", mostra: true });

    const esito = await prenotaPosto(u.client, { sedeId, data: DOMANI, fascia: "MATTINA" });
    if (!esito.ok) throw new Error("fixture booking failed");
    idFuturo = esito.id;
    idPassato = await inserisciPrenotazioneDiretta({
      utente_id: u.id,
      sede_id: sedeId,
      data: IERI,
      fascia: "POMERIGGIO",
    });

    // A moderation row, so the check that it goes with the account (§5.9)
    // has something to find. Written directly: azzera_nome_pubblico() would
    // also switch the visibility off, and that would put a NOME_PUBBLICO
    // revocation in the register before the erasure had a chance to.
    const { error } = await servizio()
      .from("moderazioni")
      .insert({ utente_id: u.id, nome_rimosso: "Un nome qualsiasi" });
    if (error) throw new Error(`fixture moderazione failed: ${error.code}`);

    // Tutto quello che il modulo attacca a una persona (§15.12): un posto
    // futuro, uno passato, l'abilitazione, il cartoncino consumato e un
    // tentativo di inserimento del codice.
    const edizione = await creaEdizione({
      data_inizio: aggiungiGiorni(oggiRoma(), -10),
      data_fine: aggiungiGiorni(oggiRoma(), 20),
    });
    edizioni.push(edizione);
    // Capienza di uno anche qui, così il posto liberato si vede davvero.
    attivitaFutura = await creaAttivita({ edizione_id: edizione, capienza: 1, data: DOMANI });
    const attivitaPassata = await creaAttivita({
      edizione_id: edizione,
      capienza: 4,
      data: IERI,
    });
    iscrizioneFutura = await inserisciIscrizioneDiretta({
      attivita_id: attivitaFutura,
      utente_id: u.id,
    });
    iscrizionePassata = await inserisciIscrizioneDiretta({
      attivita_id: attivitaPassata,
      utente_id: u.id,
    });

    await abilita(u.id, edizione);

    const codice = await servizio()
      .from("codici_invito")
      .insert({
        edizione_id: edizione,
        progressivo: 7,
        impronta: "impronta-di-prova-diritti",
        utente_id: u.id,
        usato_il: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (codice.error) throw new Error(`fixture codice failed: ${codice.error.code}`);
    codiceId = codice.data.id;

    const tentativo = await servizio()
      .from("tentativi_codice")
      .insert({ utente_id: u.id })
      .select("id")
      .single();
    if (tentativo.error) throw new Error(`fixture tentativo failed: ${tentativo.error.code}`);
    tentativoId = tentativo.data.id;
  });

  afterAll(async () => {
    // u is already gone; its rows go with the sede.
    await pulisci({ utenti: [vicino], sedi: [sedeId] });
    await pulisciEdizioni(edizioni);
  });

  it("la cancellazione tocca solo chi la chiede", async () => {
    // The function takes no argument at all: there is nothing to aim at
    // somebody else. A stranger calling it erases the stranger.
    const estraneo = await creaUtente();
    const esito = await cancellaMioAccount(estraneo.client);
    expect(esito.ok).toBe(true);

    const s = servizio();
    const { data: andato } = await s.from("utenti").select("id").eq("id", estraneo.id).maybeSingle();
    expect(andato).toBeNull();
    const { data: rimasto } = await s.from("utenti").select("id").eq("id", u.id).maybeSingle();
    expect(rimasto?.id).toBe(u.id);
  });

  it("cancella l'account, il profilo e l'utenza di accesso", async () => {
    const esito = await cancellaMioAccount(u.client);
    expect(esito.ok).toBe(true);

    const { data: profilo } = await servizio().from("utenti").select("id").eq("id", u.id).maybeSingle();
    expect(profilo).toBeNull();

    // Without this a new sign-in link would build an empty profile back and
    // the account would still exist.
    const { data: utenza } = await servizio().auth.admin.getUserById(u.id);
    expect(utenza.user).toBeNull();
  });

  it("libera i posti delle prenotazioni non ancora cominciate", async () => {
    const { data } = await servizio()
      .from("prenotazioni")
      .select("stato, anonimizzata")
      .eq("id", idFuturo)
      .single();
    expect(data?.stato).toBe("ANNULLATA");
    expect(data?.anonimizzata).toBe(true);

    // The seat is really free: the sede holds one, and somebody else takes it.
    const ripresa = await prenotaPosto(vicino.client, { sedeId, data: DOMANI, fascia: "MATTINA" });
    expect(ripresa.ok).toBe(true);
  });

  it("anonimizza ogni prenotazione senza copiare i campi stat_", async () => {
    expect(await prenotazioniDi(u.id)).toHaveLength(0);

    const { data } = await servizio()
      .from("prenotazioni")
      .select("utente_id, anonimizzata, stat_eta, stat_genere, stat_professione, stat_motivo_visita, stat_residenza")
      .in("id", [idFuturo, idPassato]);

    expect(data).toHaveLength(2);
    for (const riga of data ?? []) {
      expect(riga.utente_id).toBeNull();
      expect(riga.anonimizzata).toBe(true);
      // Rule 19: an art. 17 erasure is honoured in full, never worked around
      // with a copy (§5.3).
      expect(riga.stat_eta).toBeNull();
      expect(riga.stat_genere).toBeNull();
      expect(riga.stat_professione).toBeNull();
      expect(riga.stat_motivo_visita).toBeNull();
      expect(riga.stat_residenza).toBeNull();
    }
  });

  it("una prenotazione passata resta nei conteggi, senza legame con la persona", async () => {
    const { data } = await servizio()
      .from("prenotazioni")
      .select("data, stato, utente_id")
      .eq("id", idPassato)
      .single();
    expect(data?.data).toBe(IERI);
    expect(data?.utente_id).toBeNull();
    // Not cancelled: that fascia had already begun, and that presence
    // happened (§6.4, §8.4).
    expect(data?.stato).toBe("ATTIVA");
  });

  it("il registro dei consensi resta e riceve le revoche", async () => {
    const righe = await consensiDi(u.id);
    const coppie = righe.map((c) => `${c.tipo}:${c.valore}`);
    expect(coppie).toContain("DATI_FACOLTATIVI:DATO");
    expect(coppie).toContain("NOME_PUBBLICO:DATO");
    // Decision of 2026-09-11, SPEC §5.5: the register follows the real state
    // of the processing, and with the account the processing ends.
    expect(coppie).toContain("DATI_FACOLTATIVI:REVOCATO");
    expect(coppie).toContain("NOME_PUBBLICO:REVOCATO");
  });

  it("porta via incarichi, moderazioni e conteggio dei cambi nome", async () => {
    const s = servizio();
    const { data: incarichi } = await s.from("incarichi").select("id").eq("utente_id", u.id);
    expect(incarichi ?? []).toHaveLength(0);
    const { data: moderazioni } = await s.from("moderazioni").select("id").eq("utente_id", u.id);
    expect(moderazioni ?? []).toHaveLength(0);
    const { data: cambi } = await s.from("cambi_nome").select("id").eq("utente_id", u.id);
    expect(cambi ?? []).toHaveLength(0);
  });

  it("il nome cancellato non compare più fra le presenze pubbliche", async () => {
    const { data } = await servizio().from("presenze_pubbliche").select("nome_pubblico").eq("sede_id", sedeId);
    expect((data ?? []).map((r) => r.nome_pubblico)).not.toContain("Bruno");
  });

  // -------------------------------------------------------------------------
  // §15.12 — la stessa cancellazione, per «Prenota un abitante» (passo 20).
  //
  // "Iscrizioni future annullate e posti liberati; iscrizioni passate
  // anonimizzate senza copiare i campi stat_; abilitazione e tentativi
  // cancellati. Del codice d'invito si cancella il collegamento alla persona,
  // non la riga."
  // -------------------------------------------------------------------------

  it("annulla l'iscrizione futura e libera il posto sull'attività", async () => {
    const { data } = await servizio()
      .from("iscrizioni")
      .select("stato, anonimizzata, annullata_il")
      .eq("id", iscrizioneFutura)
      .single();
    expect(data?.stato).toBe("ANNULLATA");
    expect(data?.anonimizzata).toBe(true);
    expect(data?.annullata_il).not.toBeNull();

    // Il posto è davvero libero: l'attività ne ha uno, e lo prende un altro.
    const { error } = await servizio()
      .from("iscrizioni")
      .insert({ attivita_id: attivitaFutura, utente_id: vicino.id, posto_progressivo: 1 });
    expect(error).toBeNull();
  });

  it("anonimizza ogni iscrizione senza copiare i campi stat_", async () => {
    const { data } = await servizio()
      .from("iscrizioni")
      .select("utente_id, anonimizzata, stat_eta, stat_genere, stat_professione, stat_motivo_visita, stat_residenza")
      .in("id", [iscrizioneFutura, iscrizionePassata]);

    expect(data).toHaveLength(2);
    for (const riga of data ?? []) {
      expect(riga.utente_id).toBeNull();
      expect(riga.anonimizzata).toBe(true);
      // Regola 19, identica a quella delle prenotazioni.
      expect(riga.stat_eta).toBeNull();
      expect(riga.stat_genere).toBeNull();
      expect(riga.stat_professione).toBeNull();
      expect(riga.stat_motivo_visita).toBeNull();
      expect(riga.stat_residenza).toBeNull();
    }
  });

  it("un'iscrizione a un'attività già cominciata resta attiva, senza legame", async () => {
    const { data } = await servizio()
      .from("iscrizioni")
      .select("stato, utente_id")
      .eq("id", iscrizionePassata)
      .single();
    expect(data?.utente_id).toBeNull();
    // Non annullata: quell'attività c'è stata (§15.7, come §6.4).
    expect(data?.stato).toBe("ATTIVA");
  });

  it("porta via abilitazione e tentativi di inserimento del codice", async () => {
    const s = servizio();
    const { data: abilitazioni } = await s.from("abilitazioni").select("id").eq("utente_id", u.id);
    expect(abilitazioni ?? []).toHaveLength(0);
    const { data: tentativi } = await s.from("tentativi_codice").select("id").eq("id", tentativoId);
    expect(tentativi ?? []).toHaveLength(0);
  });

  it("del cartoncino resta la riga, senza la persona: il numero non si riemette", async () => {
    const { data } = await servizio()
      .from("codici_invito")
      .select("id, progressivo, impronta, usato_il, utente_id")
      .eq("id", codiceId)
      .single();
    expect(data).not.toBeNull();
    expect(data?.utente_id).toBeNull();
    // §15.3.5, regola 23: il progressivo resta consumato.
    expect(data?.progressivo).toBe(7);
    expect(data?.usato_il).not.toBeNull();
    // E della riga che resta non si ricava nulla di nessuno.
    expect(data?.impronta).toBe("impronta-di-prova-diritti");
  });
});
