# Agent rules (Claude Code, Codex)

Goal: win the Avelios "VIP – Virtual Interview Patient" challenge at hackaTUM 2026. Read README.md,
docs/winning-plan.md (story, demo), docs/next-steps.md (current to-do) and docs/roadmap.md (deadlines).

## Working
- Code, docs and commits in English. TypeScript strict; Node 26 runs `lib/`, `scripts/`, `tests/` directly:
  relative imports with `.ts`, erasable TypeScript only.
- `lib/case/types.ts` is the shared contract between web (`app/`, `components/`, `lib/server/`) and engine
  (`lib/case/`, `lib/engine/`, `cases/`, `scripts/`); announce changes to it.
- OpenAI only, no mock mode in the product. Tests stay offline by stubbing `fetch` with real response shapes.
- Before done: `npm run check`. Prompt or case changes also need an eval run (`npm run eval -- --n 3`) with
  before/after numbers in the PR; never merge a change that adds invented facts or lowers coverage.
- Every OpenAI call is traced (`traces/llm.jsonl`, metadata only); watch `/usage` against the capped key.

## Git
- Branch `name/topic` (lead: `feat/Helmut`), pull request to `main`; main is always demoable.
  Never force-push or rewrite shared history. Stage named paths only (no `git add -A` / `git add .`).
- Commits are authored by the human you work for; no agent attribution lines.

## Safety
- Never read, print or commit real environment files or keys; only `.env.example`. `local-only/` stays private.
- Ask before adding a dependency; exact versions; never hand-edit lockfiles.
- Patient cases are synthetic; no real patient data and no personal data about real people (judges included).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
