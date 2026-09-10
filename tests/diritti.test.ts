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
  assegnaIncarico,
  creaSede,
  creaUtente,
  inserisciPrenotazioneDiretta,
  pulisci,
  servizio,
  type UtenteTest,
} from "./setup/supabase";

const IERI = aggiungiGiorni(oggiRoma(), -1);
const DOMANI = aggiungiGiorni(oggiRoma(), 1);

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

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 4 });
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
  });

  afterAll(async () => {
    await pulisci({ utenti: [u, altro], sedi: [sedeId] });
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

  it("non porta il numero del posto né i campi stat_", async () => {
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
    // access policy keeps it out.
    expect(dati?.prenotazioni).toHaveLength(2);
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

  beforeAll(async () => {
    // Capacity of one, so the freed seat can be claimed by somebody else.
    sedeId = await creaSede({ capienza: 1 });
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
  });

  afterAll(async () => {
    // u is already gone; its rows go with the sede.
    await pulisci({ utenti: [vicino], sedi: [sedeId] });
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
});
