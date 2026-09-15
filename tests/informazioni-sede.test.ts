/**
 * SPEC §5.2, §6.3, §6.4, D26 — le informazioni della sede si leggono dopo
 * aver prenotato, non prima.
 *
 * `sedi.note` contiene come si arriva, le chiavi, il codice di accesso e la
 * password del Wi-Fi. Le legge chi ha una prenotazione attiva in quella
 * sede, il referente di quella sede e l'amministratore: nessun altro, per
 * nessuna strada. Il limite sta nella banca dati e non nelle pagine (§8.3),
 * quindi si prova qui, contro il database vero, con i permessi di ciascuno.
 *
 * Nessun indirizzo email compare in questo file (regola 4).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import { sediTutte, sedeSingola } from "@/lib/db/amministrazione";
import { annullaPrenotazione, prenotaPosto } from "@/lib/db/prenotazioni";
import { sediSeguite } from "@/lib/db/sedi";
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

const OGNI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;

const INFORMAZIONI = "Codice del portone 4271.\nWi-Fi: valle-soana / parolachiave.";
const ALTRE = "Le chiavi sono nella cassetta a destra.";

describe("§5.2 informazioni della sede (D26)", () => {
  let sedeX: string;
  let sedeY: string;
  let prenotato: UtenteTest; // ha una prenotazione attiva a sedeX
  let estraneo: UtenteTest; // registrato, nessuna prenotazione
  let referenteX: UtenteTest;
  let admin: UtenteTest;
  let prenotazioneX: string;
  const domani = aggiungiGiorni(oggiRoma(), 1);

  beforeAll(async () => {
    sedeX = await creaSede({
      capienza: 4,
      note: INFORMAZIONI,
      giorni_apertura: [...OGNI_GIORNO],
    });
    sedeY = await creaSede({
      capienza: 4,
      note: ALTRE,
      giorni_apertura: [...OGNI_GIORNO],
    });
    [prenotato, estraneo, referenteX, admin] = await Promise.all([
      creaUtente(),
      creaUtente(),
      creaUtente(),
      creaUtente(),
    ]);
    await assegnaIncarico(referenteX.id, "REFERENTE", sedeX);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");

    const esito = await prenotaPosto(prenotato.client, {
      sedeId: sedeX,
      data: domani,
      fascia: "MATTINA",
    });
    if (!esito.ok) throw new Error(`fixture booking failed: ${esito.motivo}`);
    prenotazioneX = esito.id;
  });

  afterAll(async () => {
    await pulisci({ utenti: [prenotato, estraneo, referenteX, admin], sedi: [sedeX, sedeY] });
  });

  // -------------------------------------------------------------------------
  // La colonna non esce dalla tabella, per nessuno
  // -------------------------------------------------------------------------

  it("nessun utente registrato legge la colonna dalla tabella", async () => {
    for (const chi of [prenotato, estraneo, referenteX, admin]) {
      expect((await chi.client.from("sedi").select("note")).error?.code).toBe(
        CODICE_PERMESSO_NEGATO,
      );
    }
  });

  it("non si legge nemmeno filtrandoci sopra o ordinandoci", async () => {
    expect(
      (await estraneo.client.from("sedi").select("id").like("note", "Codice%")).error?.code,
    ).toBe(CODICE_PERMESSO_NEGATO);
    expect((await estraneo.client.from("sedi").select("id").order("note")).error?.code).toBe(
      CODICE_PERMESSO_NEGATO,
    );
  });

  it("un select * sulla tabella non la porta via con sé", async () => {
    // `*` si espande a tutte le colonne, compresa quella tolta: il rifiuto
    // è del database, non di una lista scritta a mano nell'applicazione.
    expect((await estraneo.client.from("sedi").select("*")).error?.code).toBe(
      CODICE_PERMESSO_NEGATO,
    );
  });

  it("il visitatore non la raggiunge né dalla tabella né dalla vista pubblica", async () => {
    const anon = visitatore();
    expect((await anon.from("sedi").select("note")).error?.code).toBe(CODICE_PERMESSO_NEGATO);
    const { data, error } = await anon.from("sedi_pubbliche").select("*").eq("id", sedeX).single();
    expect(error).toBeNull();
    expect(data).not.toHaveProperty("note");
  });

  // -------------------------------------------------------------------------
  // Chi ha prenotato le legge, e solo di quella sede
  // -------------------------------------------------------------------------

  it("chi ha prenotato le legge dalla propria prenotazione", async () => {
    const { data } = await prenotato.client
      .from("mie_prenotazioni")
      .select("sede_id, note")
      .eq("id", prenotazioneX)
      .single();
    expect(data?.note).toBe(INFORMAZIONI);
  });

  it("legge quelle della sede dove ha prenotato, non quelle delle altre", async () => {
    const { data } = await prenotato.client.from("mie_prenotazioni").select("sede_id, note");
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((r) => r.sede_id === sedeX)).toBe(true);
    expect(data?.some((r) => r.note === ALTRE)).toBe(false);
  });

  it("chi non ha prenotato non le ottiene da nessuna vista", async () => {
    const { data } = await estraneo.client.from("mie_prenotazioni").select("note");
    expect(data).toEqual([]);
    expect(
      (await estraneo.client.from("sedi_amministrazione").select("note")).data,
    ).toEqual([]);
    expect((await estraneo.client.from("sedi_referente").select("note")).data).toEqual([]);
  });

  it("una prenotazione passata non le porta più", async () => {
    const passato = await creaUtente();
    await inserisciPrenotazioneDiretta({
      utente_id: passato.id,
      sede_id: sedeX,
      data: aggiungiGiorni(oggiRoma(), -3),
      fascia: "MATTINA",
    });
    const { data } = await passato.client.from("mie_prenotazioni").select("note");
    expect(data).toEqual([]);
    await pulisci({ utenti: [passato] });
  });

  it("annullare le toglie nello stesso istante", async () => {
    const tizio = await creaUtente();
    const esito = await prenotaPosto(tizio.client, {
      sedeId: sedeX,
      data: domani,
      fascia: "POMERIGGIO",
    });
    if (!esito.ok) throw new Error(`booking failed: ${esito.motivo}`);

    const prima = await tizio.client.from("mie_prenotazioni").select("note").eq("id", esito.id);
    expect(prima.data?.[0]?.note).toBe(INFORMAZIONI);

    expect(await annullaPrenotazione(tizio.client, esito.id)).toEqual({ ok: true });

    const dopo = await tizio.client.from("mie_prenotazioni").select("note").eq("id", esito.id);
    expect(dopo.data).toEqual([]);
    await pulisci({ utenti: [tizio] });
  });

  // -------------------------------------------------------------------------
  // Il referente le vede sempre, anche senza prenotazione (D26)
  // -------------------------------------------------------------------------

  it("il referente legge le informazioni della propria sede senza aver prenotato", async () => {
    const { data } = await referenteX.client.from("mie_prenotazioni").select("id");
    expect(data).toEqual([]);

    const seguite = await sediSeguite(referenteX.client);
    expect(seguite.map((s) => s.id)).toEqual([sedeX]);
    expect(seguite[0].note).toBe(INFORMAZIONI);
  });

  it("il referente non vede le sedi che non segue", async () => {
    const { data } = await referenteX.client
      .from("sedi_referente")
      .select("id, note")
      .eq("id", sedeY);
    expect(data).toEqual([]);
  });

  it("chi non ha nessun incarico ha la vista del referente vuota", async () => {
    expect(await sediSeguite(estraneo.client)).toEqual([]);
    expect(await sediSeguite(prenotato.client)).toEqual([]);
  });

  it("il visitatore non raggiunge la vista del referente", async () => {
    expect((await visitatore().from("sedi_referente").select("id")).error?.code).toBe(
      CODICE_PERMESSO_NEGATO,
    );
  });

  // -------------------------------------------------------------------------
  // L'amministratore le scrive dal pannello e le rilegge
  // -------------------------------------------------------------------------

  it("l'amministratore le legge dalla vista del pannello", async () => {
    const sede = await sedeSingola(admin.client, sedeX);
    expect(sede?.note).toBe(INFORMAZIONI);
    expect((await sediTutte(admin.client)).some((s) => s.id === sedeX)).toBe(true);
  });

  it("nessun altro raggiunge la vista del pannello", async () => {
    for (const chi of [prenotato, estraneo, referenteX]) {
      expect(await sedeSingola(chi.client, sedeX)).toBeNull();
      expect(await sediTutte(chi.client)).toEqual([]);
    }
    expect((await visitatore().from("sedi_amministrazione").select("id")).error?.code).toBe(
      CODICE_PERMESSO_NEGATO,
    );
  });

  it("nessun altro le può riscrivere", async () => {
    const { data } = await estraneo.client
      .from("sedi")
      .update({ note: "aperta a tutti" })
      .eq("id", sedeX)
      .select("id");
    expect(data ?? []).toEqual([]);

    const { data: riga } = await servizio().from("sedi").select("note").eq("id", sedeX).single();
    expect(riga?.note).toBe(INFORMAZIONI);
  });
});
