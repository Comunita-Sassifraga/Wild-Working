import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output of the Cloudflare adapter and local state of the Worker,
    // both ignored by git too. Without these, `npm run lint` reads the
    // compiled program — tens of thousands of complaints about code nobody
    // wrote — as soon as `npm run cloudflare:build` has run once.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
