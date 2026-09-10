import { defineConfig } from "vitest/config";

// Tests run against the local Supabase stack (`supabase start`). Files run
// one at a time: each creates its own users and sedi, and the concurrency
// test measures a race that a busy database would blur.
export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    // Step 9 sends real email. POSTA_LOCALE forces every message into the
    // local Mailpit even on a machine that has a Resend key configured: a
    // test run must never be able to reach a real mailbox. The other two are
    // the values the messages are built from (SPEC §10).
    env: {
      POSTA_LOCALE: "http://127.0.0.1:54324",
      EMAIL_MODERAZIONE: "moderazione@example.test",
      URL_APP: "http://127.0.0.1:3000",
    },
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
