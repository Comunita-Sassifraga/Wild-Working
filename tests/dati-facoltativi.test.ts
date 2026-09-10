/**
 * SPEC §5.1, §5.5, §6.5 — the five optional fields.
 *
 * Unreachable from any anonymous query, from the public views and from the
 * referente view; registration completes with all of them empty; revocation
 * clears all five and writes a DATI_FACOLTATIVI revocation row.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { oggiRoma } from "@/lib/dates";
import { prenotaPosto } from "@/lib/db/prenotazioni";
import { aggiornaDatiFacoltativi, CAMPI_FACOLTATIVI, mioProfilo, rimuoviDatiFacoltativi } from "@/lib/db/utenti";
import {
  assegnaIncarico,
  CODICE_PERMESSO_NEGATO,
  creaSede,
  creaUtente,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

async function consensiDi(utenteId: string) {
  const { data } = await servizio()
    .from("consensi")
    .select("tipo, valore")
    .eq("utente_id", utenteId)
    .eq("tipo", "DATI_FACOLTATIVI")
    .order("data_ora");
  return (data ?? []).map((r) => r.valore);
}

describe("§6.5 dati facoltativi", () => {
  const anon = visitatore();
  let sedeId: string;
  let u: UtenteTest;
  let referente: UtenteTest;
  let admin: UtenteTest;

  beforeAll(async () => {
    sedeId = await creaSede({ capienza: 3 });
    [u, referente, admin] = await Promise.all([creaUtente(), creaUtente(), creaUtente()]);
    await assegnaIncarico(referente.id, "REFERENTE", sedeId);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
    await servizio().from("utenti").update({ nome_pubblico: "Ugo", mostra_nome_pubblico: true }).eq("id", u.id);
    const esito = await prenotaPosto(u.client, { sedeId, data: oggiRoma(), fascia: "MATTINA" });
    if (!esito.ok) throw new Error("fixture booking failed");
  });

  afterAll(async () => {
    await pulisci({ utenti: [u, referente, admin], sedi: [sedeId] });
  });

  it("la registrazione si completa con tutti e cinque i campi vuoti e nessun consenso", async () => {
    const { data, error } = await mioProfilo(u.client, u.id);
    expect(error).toBeNull();
    for (const campo of CAMPI_FACOLTATIVI) expect(data?.[campo]).toBeNull();
    expect(await consensiDi(u.id)).toEqual([]);
  });

  it("il visitatore non raggiunge nessuno dei cinque campi", async () => {
    for (const campo of CAMPI_FACOLTATIVI) {
      const { error } = await anon.from("utenti").select(campo);
      expect(error?.code, campo).toBe(CODICE_PERMESSO_NEGATO);
    }
  });

  it("le viste pubbliche non contengono i cinque campi", async () => {
    await aggiornaDatiFacoltativi(u.client, u.id, { eta: "36-50", residenza: "Valle Soana" });
    const presenze = await anon.from("presenze_pubbliche").select("*").eq("sede_id", sedeId);
    const occupazione = await anon.from("occupazione_pubblica").select("*").eq("sede_id", sedeId);
    const sedi = await anon.from("sedi_pubbliche").select("*").eq("id", sedeId);
    for (const { data } of [presenze, occupazione, sedi]) {
      expect(data?.length).toBeGreaterThan(0);
      for (const riga of data ?? []) {
        for (const campo of CAMPI_FACOLTATIVI) expect(riga).not.toHaveProperty(campo);
      }
    }
  });

  it("la vista del referente e quella dell'amministratore non contengono i cinque campi", async () => {
    const { data: perReferente } = await referente.client.from("prenotazioni_referente").select("*").eq("sede_id", sedeId);
    expect(perReferente?.length).toBe(1);
    const { data: perAdmin } = await admin.client.from("utenti_amministrazione").select("*").eq("id", u.id);
    expect(perAdmin?.length).toBe(1);
    for (const riga of [...(perReferente ?? []), ...(perAdmin ?? [])]) {
      for (const campo of CAMPI_FACOLTATIVI) expect(riga).not.toHaveProperty(campo);
    }
  });

  it("il referente e l'amministratore non leggono i cinque campi dalla tabella utenti", async () => {
    for (const chi of [referente, admin]) {
      const { data } = await chi.client.from("utenti").select("id, eta, residenza").eq("id", u.id);
      expect(data).toEqual([]);
    }
  });

  it("compilare almeno un campo registra il consenso una sola volta", async () => {
    // eta and residenza were set by an earlier test: exactly one DATO so far.
    expect(await consensiDi(u.id)).toEqual(["DATO"]);
    await aggiornaDatiFacoltativi(u.client, u.id, { professione: "Guida escursionistica" });
    expect(await consensiDi(u.id)).toEqual(["DATO"]);
  });

  it("\"Rimuovi i miei dati facoltativi\" svuota tutti e cinque i campi e registra la revoca", async () => {
    await aggiornaDatiFacoltativi(u.client, u.id, { genere: "Preferisco non rispondere", motivo_visita: "Lavoro" });
    const { data, error } = await rimuoviDatiFacoltativi(u.client, u.id);
    expect(error).toBeNull();
    for (const campo of CAMPI_FACOLTATIVI) expect(data?.[campo]).toBeNull();
    expect(await consensiDi(u.id)).toEqual(["DATO", "REVOCATO"]);
  });

  it("svuotare i campi uno alla volta equivale a una revoca (§5.5)", async () => {
    await aggiornaDatiFacoltativi(u.client, u.id, { eta: "18-25", genere: "F" });
    expect(await consensiDi(u.id)).toEqual(["DATO", "REVOCATO", "DATO"]);
    await aggiornaDatiFacoltativi(u.client, u.id, { eta: null });
    expect(await consensiDi(u.id)).toEqual(["DATO", "REVOCATO", "DATO"]);
    await aggiornaDatiFacoltativi(u.client, u.id, { genere: null });
    expect(await consensiDi(u.id)).toEqual(["DATO", "REVOCATO", "DATO", "REVOCATO"]);
  });

  it("una stringa vuota vale come campo vuoto", async () => {
    await aggiornaDatiFacoltativi(u.client, u.id, { professione: "   " });
    const { data } = await mioProfilo(u.client, u.id);
    expect(data?.professione).toBeNull();
    expect(await consensiDi(u.id)).toEqual(["DATO", "REVOCATO", "DATO", "REVOCATO"]);
  });

  it("i campi stat_* delle prenotazioni non sono leggibili da nessun utente", async () => {
    for (const chi of [u, referente, admin]) {
      for (const colonna of ["stat_eta", "stat_genere", "stat_professione", "stat_motivo_visita", "stat_residenza"] as const) {
        const { error } = await chi.client.from("prenotazioni").select(colonna);
        expect(error?.code, colonna).toBe(CODICE_PERMESSO_NEGATO);
      }
    }
  });

  it("i campi stat_* sono vuoti su ogni prenotazione non ancora anonimizzata, per vincolo", async () => {
    const { error } = await servizio()
      .from("prenotazioni")
      .update({ stat_eta: "18-25" })
      .eq("utente_id", u.id);
    // 23514 = check_violation
    expect(error?.code).toBe("23514");
  });
});
