import localFont from "next/font/local";

/**
 * Inclusive Sans, self-hosted — SPEC §13.4. Next serves these files from
 * our own domain: no request ever goes to Google Fonts. Only the weights
 * in config/tokens.ts (`tipografia.pesi`) are shipped; the slashed zero is
 * the font's default glyph and is left as is.
 *
 * The files are the latin subset of the Google Fonts release, packaged by
 * Fontsource; licence in app/fonts/LICENSE-OFL.txt. tests/tokens.test.ts
 * checks that every file listed here exists and uses an allowed weight.
 */
export const inclusiveSans = localFont({
  src: [
    { path: "./fonts/inclusive-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inclusive-sans-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/inclusive-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/inclusive-sans-latin-700-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-inclusive",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
