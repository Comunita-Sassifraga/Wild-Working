import { defineConfig } from "vitest/config";

// Tests run against the local Supabase stack (`supabase start`). Files run
// one at a time: each creates its own users and sedi, and the concurrency
// test measures a race that a busy database would blur.
export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
