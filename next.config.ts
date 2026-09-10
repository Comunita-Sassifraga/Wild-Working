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
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
