import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The defaults: no incremental cache, no queue, no tag cache. They would all
// need Cloudflare resources (R2, D1, Durable Objects) that this local trial
// does not create. The app renders every page per request anyway — the
// availability grid must never be served from a cache older than the write
// that changed it (SPEC §8.4).
export default defineCloudflareConfig();
