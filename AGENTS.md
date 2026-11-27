# Agent rules (Claude Code, Codex)

- Project: medBot, see README.md. Code, docs and commits in English.
- Work on a branch `name/topic` and open a pull request to `main`; never force-push or rewrite shared history.
- Stage named paths only (no `git add -A` / `git add .`).
- Never read, print or commit real environment files or keys; only the example file with placeholders.
- Ask before adding a dependency; never hand-edit lockfiles.
- Patient cases are synthetic; no real patient data.
- Commits are authored by the human you work for; no agent attribution lines.
- Measure latency end to end from the first prototype.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
