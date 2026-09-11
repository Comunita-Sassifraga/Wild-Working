/**
 * Installation on the phone and reading without a connection — SPEC §12
 * step 13, §8.4.
 *
 * Runs without Supabase, like tests/tokens.test.ts. Three things:
 *
 *  1. the manifest says what the phone needs, with the colours of §13.3 and
 *     the names of messages/it.json;
 *  2. the icons exist, are PNG, and are square at the size they declare;
 *  3. **what the local copy keeps.** The test runs public/sw.js for real and
 *     asks it, address by address, what it would store — and then drives its
 *     fetch handler with a fake network and a fake store, to check that a
 *     page nobody may keep is not kept even when the network answers.
 *
 * The third is the guard of this step: if one day the copy is widened to a
 * page carrying a nome_pubblico or somebody's bookings, this test fails.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import manifesto from "@/app/manifest";
import { colori } from "@/config/tokens";
import { m } from "@/lib/messaggi";

const RADICE = join(import.meta.dirname, "..");
const ORIGINE = "https://wildworking.sassifraga.org";

// ---------------------------------------------------------------------------
// 1. The manifest
// ---------------------------------------------------------------------------

describe("manifesto per l'installazione (SPEC §12 passo 13)", () => {
  const manifest = manifesto();

  it("porta i nomi dei testi, non nomi scritti nel codice", () => {
    expect(manifest.name).toBe(m.app.nome);
    expect(manifest.short_name).toBe(m.app.nomeBreve);
    expect(manifest.description).toBe(m.app.descrizione);
    // What fits under the icon on a phone is about twelve characters.
    expect(manifest.short_name!.length).toBeLessThanOrEqual(12);
  });

  it("si apre sulla disponibilità, senza barra degli indirizzi", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("it");
  });

  it("usa i colori dei token, mai un colore scritto a mano (regola 12)", () => {
    expect(manifest.background_color).toBe(colori.sfondo);
    expect(manifest.theme_color).toBe(colori.sfondo);
  });

  it("dichiara un'icona per Android, una grande e una ritagliabile", () => {
    const icone = manifest.icons ?? [];
    const misure = icone.map((i) => i.sizes);
    expect(misure).toContain("192x192");
    expect(misure).toContain("512x512");
    expect(icone.some((i) => i.purpose === "maskable")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. The icons
// ---------------------------------------------------------------------------

/** Width and height read from the PNG header itself, not from the file name. */
function misuraPng(percorso: string): { larghezza: number; altezza: number } {
  const file = readFileSync(percorso);
  expect(file.subarray(0, 8).toString("hex"), `${percorso} non è un PNG`).toBe("89504e470d0a1a0a");
  expect(file.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { larghezza: file.readUInt32BE(16), altezza: file.readUInt32BE(20) };
}

describe("icone per la schermata Home (SPEC §13.10)", () => {
  const dichiarate = (manifesto().icons ?? []).map((icona) => ({
    file: String(icona.src),
    lato: Number(String(icona.sizes).split("x")[0]),
  }));
  // iPhone ignores the manifest and takes this one from the page's head.
  const tutte = [...dichiarate, { file: "/icona-apple-180.png", lato: 180 }];

  for (const { file, lato } of tutte) {
    it(`${file} esiste ed è quadrata di ${lato}`, () => {
      const percorso = join(RADICE, "public", file.replace(/^\//, ""));
      expect(existsSync(percorso), `manca ${file}`).toBe(true);
      expect(misuraPng(percorso)).toEqual({ larghezza: lato, altezza: lato });
    });
  }
});

// ---------------------------------------------------------------------------
// 3. What the local copy keeps — public/sw.js
// ---------------------------------------------------------------------------

type Ascoltatori = Record<string, (evento: unknown) => void>;

/** A store that remembers what was put in it, standing in for the browser's. */
function copieFinte() {
  const contenuto = new Map<string, Map<string, string>>();
  const caches = {
    async open(nome: string) {
      const dentro = contenuto.get(nome) ?? new Map<string, string>();
      contenuto.set(nome, dentro);
      return {
        async put(indirizzo: string, risposta: Response) {
          dentro.set(String(indirizzo), await risposta.text());
        },
        async match(indirizzo: string) {
          const corpo = dentro.get(String(indirizzo));
          return corpo === undefined ? undefined : new Response(corpo);
        },
      };
    },
    async keys() {
      return [...contenuto.keys()];
    },
    async delete(nome: string) {
      return contenuto.delete(nome);
    },
  };
  /** Every address stored, whatever the copy it went into. */
  const conservati = () => [...contenuto.values()].flatMap((c) => [...c.keys()]);
  return { caches, conservati };
}

/**
 * Runs public/sw.js the way the browser would: it is plain JavaScript with
 * no imports, so a bare context with the few browser objects it touches is
 * enough to get the real code under test rather than a copy of its rules.
 */
function caricaCopiaLocale(rete: (indirizzo: string) => Response) {
  const codice = readFileSync(join(RADICE, "public", "sw.js"), "utf8");
  const ascoltatori: Ascoltatori = {};
  const { caches, conservati } = copieFinte();
  const contesto = createContext({
    URL,
    Response,
    caches,
    fetch: async (richiesta: string | { url: string }) =>
      rete(typeof richiesta === "string" ? new URL(richiesta, ORIGINE).toString() : richiesta.url),
    self: {
      location: { origin: ORIGINE },
      addEventListener: (nome: string, fn: (evento: unknown) => void) => {
        ascoltatori[nome] = fn;
      },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
  });
  runInContext(codice, contesto);
  const daConservare = runInContext("daConservare", contesto) as (
    indirizzo: string,
    navigazione: boolean,
  ) => string | null;
  return { daConservare, ascoltatori, conservati };
}

const senzaRete = () => {
  throw new Error("nessuna rete");
};

describe("la copia locale conserva la sola disponibilità (SPEC §8.4)", () => {
  const { daConservare } = caricaCopiaLocale(senzaRete);

  const pagine = ["/", "/?data=2026-09-20", "/senza-collegamento"];
  for (const indirizzo of pagine) {
    it(`conserva la pagina ${indirizzo}`, () => {
      expect(daConservare(`${ORIGINE}${indirizzo}`, true)).toBe("pagina");
    });
  }

  // "Chi c'è in Valle" is the one page carrying nomi pubblici. §6.5 promises
  // that switching the name off removes it from every booking immediately: a
  // copy on somebody else's phone would keep it alive for days.
  const mai = [
    "/chi-ce-in-valle",
    "/prenota",
    "/prenotazioni",
    "/impostazioni",
    "/impostazioni/cancella",
    "/impostazioni/dati",
    "/amministrazione",
    "/amministrazione/moderazione",
    "/accedi",
    "/auth/conferma?token_hash=xxx&type=magiclink",
    "/api/mestieri/promemoria",
    "/api/mestieri/pulizie",
    "/installa",
  ];
  for (const indirizzo of mai) {
    it(`non conserva mai ${indirizzo}`, () => {
      expect(daConservare(`${ORIGINE}${indirizzo}`, true)).toBeNull();
      expect(daConservare(`${ORIGINE}${indirizzo}`, false)).toBeNull();
    });
  }

  it("conserva i file con cui le pagine sono disegnate", () => {
    expect(daConservare(`${ORIGINE}/_next/static/css/abc.css`, false)).toBe("risorsa");
    expect(daConservare(`${ORIGINE}/_next/static/media/inclusive.woff2`, false)).toBe("risorsa");
    expect(daConservare(`${ORIGINE}/icona-512.png`, false)).toBe("risorsa");
    // The header logo, which Next serves resized through its own address.
    expect(
      daConservare(`${ORIGINE}/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.png&w=128&q=75`, false),
    ).toBe("risorsa");
  });

  it("non conserva niente di un altro sito", () => {
    for (const altrove of ["https://www.sassifraga.org/", "https://esempio.test/_next/static/x.js"]) {
      expect(daConservare(altrove, true)).toBeNull();
      expect(daConservare(altrove, false)).toBeNull();
    }
  });
});

describe("la copia locale in funzione", () => {
  const navigazione = (percorso: string, metodo = "GET") => ({
    method: metodo,
    mode: "navigate",
    url: `${ORIGINE}${percorso}`,
  });

  /** Runs the fetch handler and returns what it answered, if it answered. */
  async function chiedi(
    ascoltatori: Ascoltatori,
    richiesta: ReturnType<typeof navigazione>,
  ): Promise<Response | undefined> {
    let risposta: Promise<Response> | undefined;
    ascoltatori.fetch({ request: richiesta, respondWith: (p: Promise<Response>) => (risposta = p) });
    return risposta ? await risposta : undefined;
  }

  const conRete = (indirizzo: string) =>
    new Response(`pagina ${new URL(indirizzo).pathname}${new URL(indirizzo).search}`, {
      status: 200,
    });

  /** A copy that has been installed with a connection, and then loses it. */
  async function copiaInstallata() {
    let collegato = true;
    const caricata = caricaCopiaLocale((indirizzo) => {
      if (!collegato) throw new Error("nessuna rete");
      return conRete(indirizzo);
    });
    const atteso: Promise<unknown>[] = [];
    caricata.ascoltatori.install({ waitUntil: (p: Promise<unknown>) => atteso.push(p) });
    await Promise.all(atteso);
    return { ...caricata, stacca: () => (collegato = false) };
  }

  it("conserva la disponibilità mentre la mostra", async () => {
    const { ascoltatori, conservati } = caricaCopiaLocale(conRete);
    await chiedi(ascoltatori, navigazione("/?data=2026-09-20"));
    expect(conservati()).toContain(`${ORIGINE}/?data=2026-09-20`);
  });

  it("mostra «Chi c'è in Valle» senza conservarne niente", async () => {
    const { ascoltatori, conservati } = caricaCopiaLocale(conRete);
    const risposta = await chiedi(ascoltatori, navigazione("/chi-ce-in-valle"));
    expect(await risposta!.text()).toBe("pagina /chi-ce-in-valle");
    expect(conservati()).not.toContain(`${ORIGINE}/chi-ce-in-valle`);
  });

  it("all'installazione mette da parte la disponibilità e la cortesia", async () => {
    const { conservati } = await copiaInstallata();
    expect(conservati().sort()).toEqual([`${ORIGINE}/`, `${ORIGINE}/senza-collegamento`]);
  });

  it("senza collegamento la disponibilità resta, il resto è la cortesia", async () => {
    const { ascoltatori, stacca } = await copiaInstallata();
    stacca();

    const disponibilita = await chiedi(ascoltatori, navigazione("/"));
    expect(await disponibilita!.text()).toBe("pagina /");

    for (const percorso of ["/prenotazioni", "/chi-ce-in-valle", "/impostazioni"]) {
      const risposta = await chiedi(ascoltatori, navigazione(percorso));
      expect(await risposta!.text(), percorso).toBe("pagina /senza-collegamento");
    }
  });

  it("senza collegamento un giorno mai scaricato riporta alla vista di oggi", async () => {
    const { ascoltatori, stacca } = await copiaInstallata();
    stacca();
    const risposta = await chiedi(ascoltatori, navigazione("/?data=2026-09-20"));
    // Never that day's grid under that day's address (§6.2): the browser is
    // sent back to the default view, and the address goes with it.
    expect(risposta!.status).toBe(302);
    expect(risposta!.headers.get("location")).toBe(`${ORIGINE}/`);
  });

  /** What the page asks on opening, to know whether it is reading a copy. */
  function domandaCopia(ascoltatori: Ascoltatori, indirizzo: string) {
    let risposta: { dallaCopia?: boolean } | undefined;
    ascoltatori.message({
      data: { domanda: "copia", indirizzo },
      ports: [{ postMessage: (dato: { dallaCopia: boolean }) => (risposta = dato) }],
    });
    return risposta;
  }

  it("dice alla pagina quando è lei ad averla servita", async () => {
    const { ascoltatori, stacca } = await copiaInstallata();

    await chiedi(ascoltatori, navigazione("/"));
    expect(domandaCopia(ascoltatori, `${ORIGINE}/`)).toEqual({ dallaCopia: false });

    stacca();
    await chiedi(ascoltatori, navigazione("/"));
    expect(domandaCopia(ascoltatori, `${ORIGINE}/`)).toEqual({ dallaCopia: true });
  });

  it("non tocca quello che scrive: prenotare, annullare, salvare", async () => {
    const { ascoltatori } = caricaCopiaLocale(conRete);
    const risposta = await chiedi(ascoltatori, navigazione("/prenota", "POST"));
    expect(risposta).toBeUndefined();
  });
});
