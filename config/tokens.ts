/**
 * Visual identity tokens — SPEC §13.
 *
 * The only place a colour, font, size, radius or spacing value may be
 * written. tailwind.config.ts turns this file into the Tailwind theme and
 * clears every stock namespace it covers, so components can only use the
 * classes generated from here (CLAUDE.md rule 12). tests/tokens.test.ts
 * checks the contrast pairs, the match with SPEC §13.3, and that no
 * component carries a literal.
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

export type NomeColore = keyof typeof colori;

/** Minimum contrast for text — WCAG AA, SPEC §13.7. */
export const CONTRASTO_MINIMO = 4.5;

/**
 * Foreground/background pairs the design relies on. Every pair must reach
 * CONTRASTO_MINIMO (§13.7); tests/tokens.test.ts checks them.
 *
 * On `verde` (Stile 2) the only readable text colour is `testo`: white,
 * `verde-testo`, `errore` and `testo-secondario` all fail on green (§13.3,
 * §13.6). Links on a Stile 2 block are therefore `testo`, underlined.
 */
export const coppieContrasto: ReadonlyArray<{ primoPiano: NomeColore; sfondo: NomeColore }> = [
  { primoPiano: "testo", sfondo: "sfondo" },
  { primoPiano: "testo", sfondo: "superficie" },
  { primoPiano: "testo", sfondo: "superficie-scura" },
  { primoPiano: "testo", sfondo: "verde" },
  { primoPiano: "verde-testo", sfondo: "sfondo" },
  { primoPiano: "verde-testo", sfondo: "superficie" },
  { primoPiano: "verde-testo", sfondo: "superficie-scura" },
  { primoPiano: "testo-secondario", sfondo: "sfondo" },
  { primoPiano: "testo-secondario", sfondo: "superficie" },
  { primoPiano: "testo-secondario", sfondo: "superficie-scura" },
  { primoPiano: "avviso", sfondo: "sfondo" },
  { primoPiano: "avviso", sfondo: "superficie" },
  { primoPiano: "avviso", sfondo: "superficie-scura" },
  { primoPiano: "errore", sfondo: "sfondo" },
  { primoPiano: "errore", sfondo: "superficie" },
  { primoPiano: "errore", sfondo: "superficie-scura" },
];

/**
 * Pairs the spec forbids (§13.3, §13.7). The test asserts they really fail,
 * so the reason for `verde-testo` stays documented by a running check.
 * White is not a token: it is written out because it exists nowhere else.
 */
export const coppieVietate: ReadonlyArray<{ primoPiano: NomeColore | "#FFFFFF"; sfondo: NomeColore }> = [
  { primoPiano: "#FFFFFF", sfondo: "verde" },
  { primoPiano: "verde", sfondo: "sfondo" },
];

/** Typography — SPEC §13.4. One family, self-hosted, only the available weights. */
export const tipografia = {
  famiglia: "Inclusive Sans",
  /** Generic fallbacks only; no second design font exists. */
  fallback: ["system-ui", "sans-serif"],
  /** The only weights shipped in app/fonts. No design may depend on others. */
  pesi: { regolare: 400, grassetto: 700 },
  /** Starting scale [derivato], in px. Body (`corpo`) is 18: never smaller. */
  corpi: {
    nota: 15,
    corpo: 18,
    titoloSezione: 24,
    titoloPagina: 32,
    titoloPaginaGrande: 44,
  },
  /** Line heights [derivato], unitless. */
  interlinea: { testo: 1.5, titolo: 1.2 },
  /** Viewport width, in px, from which the "schermo grande" sizes apply. [derivato] */
  schermoGrande: 768,
} as const;

/** Shape — SPEC §13.5. Flat: no shadows, no cards. */
export const forma = {
  /** px. 4 on buttons and inputs, 0 on rules. */
  raggio: { controllo: 4, riga: 0 },
  /** px. Rules and input borders. */
  spessoreLinea: 1,
  /** px. Minimum touch target, both axes (§13.6). */
  areaTocco: 44,
  /** px. Keyboard focus outline, visible on every focusable element (§13.7). [derivato] */
  contornoFuoco: { spessore: 2, distanza: 2 },
  /** px. Maximum width of a text column, and height of the header logo. [derivato] */
  larghezze: { contenuto: 720, logo: 40 },
} as const;

/**
 * Spacing — SPEC §13.5. Every spacing class is a multiple of `base`:
 * `p-4` is 16px, `gap-6` is 24px. Tailwind derives the whole scale from
 * this one value, so nothing off the 4px grid can be expressed.
 */
export const spaziatura = { base: 4 } as const;

/** Root font size assumed by the browser; tokens in px become rem through it. */
export const PX_PER_REM = 16;
