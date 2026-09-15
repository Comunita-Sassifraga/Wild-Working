/**
 * SPEC §5.2, §6.2 — the availability grid.
 *
 * The five bookability conditions live in one database function
 * (sede_prenotabile); these tests exercise them through the public view, as
 * a visitor, because that is the only door the page uses.
 *
 * They also guard the boundary that matters most here: the grid is made of
 * counts. No email, no nome_pubblico, no identifier of a person may come out
 * of it (rules 8, 15, 16).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SOGLIA_ULTIMI_POSTI } from "@/config/limits";
import { aggiungiGiorni, fineFinestra, giornoSettimana, oggiRoma } from "@/lib/dates";
import { edizioneAttiva } from "@/lib/db/abitanti";
import { disponibilitaPubblica } from "@/lib/db/disponibilita";
import { prenotaPosto } from "@/lib/db/prenotazioni";
import { giornoScelto, statoCella, type Cella, type Giorno } from "@/lib/disponibilita";
import {
  creaChiusura,
  creaEdizione,
  creaSede,
  creaUtente,
  creaUtenti,
  inserisciPrenotazioneDiretta,
  pulisci,
  pulisciEdizioni,
  servizio,
  visitatore,
  type UtenteTest,
} from "./setup/supabase";

const OGNI_GIORNO = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;
const NOMI = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"] as const;

describe("§6.2 vista della disponibilità", () => {
  const anon = visitatore();
  const oggi = oggiRoma();

  let aperta: string; // open every day
  let soloLunedi: string; // giorni_apertura = LUN only
  let spenta: string; // attiva = false
  let conChiusure: string;
  let prenotatori: UtenteTest[];
  let ospite: UtenteTest;

  async function celleDi(sedeId: string): Promise<Cella[]> {
    const tutte = await disponibilitaPubblica(anon);
    return tutte.filter((c) => c.sedeId === sedeId);
  }

  const cella = (celle: Cella[], data: string, fascia: "MATTINA" | "POMERIGGIO") =>
    celle.find((c) => c.data === data && c.fascia === fascia);

  beforeAll(async () => {
    const comuni = { capienza: 4, giorni_apertura: [...OGNI_GIORNO] };
    aperta = await creaSede(comuni);
    conChiusure = await creaSede(comuni);
    soloLunedi = await creaSede({ capienza: 4, giorni_apertura: ["LUN"] });
    spenta = await creaSede({ ...comuni, attiva: false });

    prenotatori = await creaUtenti(4);
    ospite = await creaUtente();

    // Due dei quattro rendono pubblica la presenza; uno ha l'interruttore
    // acceso ma nessun nome, e non conta come presenza pubblica.
    const s = servizio();
    await s.from("utenti").update({ nome_pubblico: "Pia", mostra_nome_pubblico: true }).eq("id", prenotatori[0].id);
    await s.from("utenti").update({ nome_pubblico: "Nino", mostra_nome_pubblico: true }).eq("id", prenotatori[1].id);
    await s.from("utenti").update({ nome_pubblico: "Ada", mostra_nome_pubblico: false }).eq("id", prenotatori[2].id);
    await s.from("utenti").update({ nome_pubblico: "", mostra_nome_pubblico: true }).eq("id", prenotatori[3].id);
  });

  afterAll(async () => {
    await pulisci({
      utenti: [...prenotatori, ospite],
      sedi: [aperta, conChiusure, soloLunedi, spenta],
    });
  });

  it("copre esattamente la finestra: oggi e i giorni successivi, due fasce al giorno", async () => {
    const celle = await celleDi(aperta);
    const date = [...new Set(celle.map((c) => c.data))].sort();
    expect(date[0]).toBe(oggi);
    expect(date.at(-1)).toBe(fineFinestra());
    expect(celle).toHaveLength(date.length * 2);
    expect(new Set(celle.map((c) => c.fascia))).toEqual(new Set(["MATTINA", "POMERIGGIO"]));
  });

  it("non mostra il passato né i giorni oltre la finestra", async () => {
    const celle = await celleDi(aperta);
    expect(celle.some((c) => c.data < oggi)).toBe(false);
    expect(celle.some((c) => c.data > fineFinestra())).toBe(false);
  });

  it("una sede disattivata non compare affatto", async () => {
    expect(await celleDi(spenta)).toEqual([]);
  });

  it("i giorni di apertura decidono la prenotabilità, giorno per giorno", async () => {
    const celle = await celleDi(soloLunedi);
    for (const c of celle) {
      expect(c.prenotabile, `${c.data} (${NOMI[giornoSettimana(c.data) - 1]})`).toBe(
        giornoSettimana(c.data) === 1,
      );
    }
    // Fuori dai giorni di apertura la sede resta comunque in stagione: non è
    // fuori periodo, è solo chiusa quel giorno (§5.2 condizioni 2 e 5).
    expect(celle.every((c) => c.inStagione)).toBe(true);
  });

  it("una chiusura su una fascia chiude quella fascia e lascia aperta l'altra", async () => {
    const data = aggiungiGiorni(oggi, 2);
    await creaChiusura({ sede_id: conChiusure, data_inizio: data, data_fine: data, fascia: "MATTINA" });
    const celle = await celleDi(conChiusure);
    expect(cella(celle, data, "MATTINA")?.prenotabile).toBe(false);
    expect(cella(celle, data, "POMERIGGIO")?.prenotabile).toBe(true);
  });

  it("una chiusura senza fascia chiude tutto il giorno", async () => {
    const data = aggiungiGiorni(oggi, 3);
    await creaChiusura({ sede_id: conChiusure, data_inizio: data, data_fine: data, fascia: null });
    const celle = await celleDi(conChiusure);
    expect(cella(celle, data, "MATTINA")?.prenotabile).toBe(false);
    expect(cella(celle, data, "POMERIGGIO")?.prenotabile).toBe(false);
  });

  it("conta i posti liberi e quante persone si mostrano, mai i nomi", async () => {
    const data = aggiungiGiorni(oggi, 1);
    for (const u of prenotatori) {
      const esito = await prenotaPosto(u.client, { sedeId: aperta, data, fascia: "MATTINA" });
      expect(esito.ok).toBe(true);
    }

    const celle = await celleDi(aperta);
    const mattina = cella(celle, data, "MATTINA");
    expect(mattina).toMatchObject({ capienza: 4, prenotati: 4, liberi: 0, pubbliche: 2 });
    expect(statoCella(mattina as Cella)).toBe("ESAURITA");

    // Nessuna colonna della vista può contenere un dato personale.
    const { data: righe } = await anon.from("disponibilita_pubblica").select("*").limit(1);
    expect(Object.keys(righe?.[0] ?? {}).sort()).toEqual([
      "capienza",
      "data",
      "fascia",
      "in_stagione",
      "liberi",
      "prenotabile",
      "prenotati",
      "pubbliche",
      "sede_id",
    ]);
  });

  it("una prenotazione annullata libera il posto", async () => {
    const data = aggiungiGiorni(oggi, 1);
    await servizio()
      .from("prenotazioni")
      .update({ stato: "ANNULLATA" })
      .eq("utente_id", prenotatori[0].id)
      .eq("data", data);

    const mattina = cella(await celleDi(aperta), data, "MATTINA");
    expect(mattina).toMatchObject({ prenotati: 3, liberi: 1, pubbliche: 1 });
    expect(statoCella(mattina as Cella)).toBe(SOGLIA_ULTIMI_POSTI >= 1 ? "ULTIMI" : "LIBERA");
  });

  it("una prenotazione fuori finestra non entra in nessun conteggio", async () => {
    const oltre = aggiungiGiorni(fineFinestra(), 1);
    await inserisciPrenotazioneDiretta({
      utente_id: ospite.id,
      sede_id: aperta,
      data: oltre,
      fascia: "MATTINA",
    });
    const celle = await celleDi(aperta);
    expect(celle.some((c) => c.data === oltre)).toBe(false);
  });

  it("la vista è leggibile senza registrarsi, e le tabelle sotto restano chiuse", async () => {
    const { error: vista } = await anon.from("disponibilita_pubblica").select("sede_id").limit(1);
    expect(vista).toBeNull();
    const { error: aperture } = await anon.from("aperture_future").select("sede_id").limit(1);
    expect(aperture).toBeNull();
    // Le prenotazioni da cui i conteggi nascono restano irraggiungibili.
    const { error: prenotazioni } = await anon.from("prenotazioni").select("id").limit(1);
    expect(prenotazioni).not.toBeNull();
  });
});

/**
 * The day the page opens on. A date arriving from the address bar is never
 * trusted: when it names a day nobody can open, the page falls back to the
 * default view — and, in `app/page.tsx`, sends the browser back to `/` so
 * that the address stops claiming a day it is not showing.
 */
