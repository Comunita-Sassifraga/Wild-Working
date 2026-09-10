/**
 * SPEC §8.3 — visibility rules live in the database.
 *
 * Impersonating an ordinary user, try to read someone else's bookings and
 * email and verify the access fails. Also covers the referente and
 * amministratore boundaries of §4 and the window mirror of §10.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FINESTRA_GIORNI } from "@/config/limits";
import { aggiungiGiorni, fineFinestra, oggiRoma } from "@/lib/dates";
import { prenotaPosto } from "@/lib/db/prenotazioni";
import { impostaMostraNomePubblico } from "@/lib/db/utenti";
import {
  assegnaIncarico,
  CODICE_PERMESSO_NEGATO,
  creaSede,
  creaUtente,
  inserisciPrenotazioneDiretta,
  pulisci,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

describe("§8.3 politiche di accesso", () => {
  let sedeX: string;
  let sedeY: string;
  let a: UtenteTest; // books at sedeX (today) and sedeY (today, afternoon)
  let b: UtenteTest; // ordinary user with nothing
  let referenteX: UtenteTest;
  let admin: UtenteTest;
  let prenotazioneA: string;
  let prenotazioneFuoriFinestra: string;
  const oggi = oggiRoma();

  beforeAll(async () => {
    sedeX = await creaSede({ capienza: 5, note: "Chiavi dal bar" });
    sedeY = await creaSede({ capienza: 5 });
    [a, b, referenteX, admin] = await Promise.all([creaUtente(), creaUtente(), creaUtente(), creaUtente()]);
    await assegnaIncarico(referenteX.id, "REFERENTE", sedeX);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");

    const esito = await prenotaPosto(a.client, { sedeId: sedeX, data: oggi, fascia: "MATTINA" });
    if (!esito.ok) throw new Error("fixture booking failed");
    prenotazioneA = esito.id;
    const esitoY = await prenotaPosto(a.client, { sedeId: sedeY, data: oggi, fascia: "POMERIGGIO" });
    if (!esitoY.ok) throw new Error("fixture booking failed");
    prenotazioneFuoriFinestra = await inserisciPrenotazioneDiretta({
      utente_id: a.id,
      sede_id: sedeX,
      data: aggiungiGiorni(fineFinestra(), 1),
      fascia: "MATTINA",
    });
  });

  afterAll(async () => {
    await pulisci({ utenti: [a, b, referenteX, admin], sedi: [sedeX, sedeY] });
  });

  describe("utente registrato", () => {
    it("non vede le prenotazioni di un altro utente", async () => {
      const { data, error } = await b.client.from("prenotazioni").select("id, utente_id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      const { data: mirata } = await b.client.from("prenotazioni").select("id").eq("id", prenotazioneA);
      expect(mirata).toEqual([]);
    });

    it("legge solo la propria riga di utenti, mai l'email di un altro", async () => {
      const { data, error } = await b.client.from("utenti").select("id, email");
      expect(error).toBeNull();
      expect(data?.map((r) => r.id)).toEqual([b.id]);
      const { data: altrui } = await b.client.from("utenti").select("email").eq("id", a.id);
      expect(altrui).toEqual([]);
    });

    it("non raggiunge nessuno dalle viste riservate a referente e amministratore", async () => {
      expect((await b.client.from("utenti_amministrazione").select("email")).data).toEqual([]);
      expect((await b.client.from("prenotazioni_referente").select("email")).data).toEqual([]);
    });

    it("non può prenotare a nome di un altro", async () => {
      const { error } = await b.client.from("prenotazioni").insert({
        utente_id: a.id,
        sede_id: sedeX,
        data: oggi,
        fascia: "POMERIGGIO",
        posto_progressivo: 2,
      });
      expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);
    });

    it("non può annullare la prenotazione di un altro", async () => {
      const { data } = await b.client
        .from("prenotazioni")
        .update({ stato: "ANNULLATA" })
        .eq("id", prenotazioneA)
        .select("id");
      expect(data).toEqual([]);
      const { data: riga } = await servizio().from("prenotazioni").select("stato").eq("id", prenotazioneA).single();
      expect(riga?.stato).toBe("ATTIVA");
    });

    it("non può leggere il numero di posto né i campi stat_* delle proprie prenotazioni", async () => {
      expect((await a.client.from("prenotazioni").select("posto_progressivo")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
      expect((await a.client.from("prenotazioni").select("stat_eta")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
    });

    it("non può cambiare la propria email dalla tabella utenti", async () => {
      const { error } = await a.client.from("utenti").update({ email: "x@example.com" }).eq("id", a.id);
      expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);
    });

    it("legge le note della sede, che il visitatore non vede", async () => {
      const { data } = await a.client.from("sedi").select("note").eq("id", sedeX).single();
      expect(data?.note).toBe("Chiavi dal bar");
    });
  });

  describe("visitatore", () => {
    const anon = visitatore();

    it("non legge utenti, prenotazioni, consensi, incarichi", async () => {
      for (const tabella of ["utenti", "prenotazioni", "consensi", "incarichi"] as const) {
        const { error } = await anon.from(tabella).select("id");
        expect(error?.code, tabella).toBe(CODICE_PERMESSO_NEGATO);
      }
    });

    it("non legge la tabella sedi; la vista pubblica non contiene le note", async () => {
      expect((await anon.from("sedi").select("id")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
      const { data, error } = await anon.from("sedi_pubbliche").select("*").eq("id", sedeX).single();
      expect(error).toBeNull();
      expect(data).not.toHaveProperty("note");
    });

    it("non legge chi ha creato una chiusura", async () => {
      expect((await anon.from("chiusure").select("creata_da")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
      expect((await anon.from("chiusure").select("id, sede_id, data_inizio, data_fine, fascia")).error).toBeNull();
    });

    it("non può prenotare", async () => {
      const { error } = await anon.rpc("prenota_posto", { p_sede_id: sedeX, p_data: oggi, p_fascia: "MATTINA" });
      expect(error?.code).toBe(CODICE_PERMESSO_NEGATO);
    });
  });

  describe("referente di sede", () => {
    it("vede le prenotazioni della propria sede con l'email, e non quelle dell'altra", async () => {
      const { data, error } = await referenteX.client.from("prenotazioni_referente").select("*");
      expect(error).toBeNull();
      expect(data?.every((r) => r.sede_id === sedeX)).toBe(true);
      const riga = data?.find((r) => r.id === prenotazioneA);
      expect(riga?.email).toBe(a.email);
      expect(data?.some((r) => r.sede_id === sedeY)).toBe(false);
    });

    it("non vede oltre la finestra prenotabile", async () => {
      const { data } = await referenteX.client.from("prenotazioni_referente").select("id");
      expect(data?.some((r) => r.id === prenotazioneFuoriFinestra)).toBe(false);
    });

    it("vede il nome pubblico solo se l'utente lo mostra", async () => {
      await servizio().from("utenti").update({ nome_pubblico: "Anna" }).eq("id", a.id);
      const nascosto = await referenteX.client.from("prenotazioni_referente").select("nome_pubblico").eq("id", prenotazioneA).single();
      expect(nascosto.data?.nome_pubblico).toBeNull();
      await impostaMostraNomePubblico(a.client, a.id, true);
      const mostrato = await referenteX.client.from("prenotazioni_referente").select("nome_pubblico").eq("id", prenotazioneA).single();
      expect(mostrato.data?.nome_pubblico).toBe("Anna");
    });

    it("non ha accesso diretto alle prenotazioni altrui né alla tabella utenti", async () => {
      expect((await referenteX.client.from("prenotazioni").select("id")).data).toEqual([]);
      expect((await referenteX.client.from("utenti").select("id")).data?.map((r) => r.id)).toEqual([referenteX.id]);
    });
  });

  describe("amministratore", () => {
    it("vede l'email degli utenti dalla vista dedicata, senza i campi facoltativi", async () => {
      const { data, error } = await admin.client.from("utenti_amministrazione").select("*").eq("id", a.id).single();
      expect(error).toBeNull();
      expect(data?.email).toBe(a.email);
      for (const campo of ["eta", "genere", "professione", "motivo_visita", "residenza"]) {
        expect(data).not.toHaveProperty(campo);
      }
    });

    it("non raggiunge i campi facoltativi di un altro utente dalla tabella utenti", async () => {
      await servizio().from("utenti").update({ eta: "26-35" }).eq("id", a.id);
      const { data } = await admin.client.from("utenti").select("id, eta").eq("id", a.id);
      expect(data).toEqual([]);
    });

    it("vede tutte le prenotazioni ma non il numero di posto né stat_*", async () => {
      const { data } = await admin.client.from("prenotazioni").select("id").eq("id", prenotazioneA);
      expect(data).toHaveLength(1);
      expect((await admin.client.from("prenotazioni").select("posto_progressivo")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
      expect((await admin.client.from("prenotazioni").select("stat_residenza")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
    });

    it("può gestire sedi, mentre un utente comune no", async () => {
      const { error } = await admin.client.from("sedi").update({ capienza: 6 }).eq("id", sedeY);
      expect(error).toBeNull();
      const { data } = await b.client.from("sedi").update({ capienza: 99 }).eq("id", sedeY).select("id");
      expect(data).toEqual([]);
    });
  });

  describe("registro dei consensi", () => {
    it("l'utente legge le proprie righe, non quelle altrui; l'amministratore tutte", async () => {
      const proprie = await a.client.from("consensi").select("utente_id");
      expect(proprie.data?.length).toBeGreaterThan(0);
      expect(proprie.data?.every((r) => r.utente_id === a.id)).toBe(true);
      const altrui = await b.client.from("consensi").select("id").eq("utente_id", a.id);
      expect(altrui.data).toEqual([]);
      const tutte = await admin.client.from("consensi").select("id").eq("utente_id", a.id);
      expect(tutte.data?.length).toBe(proprie.data?.length);
    });

    it("nessuno modifica o cancella una riga, nemmeno il ruolo di servizio", async () => {
      const { data: righe } = await servizio().from("consensi").select("id").eq("utente_id", a.id).limit(1);
      const id = righe?.[0]?.id;
      expect(id).toBeDefined();
      expect((await a.client.from("consensi").update({ valore: "REVOCATO" }).eq("id", id!)).error?.code).toBe(CODICE_PERMESSO_NEGATO);
      expect((await a.client.from("consensi").delete().eq("id", id!)).error?.code).toBe(CODICE_PERMESSO_NEGATO);
      expect((await admin.client.from("consensi").delete().eq("id", id!)).error?.code).toBe(CODICE_PERMESSO_NEGATO);
      expect((await servizio().from("consensi").update({ valore: "REVOCATO" }).eq("id", id!)).error?.code).toBe("CS001");
    });
  });

  it("la copia di FINESTRA_GIORNI nel database coincide con config/limits.ts (§10)", async () => {
    const { data, error } = await servizio().rpc("finestra_giorni");
    expect(error).toBeNull();
    expect(data).toBe(FINESTRA_GIORNI);
    expect(FINESTRA_GIORNI).toBe(14);
  });
});
