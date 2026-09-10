/**
 * Visual identity tokens — SPEC §13.
 *
 * The only place a colour, font, size, radius or spacing value may be
 * written. Components use the Tailwind theme generated from this file
 * (wiring happens at step 3 of SPEC §12); never a literal.
 *
 * Values marked [dato] come from the association; [derivato] were derived
 * for functional reasons and are still to be confirmed (§13.1).
 */

/** Colours — SPEC §13.3. No other colour exists in the app. */
export const colori = {
  /** Page background. [dato] */
  sfondo: "#EBE8DD",
  /** Headings and body text. [dato] */
  testo: "#1C1C1C",
  /** Fills, logo, Stile 2 bands. NEVER text on sfondo (2.1:1). [dato] */
  verde: "#3FB75A",
  /** Links and green text on light backgrounds (5.4:1). [derivato] */
  "verde-testo": "#1A6B31",
  /** Labels, helper text. [derivato] */
  "testo-secondario": "#5A564C",
  /** 1px rules and input borders. [derivato] */
  linea: "#D6D2C4",
  /** Grid cells, slightly raised areas. [derivato] */
  superficie: "#F3F1E9",
  /** Unbookable cells, closed days. [derivato] */
  "superficie-scura": "#E0DCCD",
  /** "Last places", non-blocking warnings. [derivato] */
  avviso: "#8A5410",
  /** Validation errors, destructive actions. [derivato] */
  errore: "#A32020",
} as const;

/**
 * Foreground/background pairs the design relies on. Every pair must reach
 * 4.5:1 (§13.7); tests/tokens.test.ts (step 3) checks them.
 * Text on `verde` is always `testo`, never white (§13.3).
 */
export const coppieContrasto: ReadonlyArray<{
  primoPiano: keyof typeof colori;
  sfondo: keyof typeof colori;
}> = [
  { primoPiano: "testo", sfondo: "sfondo" },
  { primoPiano: "testo", sfondo: "superficie" },
  { primoPiano: "testo", sfondo: "superficie-scura" },
  { primoPiano: "testo", sfondo: "verde" },
  { primoPiano: "verde-testo", sfondo: "sfondo" },
  { primoPiano: "testo-secondario", sfondo: "sfondo" },
  { primoPiano: "avviso", sfondo: "sfondo" },
  { primoPiano: "errore", sfondo: "sfondo" },
];

/** Typography — SPEC §13.4. One family, self-hosted, only the available weights. */
export const tipografia = {
  famiglia: "Inclusive Sans",
  /** Generic fallbacks only; no second design font exists. */
  fallback: ["system-ui", "sans-serif"],
  pesi: { regolare: 400, grassetto: 700 } as const,
  /** Starting scale [derivato], in px. Body is 18: never smaller. */
  corpi: {
    nota: 15,
    testo: 18,
    titoloSezione: 24,
    titoloPaginaTelefono: 32,
    titoloPaginaSchermo: 44,
  },
} as const;

/** Shape — SPEC §13.5. Flat: no shadows, no cards. */
export const forma = {
  /** px. 4 on buttons and inputs, 0 on rules. */
  raggio: { controllo: 4, riga: 0 },
  /** px. Rules and input borders. */
  spessoreLinea: 1,
  /** px. Minimum touch target, both axes (§13.6). */
  areaTocco: 44,
} as const;

/** Spacing scale — SPEC §13.5. Multiples of 4px. */
export const spaziatura = {
  base: 4,
  scala: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96] as const,
} as const;
