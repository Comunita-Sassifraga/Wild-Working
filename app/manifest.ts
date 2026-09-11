import type { MetadataRoute } from "next";
import { colori } from "@/config/tokens";
import { m } from "@/lib/messaggi";

/**
 * What the phone reads to put the app on the Home screen — SPEC §12 step 13.
 * Next serves it at /manifest.webmanifest and links it from every page.
 *
 * The short name is what fits under the icon: about twelve characters, so
 * "Prenota — Comunità Sassifraga" would be cut. Both names live in
 * messages/it.json like every other word a person reads.
 *
 * The colours come from config/tokens.ts (rule 12). `theme_color` is the
 * one the phone paints its own frame with, and `sfondo` is what the header
 * already sits on (§13.8): the app keeps the site's cream ground right up
 * to the edge of the screen instead of opening inside a white border.
 *
 * `display: standalone` is what makes the installed app open without the
 * browser's address bar. `start_url` is the availability page, which is
 * also the only page kept for reading without a connection (§8.4).
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: m.app.nomeInstallato,
    short_name: m.app.nomeBreve,
    description: m.app.descrizione,
    lang: "it",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: colori.sfondo,
    theme_color: colori.sfondo,
    icons: [
      { src: "/icona-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icona-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops the icon to a circle, a squircle or a rounded square
      // depending on the phone, and only guarantees the middle of the square:
      // this one carries the wider margin that survives the crop.
      { src: "/icona-mascherabile-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
