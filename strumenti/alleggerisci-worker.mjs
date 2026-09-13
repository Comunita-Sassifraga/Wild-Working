/**
 * Removes `@vercel/og` from the compiled Worker, where the Cloudflare adapter
 * leaves it behind. Runs after `opennextjs-cloudflare build`:
 *
 *   node strumenti/alleggerisci-worker.mjs
 *
 * `@vercel/og` is Next's own image generator, vendored inside
 * `next/dist/compiled/` — not a dependency of this project and nothing to do
 * with the host we left (SPEC D25). It draws the preview images social
 * networks show for a link. This app declares none: `ImageResponse` appears
 * nowhere in `app/`, and no route is an `opengraph-image`.
 *
 * **The reason for removing it is not its weight.** Inside the library there
 * is live code that fetches `https://fonts.googleapis.com` and six references
 * to `cdn.jsdelivr.net`. Unreachable — nothing constructs an `ImageResponse`,
 * so none of it ever runs — but CLAUDE.md keeps the font self-hosted and the
 * app free of third parties precisely so that no visitor's address can reach
 * Google, and a dormant call to Google Fonts inside the Worker is not
 * something this project should have to explain. The 543 KiB of `.wasm` and
 * the ~190 KiB of JavaScript that go with it are a side benefit.
 *
 * **It is an adapter gap, not a mistake of ours.** The maintainers wrote this
 * exact fix in `@opennextjs/cloudflare` 1.19.4 — aliasing the library to a
 * throwing shim when the app does not use it, for the same reason, the 3 MB
 * free-plan limit. They apply it when bundling the server half only. The half
 * that compiles `proxy.ts` — the one the adapter itself announces as
 * experimental and not officially maintained — was missed. When the fix
 * reaches that half too, this file goes away: see PROVA-CLOUDFLARE.md.
 *
 * The script refuses to guess. If the app ever does use `ImageResponse` it
 * leaves the build alone; if the generated code no longer looks the way it
 * expects, it stops and fails the build rather than publish something it did
 * not understand.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RADICE = join(import.meta.dirname, "..");
const PROGRAMMA = join(RADICE, ".open-next", "middleware", "handler.mjs");
const MODULO = "node_modules/next/dist/compiled/@vercel/og/index.edge.js";
const MARCATORE = `// ${MODULO}`;

/** Everything that must be gone when this script has done its work. */
const TRACCE = ["fonts.googleapis.com", "cdn.jsdelivr.net", "resvg", "satori", "yoga"];

/**
 * Whether the app itself uses the library.
 *
 * The same question the adapter asks, asked the same way: Next records the
 * files each route needs in a `.nft.json` beside it, and a route that builds
 * an image lists the Node version of the library among them. No route does
 * today — but if one ever did, removing the library would break it, so the
 * script steps aside instead.
 */
function applicazioneUsaLeImmagini() {
  const tracciati = [];
  const percorri = (cartella) => {
    for (const voce of readdirSync(cartella)) {
      const percorso = join(cartella, voce);
      if (statSync(percorso).isDirectory()) percorri(percorso);
      else if (voce.endsWith(".nft.json")) tracciati.push(percorso);
    }
  };
  percorri(join(RADICE, ".next", "server"));
  return tracciati.some((p) => readFileSync(p, "utf8").includes("@vercel/og/index.node.js"));
}

/**
 * The line range of the library inside the compiled file.
 *
 * esbuild writes one `// <path>` comment at the head of every module it
 * bundles, so the library runs from its own comment to the line before the
 * next one — and ends by closing the lazy wrapper esbuild puts around it.
 * Each of those expectations is checked, because the day one of them stops
 * holding is the day this script must stop rather than cut blindly.
 */
function intervalloDelModulo(righe) {
  const inizio = righe.findIndex((riga) => riga.trim() === MARCATORE);
  if (inizio < 0) return null;

  let fine = righe.findIndex((riga, i) => i > inizio && riga.startsWith("// ")) - 1;
  if (fine < inizio) throw new Error(`${MODULO}: non trovo dove finisce il modulo`);
  while (fine > inizio && righe[fine].trim() === "") fine--;
  if (righe[fine].trim() !== "});") {
    throw new Error(`${MODULO}: la riga ${fine + 1} doveva chiudere il modulo, invece è "${righe[fine].trim()}"`);
  }

  const corpo = righe.slice(inizio, fine + 1).join("\n");
  for (const traccia of ["resvg.wasm", "yoga.wasm", "fonts.googleapis.com"]) {
    if (!corpo.includes(traccia)) {
      throw new Error(`${MODULO}: manca "${traccia}" — non è il codice che questo script si aspetta`);
    }
  }
  return { inizio, fine };
}

/**
 * What takes its place: the same shape esbuild left behind — the module
 * object, its lazy initialiser, the one name it exports — with an
 * `ImageResponse` that throws. The same thing the adapter's own shim does on
 * the other half of the program, so a route that somehow reached it would
 * fail loudly instead of quietly returning nothing.
 */
const SOSTITUZIONE = [
  `${MARCATORE} (removed by strumenti/alleggerisci-worker.mjs)`,
  "var index_edge_exports = {};",
  "__export(index_edge_exports, {",
  "  ImageResponse: () => ImageResponse",
  "});",
  "var ImageResponse;",
  "var init_index_edge = __esm({",
  `  "${MODULO}"() {`,
  "    ImageResponse = class {",
  "      constructor() {",
  '        throw new Error("ImageResponse is not part of this application");',
  "      }",
  "    };",
  "  }",
  "});",
];

let programma;
try {
  programma = readFileSync(PROGRAMMA, "utf8");
} catch {
  throw new Error(`non trovo ${PROGRAMMA} — compila prima con "npm run cloudflare:build"`);
}

if (applicazioneUsaLeImmagini()) {
  console.log("l'applicazione genera immagini di anteprima: la libreria resta dov'è, niente da fare");
  process.exit(0);
}

const righe = programma.split("\n");
const intervallo = intervalloDelModulo(righe);

if (!intervallo) {
  // Either the script has already run on this build, or the adapter has
  // stopped bundling the library. Both are fine; a leftover would not be.
  const rimaste = TRACCE.filter((traccia) => programma.includes(traccia));
  if (rimaste.length > 0) {
    throw new Error(`la libreria non c'è più ma restano ${rimaste.join(", ")} — controllare a mano`);
  }
  console.log("libreria già assente, niente da fare");
  process.exit(0);
}

const { inizio, fine } = intervallo;
const alleggerito = [...righe.slice(0, inizio), ...SOSTITUZIONE, ...righe.slice(fine + 1)].join("\n");

const rimaste = TRACCE.filter((traccia) => alleggerito.includes(traccia));
if (rimaste.length > 0) {
  throw new Error(`dopo la rimozione restano ancora ${rimaste.join(", ")} — il file non è stato scritto`);
}

writeFileSync(PROGRAMMA, alleggerito);
const risparmio = (programma.length - alleggerito.length) / 1024;
console.log(
  `@vercel/og rimossa: righe ${inizio + 1}-${fine + 1}, ${risparmio.toFixed(0)} KiB non compressi, ` +
    "più i due file .wasm che wrangler non caricherà più",
);