describe("§6.2 giorno scelto da un indirizzo", () => {
  const adesso = new Date("2026-09-10T09:00:00Z"); // giovedì, Europe/Rome
  const oggi = "2026-09-10";

  const calendario = (statoDiOggi: Giorno["stato"] = "LIBERO") =>
    new Map<string, Giorno>([
      ["2026-09-07", { data: "2026-09-07", stato: "PASSATO" }],
      ["2026-09-09", { data: "2026-09-09", stato: "PASSATO" }],
      [oggi, { data: oggi, stato: statoDiOggi }],
      ["2026-09-11", { data: "2026-09-11", stato: "LIBERO" }],
      ["2026-09-13", { data: "2026-09-13", stato: "CHIUSO" }],
      ["2026-09-14", { data: "2026-09-14", stato: "ESAURITO" }],
      ["2026-09-25", { data: "2026-09-25", stato: "OLTRE" }],
    ]);

  it("apre su oggi quando l'indirizzo non chiede niente", () => {
    expect(giornoScelto(calendario(), undefined, adesso)).toBe(oggi);
  });

  it("apre sul giorno chiesto, quando è un giorno che si può aprire", () => {
    expect(giornoScelto(calendario(), "2026-09-11", adesso)).toBe("2026-09-11");
    // Anche un giorno esaurito si può guardare: è pieno, non inesistente.
    expect(giornoScelto(calendario(), "2026-09-14", adesso)).toBe("2026-09-14");
  });

  it("ripiega su oggi davanti a una data inventata, passata, chiusa o fuori finestra", () => {
    for (const richiesta of ["test", "", "2026-13-45", "2026-09-09", "2026-09-13", "2026-09-25"]) {
      expect(giornoScelto(calendario(), richiesta, adesso), richiesta).toBe(oggi);
    }
  });

  it("se oggi è chiuso, apre sul primo giorno utile della finestra", () => {
    expect(giornoScelto(calendario("CHIUSO"), undefined, adesso)).toBe("2026-09-11");
    expect(giornoScelto(calendario("CHIUSO"), "test", adesso)).toBe("2026-09-11");
  });
});

