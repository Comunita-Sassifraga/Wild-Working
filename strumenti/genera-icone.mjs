/**
 * Generates the home-screen icons of SPEC §12 step 13 from public/logo.png.
 *
 *   node strumenti/genera-icone.mjs
 *
 * The icon §13.10 asks for — square, logo on a solid ground, inner margin —
 * does not exist yet as a drawn asset. This script derives a provisional one
 * from the official PNG logo, exactly as components/Intestazione.tsx uses
 * that same PNG until the vector version arrives. When the real logo lands,
 * replace public/logo.png and run this again: nothing else changes.
 *
 * The ground is `sfondo` read from config/tokens.ts, so the icon cannot
 * drift from the palette of §13.3 (CLAUDE.md rule 12). The green logo needs
 * a light ground: on `verde` it would disappear, and the dark version of the
 * logo §13.10 asks for does not exist either.
 *
 * `sharp` is not a dependency of the app — it arrives with Next and is used
 * here only, by hand, when the icons have to be rebuilt.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const RADICE = join(import.meta.dirname, "..");
const LOGO = join(RADICE, "public", "logo.png");

// The one colour value in this file comes from the tokens, never typed out.
const tokens = readFileSync(join(RADICE, "config", "tokens.ts"), "utf8");
const SFONDO = /sfondo:\s*"(#[0-9A-Fa-f]{6})"/.exec(tokens)?.[1];
if (!SFONDO) throw new Error("colore `sfondo` non trovato in config/tokens.ts");

/**
 * Each icon, with the share of its side left empty around the logo.
 *
 * The maskable one gets a much wider margin: Android crops the icon to a
 * circle, a squircle or a rounded square depending on the phone, and only
 * the middle 80% of the side is guaranteed to survive — a logo drawn to the
 * edge would lose its flowers.
 */
const ICONE = [
  { file: "icona-192.png", lato: 192, margine: 0.14 },
  { file: "icona-512.png", lato: 512, margine: 0.14 },
  { file: "icona-mascherabile-512.png", lato: 512, margine: 0.25 },
  { file: "icona-apple-180.png", lato: 180, margine: 0.14 },
];

/**
 * The drawing inside logo.png, without the empty canvas around it.
 *
 * `sharp.trim()` is not enough here: the file carries a scatter of nearly
 * invisible pixels along its edges, so the bounding box of "anything not
 * transparent" is the whole canvas and the logo ends up off centre. A row
 * or a column counts as part of the drawing when at least one percent of it
 * is opaque — well above the handful of stray pixels, well below the
 * hundreds that any real line of the logo covers.
 */
async function riquadroDisegnato(percorso) {
  const { data, info } = await sharp(percorso).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const colonne = new Array(width).fill(0);
  const righe = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + channels - 1] > 128) {
        colonne[x]++;
        righe[y]++;
      }
    }
  }
  const esteso = (conteggi, minimo) => {
    const pieni = conteggi.flatMap((n, i) => (n >= minimo ? [i] : []));
    return [pieni[0], pieni[pieni.length - 1]];
  };
  const [sinistra, destra] = esteso(colonne, height / 100);
  const [alto, basso] = esteso(righe, width / 100);
  return { left: sinistra, top: alto, width: destra - sinistra + 1, height: basso - alto + 1 };
}

const riquadro = await riquadroDisegnato(LOGO);
const ritagliato = await sharp(LOGO).extract(riquadro).toBuffer();
console.log(`disegno ritagliato: ${riquadro.width}×${riquadro.height} da ${riquadro.left},${riquadro.top}`);

for (const { file, lato, margine } of ICONE) {
  const dentro = Math.round(lato * (1 - margine * 2));
  const logo = await sharp(ritagliato).resize(dentro, dentro, { fit: "inside" }).png().toBuffer();
  const { width = 0, height = 0 } = await sharp(logo).metadata();
  const png = await sharp({
    create: { width: lato, height: lato, channels: 4, background: SFONDO },
  })
    .composite([
      { input: logo, left: Math.round((lato - width) / 2), top: Math.round((lato - height) / 2) },
    ])
    .png()
    .toBuffer();
  writeFileSync(join(RADICE, "public", file), png);
  console.log(`${file} — ${lato}×${lato}, logo ${width}×${height} su ${SFONDO}`);
}
