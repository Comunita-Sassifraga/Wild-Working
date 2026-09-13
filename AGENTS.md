# AGENTS.md

**The instructions for this repository are in `CLAUDE.md`.** Read that file:
it is the one written and reviewed by hand, and it is the one that wins.

This file exists for a single reason. `next dev` appends a managed block of
its own — the one between the markers below — to `AGENTS.md` when that file
is present, and to `CLAUDE.md` when it is not. Keeping this file here keeps
that block out of `CLAUDE.md`, which nothing but a person should write. Do
not delete it, and do not edit anything between the markers: Next rewrites it
on its own, and only when an AI agent is the one running the dev server.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
