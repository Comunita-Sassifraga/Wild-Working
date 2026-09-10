import type { Config } from "tailwindcss";
import { colori, forma, PX_PER_REM, spaziatura, tipografia } from "./config/tokens";

/**
 * Tailwind theme generated from config/tokens.ts — SPEC §13, CLAUDE.md
 * rule 12. Loaded by app/globals.css through `@config`.
 *
 * Every namespace set here at top level REPLACES the Tailwind default: the
 * stock palette, sizes, weights, radii, breakpoints and shadows do not exist
 * in this app. tests/tokens.test.ts compiles the theme and checks that.
 *
 * Type sizes and spacing are emitted in rem so that system text zoom
 * (§13.7, up to 200%) scales the whole layout. Radii, rules and outlines
 * stay in px: they are hairlines, not text.
 *
 * Font sizes are named `corpo`, `nota`, `titolo-*` so that `text-testo`
 * stays unambiguous: it is the colour.
 */

const rem = (px: number) => `${px / PX_PER_REM}rem`;
const px = (n: number) => `${n}px`;
const corpo = (px: number, interlinea: number): [string, string] => [rem(px), String(interlinea)];

const config = {
  theme: {
    colors: {
      ...colori,
      trasparente: "transparent",
      attuale: "currentColor",
    },
    fontFamily: {
      sans: ["var(--font-inclusive)", ...tipografia.fallback],
    },
    fontWeight: {
      regolare: String(tipografia.pesi.regolare),
      grassetto: String(tipografia.pesi.grassetto),
    },
    fontSize: {
      nota: corpo(tipografia.corpi.nota, tipografia.interlinea.testo),
      corpo: corpo(tipografia.corpi.corpo, tipografia.interlinea.testo),
      "titolo-sezione": corpo(tipografia.corpi.titoloSezione, tipografia.interlinea.titolo),
      "titolo-pagina": corpo(tipografia.corpi.titoloPagina, tipografia.interlinea.titolo),
      "titolo-pagina-grande": corpo(tipografia.corpi.titoloPaginaGrande, tipografia.interlinea.titolo),
    },
    lineHeight: {
      testo: String(tipografia.interlinea.testo),
      titolo: String(tipografia.interlinea.titolo),
    },
    screens: {
      grande: px(tipografia.schermoGrande),
    },
    borderRadius: {
      controllo: px(forma.raggio.controllo),
      riga: px(forma.raggio.riga),
    },
    borderWidth: {
      DEFAULT: px(forma.spessoreLinea),
    },
    outlineWidth: {
      fuoco: px(forma.contornoFuoco.spessore),
    },
    outlineOffset: {
      fuoco: px(forma.contornoFuoco.distanza),
    },
    spacing: {
      DEFAULT: rem(spaziatura.base),
      tocco: rem(forma.areaTocco),
      logo: rem(forma.larghezze.logo),
    },
    maxWidth: {
      contenuto: rem(forma.larghezze.contenuto),
    },
    boxShadow: {},
    dropShadow: {},
  },
} satisfies Config;

export default config;