/**
 * L'ingresso a «Prenota un abitante» in cima alla pagina — SPEC §15.5, §6.2,
 * passo 20.
 *
 * Il pulsante non è una schermata che si possa interrogare da qui: quello
 * che si può provare è la condizione esatta su cui `app/page.tsx` lo disegna,
 * `utente && edizioneAttiva(client)`. Due metà, e nessuna delle due basta da
 * sola — un visitatore non lo vede mai, e il 18 ottobre sparisce da sé senza
 * che nessuno tolga niente.
 *
 * Dal 15/09/2026 il pulsante sta sotto quello di «Chi c'è in Valle», con
 * sopra la riga che dice a chi è rivolto (§6.2). Riga e pulsante sono un
 * blocco solo e si disegnano insieme, sulla stessa condizione: la riga non
 * resta mai sopra un pulsante che non c'è più.
 */
describe("§15.5 ingresso al modulo dalla disponibilità", () => {
  const anon = visitatore();
  let utente: UtenteTest;
  const edizioni: string[] = [];

  beforeAll(async () => {
    utente = await creaUtente();
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
    await pulisci({ utenti: [utente] });
  });

  it("a chi non ha fatto l'accesso le edizioni non arrivano, nemmeno quando ce n'è una aperta", async () => {
    const aperta = await creaEdizione();
    edizioni.push(aperta);
    // `app/page.tsx` chiede l'edizione solo dopo aver trovato una sessione,
    // e senza sessione il pulsante non si disegna. Quello che si prova qui è
    // l'altra metà: al visitatore la tabella non risponde comunque, quindi
    // nemmeno il nome dell'edizione esce (§15.5, §15.3.1).
    const { data, error } = await anon.from("edizioni").select("*");
    expect(data ?? []).toEqual([]);
    if (error) expect(error.code).toBe("42501");
  });

  it("compare a chi ha fatto l'accesso mentre un'edizione è aperta", async () => {
    const aperta = await creaEdizione();
    edizioni.push(aperta);
    expect(await edizioneAttiva(utente.client)).toBe(aperta);
  });

  it("sparisce quando l'edizione si spegne, e quando le sue date sono passate", async () => {
    const aperta = await creaEdizione();
    edizioni.push(aperta);
    expect(await edizioneAttiva(utente.client)).toBe(aperta);

    await servizio().from("edizioni").update({ attiva: false }).eq("id", aperta);
    expect(await edizioneAttiva(utente.client)).toBeNull();

    // Accesa ma finita: è il 18 ottobre di §15.5, e non serve che nessuno
    // si ricordi di togliere il pulsante.
    await servizio()
      .from("edizioni")
      .update({
        attiva: true,
        data_inizio: aggiungiGiorni(oggiRoma(), -30),
        data_fine: aggiungiGiorni(oggiRoma(), -1),
      })
      .eq("id", aperta);
    expect(await edizioneAttiva(utente.client)).toBeNull();
  });

  it("la griglia resta fatta di conteggi: l'ingresso non le aggiunge niente", async () => {
    const aperta = await creaEdizione();
    edizioni.push(aperta);
    const { data } = await anon.from("disponibilita_pubblica").select("*").limit(1);
    for (const riga of data ?? []) {
      const colonne = Object.keys(riga);
      for (const vietata of [
        "email",
        "nome_pubblico",
        "utente_id",
        "edizione_id",
        "attivita_id",
      ]) {
        expect(colonne, vietata).not.toContain(vietata);
      }
    }
  });
});
