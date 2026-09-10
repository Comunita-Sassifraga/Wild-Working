/**
 * Visual identity guard — CLAUDE.md rule 12, SPEC §13.
 *
 * Runs without Supabase. Five checks:
 *  1. no component file carries a literal (hex colour, px value, stock
 *     Tailwind palette class, arbitrary bracket value);
 *  2. every declared foreground/background pair reaches 4.5:1, and the
 *     pairs the spec forbids really fail;
 *  3. the colour table of SPEC §13.3 and config/tokens.ts coincide;
 *  4. the compiled Tailwind theme has no stock class and has the token ones;
 *  5. the self-hosted font files exist, use only the allowed weights, and
 *     nothing points at Google Fonts.
 */

import { compile } from "@tailwindcss/node";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  colori,
  CONTRASTO_MINIMO,
  coppieContrasto,
  coppieVietate,
  forma,
  PX_PER_REM,
  tipografia,
  type NomeColore,
} from "@/config/tokens";

const RADICE = join(import.meta.dirname, "..");

/** Every source file under the given folders, recursively, with the given extensions. */
function fileSorgente(cartelle: string[], estensioni: string[], escludi: string[] = []): string[] {
  const trovati: string[] = [];
  const visita = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const voce of readdirSync(dir)) {
      const percorso = join(dir, voce);
      const rel = relative(RADICE, percorso).replaceAll("\\", "/");
      if (escludi.some((e) => rel.startsWith(e))) continue;
      if (statSync(percorso).isDirectory()) visita(percorso);
      else if (estensioni.some((e) => voce.endsWith(e))) trovati.push(rel);
    }
  };
  for (const c of cartelle) visita(join(RADICE, c));
  return trovati.sort();
}

const leggi = (rel: string) => readFileSync(join(RADICE, rel), "utf8");

// ---------------------------------------------------------------------------
// 1. No literal visual value in components
// ---------------------------------------------------------------------------

