import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // The sign-in link carries its token in the URL. The dev server prints
    // every incoming URL: keep that one out (CLAUDE.md rule 4). The token is
    // consumed by the very request that would log it, and the app itself
    // never writes it anywhere.
    incomingRequests: { ignore: [/^\/auth\/conferma/] },
  },
  // Local sign-in emails link to 127.0.0.1 (supabase/config.toml site_url),
  // while `next dev` binds to localhost: let the two hosts share dev assets.
  //
  // Testing from a real phone means opening the dev server at the machine's
  // address on the local network, and that address is a third origin: without
  // it here the page arrives but every stylesheet and script is refused with
  // a 403, which looks like a broken app rather than a blocked request. It
  // comes from DEV_ORIGINE_RETE in .env.local — never written here, so that
  // nobody's home network address ends up in the repository, and so that a
  // new address after a router restart is one line to change.
  allowedDevOrigins: ["127.0.0.1", process.env.DEV_ORIGINE_RETE].filter(
    (origine): origine is string => Boolean(origine),
  ),
  // public/sw.js decides what stays readable without a connection (§8.4).
  // A browser that kept its own old copy of that file could go on serving
  // the pages by yesterday's rules for up to a day after a release, so it
  // is asked to check this one every time.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
