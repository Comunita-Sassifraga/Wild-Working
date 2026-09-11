/**
 * SPEC §6.3 — il promemoria della sera prima (decisione del 10/09: la
 * prenotazione non manda più una conferma, manda un promemoria).
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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, dataEstesa, oggiRoma } from "@/lib/dates";
import { inviaPromemoria } from "@/lib/posta/promemoria";
import {
  attendiEmail,
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