const COLORE_ESADECIMALE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const VALORE_PX = /\b\d+(?:\.\d+)?px\b/;
const VALORE_ARBITRARIO = /\b[a-z][a-z-]*-\[[^\]]+\]/;
const TAVOLOZZA_DI_SERIE =
  /\b(?:bg|text|border|from|to|via|ring|outline|fill|stroke|decoration|accent|caret|divide|placeholder|shadow)-(?:inherit|current|transparent|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/;

describe("nessun valore visivo letterale nei componenti", () => {
  const file = fileSorgente(["app", "components"], [".tsx", ".ts", ".css"], ["app/fonts/"]);

  it("trova i file da controllare", () => {
    expect(file).toContain("app/layout.tsx");
    expect(file).toContain("app/globals.css");
    expect(file).toContain("components/Intestazione.tsx");
  });

  for (const rel of file) {
    it(`${rel}`, () => {
      const testo = leggi(rel);
      expect(testo, "colore esadecimale").not.toMatch(COLORE_ESADECIMALE);
      expect(testo, "valore in px").not.toMatch(VALORE_PX);
      expect(testo, "valore arbitrario fra parentesi quadre").not.toMatch(VALORE_ARBITRARIO);
      expect(testo, "classe della tavolozza Tailwind di serie").not.toMatch(TAVOLOZZA_DI_SERIE);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Contrast — WCAG 2.x relative luminance
// ---------------------------------------------------------------------------

function luminanza(esadecimale: string): number {
  const canale = (i: number) => {
    const v = parseInt(esadecimale.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canale(1) + 0.7152 * canale(3) + 0.0722 * canale(5);
}

function contrasto(a: string, b: string): number {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (chiaro + 0.05) / (scuro + 0.05);
}

const valore = (nome: NomeColore | "#FFFFFF") => (nome === "#FFFFFF" ? nome : colori[nome]);

describe("contrasto delle coppie dichiarate (SPEC §13.7)", () => {
  for (const { primoPiano, sfondo } of coppieContrasto) {
    it(`${primoPiano} su ${sfondo} raggiunge ${CONTRASTO_MINIMO}:1`, () => {
      expect(contrasto(colori[primoPiano], colori[sfondo])).toBeGreaterThanOrEqual(CONTRASTO_MINIMO);
    });
  }

  for (const { primoPiano, sfondo } of coppieVietate) {
    it(`${primoPiano} su ${sfondo} resta vietato`, () => {
      expect(contrasto(valore(primoPiano), colori[sfondo])).toBeLessThan(CONTRASTO_MINIMO);
    });
  }

  it("il testo sul verde è sempre `testo` (mai bianco)", () => {
    expect(coppieContrasto).toContainEqual({ primoPiano: "testo", sfondo: "verde" });
    expect(contrasto("#FFFFFF", colori.verde)).toBeLessThan(CONTRASTO_MINIMO);
  });
});

// ---------------------------------------------------------------------------
// 3. Spec table and tokens coincide
// ---------------------------------------------------------------------------

describe("la tabella di SPEC §13.3 e config/tokens.ts coincidono", () => {
  it("stessi nomi, stessi valori", () => {
    const spec = leggi("docs/SPEC.md");
    const inizio = spec.indexOf("### 13.3 Colori");
    const fine = spec.indexOf("### 13.4");
    expect(inizio).toBeGreaterThan(0);
    const tabella = spec.slice(inizio, fine);
    const daSpec: Record<string, string> = {};
    for (const riga of tabella.split("\n")) {
      const m = /^\| `([a-z-]+)` \| `(#[0-9A-Fa-f]{6})` \|/.exec(riga);
      if (m) daSpec[m[1]] = m[2].toUpperCase();
    }
    expect(daSpec).toEqual(colori);
  });
});

// ---------------------------------------------------------------------------
// 4. The compiled theme contains only token classes
// ---------------------------------------------------------------------------

describe("tema Tailwind generato dai token", () => {
  const DI_SERIE = ["bg-red-500", "text-gray-500", "bg-white", "text-black", "font-medium", "font-semibold", "text-sm", "text-lg", "rounded-lg", "shadow", "shadow-md", "md:flex", "lg:flex"];
  const DAI_TOKEN = [
    "bg-sfondo",
    "bg-verde",
    "text-testo",
    "text-verde-testo",
    "text-errore",
    "border-linea",
    "font-regolare",
    "font-grassetto",
    "text-nota",
    "text-corpo",
    "text-titolo-pagina",
    "grande:text-titolo-pagina-grande",
    "rounded-controllo",
    "min-h-tocco",
    "h-logo",
    "max-w-contenuto",
    "outline-fuoco",
    "outline-offset-fuoco",
    "p-4",
  ];

  it("nessuna classe di serie, tutte quelle dei token", async () => {
    const css = leggi("app/globals.css");
    const compilatore = await compile(css, { base: join(RADICE, "app"), onDependency() {} });
    const uscita = compilatore.build([...DI_SERIE, ...DAI_TOKEN]);
    const selettore = (classe: string) => "." + classe.replace(/[^a-zA-Z0-9-]/g, (c) => "\\" + c);
    for (const classe of DI_SERIE) expect(uscita, classe).not.toContain(selettore(classe));
    for (const classe of DAI_TOKEN) expect(uscita, classe).toContain(selettore(classe));
    expect(uscita).toContain(`background-color: ${colori.sfondo}`);
  });

  it("le regole di base ricevono i valori dei token", async () => {
    const css = leggi("app/globals.css");
    const compilatore = await compile(css, { base: join(RADICE, "app"), onDependency() {} });
    // No candidate at all: the base layer alone must carry the resolved values.
    const uscita = compilatore.build([]);
    const base = uscita.slice(uscita.indexOf("html {"));
    expect(base).toContain(`background-color: ${colori.sfondo}`);
    expect(base).toContain(`color: ${colori.testo}`);
    expect(base).toContain(`color: ${colori["verde-testo"]}`);
    expect(base).toContain(`font-size: ${tipografia.corpi.corpo / PX_PER_REM}rem`);
    expect(base).toContain(`outline-width: ${forma.contornoFuoco.spessore}px`);
    expect(base).toContain(`outline-offset: ${forma.contornoFuoco.distanza}px`);
  });
});

// ---------------------------------------------------------------------------
// 5. Self-hosted font
// ---------------------------------------------------------------------------

describe("carattere ospitato sul nostro dominio (SPEC §13.4)", () => {
  const dichiarazione = leggi("app/font.ts");
  const pesiAmmessi = Object.values(tipografia.pesi).map(String);

  it("dichiara file esistenti, con i soli pesi ammessi", () => {
    const voci = [...dichiarazione.matchAll(/path:\s*"([^"]+)",\s*weight:\s*"(\d+)"/g)];
    expect(voci.length).toBeGreaterThanOrEqual(2);
    for (const [, percorso, peso] of voci) {
      expect(existsSync(join(RADICE, "app", percorso)), percorso).toBe(true);
      expect(pesiAmmessi, `peso ${peso}`).toContain(peso);
    }
  });

  it("nessun riferimento a Google Fonts nel codice", () => {
    const file = fileSorgente(["app", "components", "config", "lib"], [".tsx", ".ts", ".css"]);
    file.push("next.config.ts");
    for (const rel of file) {
      expect(leggi(rel), rel).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|next\/font\/google/);
    }
  });
});
