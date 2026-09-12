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
  creaAttivita,
  creaEdizione,
  creaUtente,
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
