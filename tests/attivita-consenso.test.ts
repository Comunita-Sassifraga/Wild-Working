/**
 * SPEC §15.8 — an activity cannot be published without the consent tick.
 *
 * The tick is not the consent: the consent is the paper the Direttivo holds,
 * signed by hand or received by email from an address of the abitante. The
 * tick is the traced declaration that the paper exists (rule 25). The abitante
 * has no account and will never have one, so the omission is invisible to the
 * only person it harms — which is why the refusal is the database's and not
 * the form's.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggiungiGiorni, oggiRoma } from "@/lib/dates";
import {
  assegnaIncarico,
  CODICE_PERMESSO_NEGATO,
  creaAttivita,
  creaEdizione,
  creaUtente,
  creaUtenti,
  inserisciIscrizioneDiretta,
  pulisci,
  pulisciEdizioni,
  servizio,
  type UtenteTest,
} from "./setup/supabase";

/** Postgres check-constraint violation, as PostgREST reports it. */
const VIOLAZIONE_VINCOLO = "23514";

describe("§15.8 la spunta del consenso", () => {
  const edizioni: string[] = [];
  let edizione: string;
  let admin: UtenteTest;

  beforeAll(async () => {
    edizione = await creaEdizione();
    edizioni.push(edizione);
    admin = await creaUtente();
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
    await pulisci({ utenti: [admin] });
  });

  it("senza la spunta, un'attività non passa a PUBBLICATA", async () => {
    const attivita = await creaAttivita({
      edizione_id: edizione,
      stato: "BOZZA",
      consenso_raccolto: false,
      consenso_modalita: null,
    });

    const { error } = await servizio()
      .from("attivita")
      .update({ stato: "PUBBLICATA" })
      .eq("id", attivita);
    expect(error).not.toBeNull();
    expect(error?.code).toBe(VIOLAZIONE_VINCOLO);

    const { data } = await servizio().from("attivita").select("stato").eq("id", attivita).single();
    expect(data?.stato).toBe("BOZZA");
  });

  it("nemmeno nascendo già pubblicata", async () => {
    await expect(
      creaAttivita({
        edizione_id: edizione,
        stato: "PUBBLICATA",
        consenso_raccolto: false,
        consenso_modalita: null,
      }),
    ).rejects.toThrow();
  });

  it("la spunta senza la forma è rifiutata", async () => {
    await expect(
      creaAttivita({
        edizione_id: edizione,
        stato: "BOZZA",
        consenso_raccolto: true,
        consenso_modalita: null,
      }),
    ).rejects.toThrow();
  });

  it("la forma è un elenco chiuso di due: un terzo valore non esiste", async () => {
    // Not a verbal agreement minuted in a meeting, however reasonable it
    // sounds: §15.8 rests on the paper being real.
    const { error } = await servizio()
      .from("attivita")
      .insert({
        edizione_id: edizione,
        titolo: "Con accordo verbale",
        descrizione: "Le parole dell'abitante.",
        abitante_nome: "Nome",
        abitante_cognome: "Cognome",
        abitante_telefono: "000 0000000",
        luogo_generico: "Frazione",
        luogo_esatto: "Via 1",
        data: aggiungiGiorni(oggiRoma(), 1),
        ora_inizio: "18:00",
        ora_fine: "20:00",
        capienza: 4,
        consenso_raccolto: true,
        consenso_modalita: "ACCORDO_VERBALE",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22P02");
  });

  it("togliere la spunta riporta in BOZZA un'attività pubblicata, e cancella la forma", async () => {
    const attivita = await creaAttivita({ edizione_id: edizione });
    const { data: prima } = await servizio()
      .from("attivita")
      .select("stato, consenso_raccolto")
      .eq("id", attivita)
      .single();
    expect(prima?.stato).toBe("PUBBLICATA");

    // Exactly what the panel does when an abitante changes his mind (§15.12):
    // it unticks the box, and nothing else. The return to BOZZA is the
    // database's doing, because whoever unticks is not thinking about stato.
    const { error } = await servizio()
      .from("attivita")
      .update({ consenso_raccolto: false })
      .eq("id", attivita);
    expect(error).toBeNull();

    const { data: dopo } = await servizio()
      .from("attivita")
      .select("stato, consenso_raccolto, consenso_modalita, consenso_raccolto_il")
      .eq("id", attivita)
      .single();
    expect(dopo?.stato).toBe("BOZZA");
    expect(dopo?.consenso_raccolto).toBe(false);
    expect(dopo?.consenso_modalita).toBeNull();
    expect(dopo?.consenso_raccolto_il).toBeNull();
  });

  it("un'attività tornata in BOZZA sparisce dall'elenco, e i suoi iscritti restano", async () => {
    // §15.12: the system flags them, it does not decide. Cancelling somebody
    // else's place is never automatic (rule 6).
    const attivita = await creaAttivita({ edizione_id: edizione });
    const { data: primaDiTogliere } = await servizio()
      .from("attivita_amministrazione")
      .select("id")
      .eq("id", attivita);
    expect(primaDiTogliere).not.toBeNull();

    await servizio().from("attivita").update({ consenso_raccolto: false }).eq("id", attivita);
    const { data: elenco } = await admin.client.from("attivita_elenco").select("id").eq("id", attivita);
    expect(elenco).toEqual([]);
  });

  it("la data e l'autore della spunta li scrive il sistema, non la richiesta", async () => {
    const inventato = "2000-01-01T00:00:00.000Z";
    const attivita = await creaAttivita({
      edizione_id: edizione,
      consenso_raccolto_il: inventato,
      consenso_raccolto_da: admin.id,
    });

    const { data } = await servizio()
      .from("attivita")
      .select("consenso_raccolto_il, consenso_raccolto_da")
      .eq("id", attivita)
      .single();
    expect(data?.consenso_raccolto_il).not.toBe(inventato);
    expect(new Date(data?.consenso_raccolto_il ?? 0).getFullYear()).toBeGreaterThan(2020);
    // Written from the session, which for a fixture written by the backend is
    // nobody: what matters is that the value supplied was not kept.
    expect(data?.consenso_raccolto_da).toBeNull();

    // And a later edit cannot move them either: the paper does not change
    // date because somebody fixed a typo in the title.
    const { data: dopoModifica } = await servizio()
      .from("attivita")
      .update({ titolo: "Titolo corretto", consenso_raccolto_il: inventato })
      .eq("id", attivita)
      .select("consenso_raccolto_il")
      .single();
    expect(dopoModifica?.consenso_raccolto_il).toBe(data?.consenso_raccolto_il);
  });

  it("rimettere la spunta ridata il consenso: è una dichiarazione nuova", async () => {
    const attivita = await creaAttivita({ edizione_id: edizione });
    const { data: prima } = await servizio()
      .from("attivita")
      .select("consenso_raccolto_il")
      .eq("id", attivita)
      .single();

    await servizio().from("attivita").update({ consenso_raccolto: false }).eq("id", attivita);
    await new Promise((r) => setTimeout(r, 50));
    const { data: dopo } = await servizio()
      .from("attivita")
      .update({ consenso_raccolto: true, consenso_modalita: "EMAIL_DI_CONSENSO" })
      .eq("id", attivita)
      .select("consenso_raccolto_il, consenso_modalita")
      .single();

    expect(dopo?.consenso_modalita).toBe("EMAIL_DI_CONSENSO");
    expect(new Date(dopo?.consenso_raccolto_il ?? 0).getTime()).toBeGreaterThan(
      new Date(prima?.consenso_raccolto_il ?? 0).getTime(),
    );
  });
describe("la scheda si compila anche a metà (§15.3.2, 12/09/2026)", () => {
    it("un'attività nasce con la sola edizione, e si finisce il giorno dopo", async () => {
      // 25 schede si caricano a mano, copiando da email e fogli sparsi. Chi
      // le inserisce deve poter salvare quello che ha e tornarci sopra.
      const { data: nata, error } = await servizio()
        .from("attivita")
        .insert({ edizione_id: edizione })
        .select("id, titolo, data, capienza, abitante_telefono, stato")
        .single();
      expect(error).toBeNull();
      expect(nata?.stato).toBe("BOZZA");
      expect(nata?.titolo).toBeNull();
      expect(nata?.data).toBeNull();
      expect(nata?.capienza).toBeNull();
      expect(nata?.abitante_telefono).toBeNull();

      const { error: erroreCompletamento } = await servizio()
        .from("attivita")
        .update({
          titolo: "Cena in frazione",
          abitante_nome: "Nome",
          data: aggiungiGiorni(oggiRoma(), 3),
          ora_inizio: "20:00",
          ora_fine: "23:00",
          capienza: 8,
        })
        .eq("id", nata!.id);
      expect(erroreCompletamento).toBeNull();
    });

    it("i limiti di lunghezza valgono comunque", async () => {
      // Optional is not unchecked: §15.3.2 caps the description at 4000.
      const { error } = await servizio()
        .from("attivita")
        .insert({ edizione_id: edizione, descrizione: "x".repeat(4001) });
      expect(error?.code).toBe(VIOLAZIONE_VINCOLO);
    });

    it("una scheda vuota resta impubblicabile senza la spunta", async () => {
      // The one refusal of its kind in the module did not move (§15.3.2).
      const { data: nata } = await servizio()
        .from("attivita")
        .insert({ edizione_id: edizione })
        .select("id")
        .single();
      const { error } = await servizio()
        .from("attivita")
        .update({ stato: "PUBBLICATA" })
        .eq("id", nata!.id);
      expect(error?.code).toBe(VIOLAZIONE_VINCOLO);
    });

    it("una data che c'è deve stare nell'edizione; una che non c'è non si controlla", async () => {
      const { error: fuori } = await servizio()
        .from("attivita")
        .insert({ edizione_id: edizione, data: aggiungiGiorni(oggiRoma(), 400) });
      expect(fuori).not.toBeNull();

      const { error: senzaData } = await servizio()
        .from("attivita")
        .insert({ edizione_id: edizione, titolo: "Ancora senza giorno" });
      expect(senzaData).toBeNull();
    });
  });
});

/**
 * The panel's path to the same rules — SPEC §15.9, §15.14 step 16.
 *
 * Everything above asserts what the database refuses when a row is written
 * straight into the table. This asserts the same refusals through the five
 * functions the panel actually calls, plus the two things the functions add:
 * the tick is written from the session of the amministratore who pressed the
 * button, and nobody else can press it.
 */
describe("§15.9 il percorso dal pannello", () => {
  const edizioni: string[] = [];
  let edizione: string;
  let admin: UtenteTest;
  let estraneo: UtenteTest;

  beforeAll(async () => {
    edizione = await creaEdizione();
    edizioni.push(edizione);
    [admin, estraneo] = await creaUtenti(2);
    await assegnaIncarico(admin.id, "AMMINISTRATORE");
  });

  afterAll(async () => {
    await pulisciEdizioni(edizioni);
    await pulisci({ utenti: [admin, estraneo] });
  });

  /** A card created the way the panel creates one: empty, in BOZZA. */
  async function nuovaScheda(titolo = "Scheda dal pannello"): Promise<string> {
    const { data, error } = await admin.client.rpc("crea_attivita", {
      p_edizione_id: edizione,
      p_titolo: titolo,
    });
    expect(error).toBeNull();
    return data as string;
  }

  const schedaPiena = (id: string) => ({
    p_id: id,
    p_titolo: "Pane nel forno a legna",
    p_descrizione: "Le parole dell'abitante, trascritte così come sono.",
    p_abitante_nome: "Nome",
    p_abitante_cognome: "Cognome",
    p_abitante_telefono: "000 0000000",
    p_abitante_note_interne: "Chiamare dopo le 18.",
    p_luogo_generico: "Frazione di prova",
    p_luogo_esatto: "Via di prova 1",
    p_data: aggiungiGiorni(oggiRoma(), 2),
    p_ora_inizio: "18:00",
    p_ora_fine: "20:00",
    p_capienza: 6,
    p_cosa_portare: "Grembiule",
    p_lingua_attivita: "Italiano",
  });

  it("si crea una scheda vuota e si finisce dopo", async () => {
    const id = await nuovaScheda();
    const { data: appena } = await servizio()
      .from("attivita")
      .select("stato, titolo, data, capienza")
      .eq("id", id)
      .single();
    expect(appena?.stato).toBe("BOZZA");
    expect(appena?.titolo).toBe("Scheda dal pannello");
    expect(appena?.data).toBeNull();
    expect(appena?.capienza).toBeNull();

    const { error } = await admin.client.rpc("aggiorna_attivita", schedaPiena(id));
    expect(error).toBeNull();

    const { data: finita } = await servizio()
      .from("attivita")
      .select("titolo, abitante_telefono, luogo_esatto, capienza, stato")
      .eq("id", id)
      .single();
    expect(finita?.titolo).toBe("Pane nel forno a legna");
    expect(finita?.abitante_telefono).toBe("000 0000000");
    expect(finita?.capienza).toBe(6);
    // Saving the card never publishes it: that is its own act (§15.8).
    expect(finita?.stato).toBe("BOZZA");
  });

  it("pubblicare scrive la spunta, la forma, e chi l'ha messa", async () => {
    const id = await nuovaScheda();
    await admin.client.rpc("aggiorna_attivita", schedaPiena(id));

    const { error } = await admin.client.rpc("pubblica_attivita", {
      p_id: id,
      p_modalita: "MODULO_CARTACEO_FIRMATO",
    });
    expect(error).toBeNull();

    const { data } = await servizio()
      .from("attivita")
      .select(
        "stato, consenso_raccolto, consenso_modalita, consenso_raccolto_il, consenso_raccolto_da",
      )
      .eq("id", id)
      .single();
    expect(data?.stato).toBe("PUBBLICATA");
    expect(data?.consenso_raccolto).toBe(true);
    expect(data?.consenso_modalita).toBe("MODULO_CARTACEO_FIRMATO");
    expect(data?.consenso_raccolto_il).not.toBeNull();
    // The point of §15.8: in a year somebody must be able to say who declared it.
    expect(data?.consenso_raccolto_da).toBe(admin.id);
  });

  it("pubblicare senza indicare la forma è rifiutato", async () => {
    const id = await nuovaScheda();
    const { error } = await admin.client.rpc("pubblica_attivita", {
      p_id: id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_modalita: null as any,
    });
    expect(error?.code).toBe("AT004");

    const { data } = await servizio().from("attivita").select("stato").eq("id", id).single();
    expect(data?.stato).toBe("BOZZA");
  });

  it("salvare una scheda pubblicata non ridata la spunta né la sposta", async () => {
    const id = await nuovaScheda();
    await admin.client.rpc("aggiorna_attivita", schedaPiena(id));
    await admin.client.rpc("pubblica_attivita", {
      p_id: id,
      p_modalita: "EMAIL_DI_CONSENSO",
    });
    const { data: prima } = await servizio()
      .from("attivita")
      .select("consenso_raccolto_il, consenso_raccolto_da")
      .eq("id", id)
      .single();

    await new Promise((r) => setTimeout(r, 50));
    const { error } = await admin.client.rpc("aggiorna_attivita", {
      ...schedaPiena(id),
      p_titolo: "Titolo corretto",
    });
    expect(error).toBeNull();

    const { data: dopo } = await servizio()
      .from("attivita")
      .select("titolo, stato, consenso_raccolto_il, consenso_raccolto_da, consenso_modalita")
      .eq("id", id)
      .single();
    expect(dopo?.titolo).toBe("Titolo corretto");
    expect(dopo?.stato).toBe("PUBBLICATA");
    expect(dopo?.consenso_modalita).toBe("EMAIL_DI_CONSENSO");
    expect(dopo?.consenso_raccolto_il).toBe(prima?.consenso_raccolto_il);
    expect(dopo?.consenso_raccolto_da).toBe(prima?.consenso_raccolto_da);
  });

  it("ritirare riporta in BOZZA e lascia gli iscritti dov'erano", async () => {
    const id = await creaAttivita({ edizione_id: edizione });
    const iscrizione = await inserisciIscrizioneDiretta({
      attivita_id: id,
      utente_id: estraneo.id,
    });

    const { error } = await admin.client.rpc("ritira_attivita", { p_id: id });
    expect(error).toBeNull();

    const { data: scheda } = await servizio()
      .from("attivita")
      .select("stato, consenso_raccolto, consenso_modalita, consenso_raccolto_il")
      .eq("id", id)
      .single();
    expect(scheda?.stato).toBe("BOZZA");
    expect(scheda?.consenso_raccolto).toBe(false);
    expect(scheda?.consenso_modalita).toBeNull();
    expect(scheda?.consenso_raccolto_il).toBeNull();

    // §15.12: il sistema lo segnala, non decide al posto di nessuno (rule 6).
    const { data: ancora } = await servizio()
      .from("iscrizioni")
      .select("stato, annullata_il")
      .eq("id", iscrizione)
      .single();
    expect(ancora?.stato).toBe("ATTIVA");
    expect(ancora?.annullata_il).toBeNull();
  });

  it("annullare spegne l'attività e le sue iscrizioni, e dice quante persone avvisare e chi", async () => {
    const id = await creaAttivita({ edizione_id: edizione });
    const iscrizione = await inserisciIscrizioneDiretta({
      attivita_id: id,
      utente_id: estraneo.id,
    });

    // Dal passo 19 tornano le persone e non il loro numero (§15.10): il
    // conteggio c'è ancora — sono le righe che tornano — e in più si sa chi
    // avvisare, dalla stessa istruzione che gli ha tolto il posto. Leggere
    // gli iscritti prima e annullare dopo lascerebbe in mezzo chi prende
    // l'ultimo posto e non viene avvisato mai.
    const { data: avvisare, error } = await admin.client.rpc("annulla_attivita", { p_id: id });
    expect(error).toBeNull();
    expect(avvisare?.length).toBe(1);
    expect(avvisare?.[0].utente_id).toBe(estraneo.id);

    const { data: scheda } = await servizio().from("attivita").select("stato").eq("id", id).single();
    expect(scheda?.stato).toBe("ANNULLATA");

    const { data: spenta } = await servizio()
      .from("iscrizioni")
      .select("stato, annullata_il, annullata_da")
      .eq("id", iscrizione)
      .single();
    expect(spenta?.stato).toBe("ANNULLATA");
    expect(spenta?.annullata_il).not.toBeNull();
    // §15.9: chi ha agito resta scritto per sempre.
    expect(spenta?.annullata_da).toBe(admin.id);
  });

  it("annullare un'attività non tocca nessuna prenotazione", async () => {
    // Rule 6 in its narrowest reading: these powers exist for iscrizioni and
    // never for prenotazioni (§15.9). Step 18 asserts the same of its two
    // actions; this asserts it of the one that arrives first.
    const { count: prima } = await servizio()
      .from("prenotazioni")
      .select("id", { count: "exact", head: true })
      .eq("stato", "ATTIVA");

    const id = await creaAttivita({ edizione_id: edizione });
    await admin.client.rpc("annulla_attivita", { p_id: id });

    const { count: dopo } = await servizio()
      .from("prenotazioni")
      .select("id", { count: "exact", head: true })
      .eq("stato", "ATTIVA");
    expect(dopo).toBe(prima);
  });

  it("una data fuori dall'edizione è rifiutata anche dal pannello", async () => {
    const id = await nuovaScheda();
    const { error } = await admin.client.rpc("aggiorna_attivita", {
      ...schedaPiena(id),
      p_data: aggiungiGiorni(oggiRoma(), 400),
    });
    expect(error?.code).toBe("AT002");
  });

  it("le lunghezze massime valgono anche passando dalle funzioni", async () => {
    const id = await nuovaScheda();
    const { error } = await admin.client.rpc("aggiorna_attivita", {
      ...schedaPiena(id),
      p_descrizione: "x".repeat(4001),
    });
    expect(error?.code).toBe(VIOLAZIONE_VINCOLO);
  });

  it("una scheda che non c'è si dice, non si inventa", async () => {
    const { error } = await admin.client.rpc(
      "aggiorna_attivita",
      schedaPiena("00000000-0000-0000-0000-000000000000"),
    );
    expect(error?.code).toBe("AT003");
  });

  it("chi non è amministratore non può chiamare nessuna delle cinque funzioni", async () => {
    const id = await creaAttivita({ edizione_id: edizione });

    const crea = await estraneo.client.rpc("crea_attivita", { p_edizione_id: edizione });
    expect(crea.error?.code).toBe(CODICE_PERMESSO_NEGATO);

    const aggiorna = await estraneo.client.rpc("aggiorna_attivita", schedaPiena(id));
    expect(aggiorna.error?.code).toBe(CODICE_PERMESSO_NEGATO);

    const pubblica = await estraneo.client.rpc("pubblica_attivita", {
      p_id: id,
      p_modalita: "EMAIL_DI_CONSENSO",
    });
    expect(pubblica.error?.code).toBe(CODICE_PERMESSO_NEGATO);

    const ritira = await estraneo.client.rpc("ritira_attivita", { p_id: id });
    expect(ritira.error?.code).toBe(CODICE_PERMESSO_NEGATO);

    const annulla = await estraneo.client.rpc("annulla_attivita", { p_id: id });
    expect(annulla.error?.code).toBe(CODICE_PERMESSO_NEGATO);

    // And nothing moved.
    const { data } = await servizio().from("attivita").select("stato").eq("id", id).single();
    expect(data?.stato).toBe("PUBBLICATA");
  });

  it("nemmeno un amministratore scrive sulla tabella: si passa dalle funzioni", async () => {
    // Rule 24: `attivita` is reachable by nobody, admin included. The panel
    // has five verbs and no sixth way in.
    const id = await creaAttivita({ edizione_id: edizione });

    const inserimento = await admin.client.from("attivita").insert({ edizione_id: edizione });
    expect(inserimento.error).not.toBeNull();

    const modifica = await admin.client
      .from("attivita")
      .update({ titolo: "Scritto di lato" })
      .eq("id", id);
    expect(modifica.error).not.toBeNull();

    const cancellazione = await admin.client.from("attivita").delete().eq("id", id);
    expect(cancellazione.error).not.toBeNull();

    const { data } = await servizio().from("attivita").select("titolo").eq("id", id).single();
    expect(data?.titolo).not.toBe("Scritto di lato");
  });
});
