---
name: testing-qa
description: Use when choosing or running checks for medBot changes, validating a demo flow or claiming work is done; use Node tests, the production HTTP smoke and paired eval evidence for prompt or case edits.
---

# Testing and QA

Author: Codex, 2026-11-28.

Read `AGENTS.md`, `README.md`, `package.json` and relevant tests/scripts. Match checks to the failure risk and report what they actually establish. Use this repository's TypeScript/Next.js commands, not the former Python architecture.

## Choose useful checks

- Use Node 26's native test runner (`node:test`, `node:assert/strict`); native TypeScript stripping also supports Node ≥24 per `package.json`. Keep TypeScript strict, erasable syntax only, and relative imports ending in `.ts` in engine/scripts/tests.
- Test observable behaviour at changed boundaries: case validation/disclosure, structured-output parsing, route validation/error mapping, reports and trace privacy as applicable. Avoid tests that mirror implementation, assert framework internals or add ceremony to reversible documentation/styling edits.
- Keep tests offline by stubbing `fetch` with real OpenAI response envelopes and restoring the stub. Use placeholder keys, synthetic cases and isolated test trace output via `tests/trace-setup.ts`. Do not add a fake mode, alternate provider or canned product fallback to make tests pass.
- Announce changes to `lib/case/types.ts`, the shared web/engine contract. Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before writing framework code. Ask before adding dependencies; pin exact versions and let the package manager update lockfiles.

## Run the repository commands

Run from the repo root:

| Command | What it establishes |
| --- | --- |
| `npm test` | Offline native Node tests, including the trace setup import. |
| `npm run typecheck` | Strict TypeScript validation. |
| `npm run check` | Required before implementation completion: typecheck, offline tests and production build. |
| `npm run smoke` | After a build, HTTP-only production smoke with an empty API key; no browser or paid provider calls. |
| `npm run eval -- --n 3` | Live OpenAI text interviews; required before/after prompt or case changes, with budget and evidence review. |

Inspect `scripts/smoke-web.sh` when changing the production flow. Its current checks cover the setup screen, health `ready:false`, cases, `/eval` and chat 503 `no_api_key`; it starts/stops a server and cleans its temporary files. It does not verify live chat, microphone playback or visual layout. If localhost listeners are blocked, report that and provide `npm run check && npm run smoke` for a permitted environment.

Do not read real environment files. The eval command loads local environment settings itself and spends API budget; check `/usage?source=eval` against the capped key. Keep evaluation outputs under `eval/results/` and traces under `traces/llm.jsonl` in ordinary authorized runs. Respect task-specific write restrictions: if build/eval/test artifacts would exceed the allowed scope, report the unrun check and exact command instead of bypassing the restriction.

## Apply the prompt/case gate

1. Preserve baseline and candidate run files with matched cases, personalities, repeats, turn limits and model settings. Run `npm run eval -- --n 3` on each version; record before/after numbers and artifact paths in the PR.
2. Block merging any change that adds invented facts or lowers coverage, as `AGENTS.md` requires. Apply the roadmap's no-raised-issues rule to contradictions and unprompted disclosure too. Compare affected cells, not just pooled totals; inspect transcripts for newly introduced failure types.
3. Do not infer the gate from CLI exit status alone. The current harness exits nonzero for detected inventions or contradictions; reduced coverage and disclosure regressions require an explicit comparison. Label guard-derived issue counts and patient-ID-derived coverage as fallible automated measurements.
4. Use `patient-evaluation` for fixed probes, judge calibration, paired comparisons, denominators and uncertainty. Keep ≥5 repeats per case/personality as the pre-freeze goal, distinct from the required `--n 3` baseline. Record failed/incomplete attempts; never publish only successful runs as all attempts.

## Check the real demo flow separately

Run the app in a permitted environment with `npm run dev`, then use a real browser/headset to select a case/personality, interview by voice and text, ask direct safety questions, repeat a question, interrupt and recover, end the interview and inspect coach/anamnesis/export. Switch personality and confirm a fresh interview. Check loading/error states and microphone-denial recovery to OpenAI text, plus the no-key setup path. Check narrow and wide layouts and keyboard access when UI changed.

Keep text completion latency, browser round-trip, voice-event onset and audible response separate. Confirm disclosure tools and long-conversation memo updates during live voice testing; the text harness cannot establish those. Keep a backup recording for a failed live demo, not fake runtime replies. Do not launch Chrome/Chromium/Playwright/Puppeteer inside a browser-restricted sandbox; leave any requested automation script ready and give the exact external command instead.

## Report completion

List commands actually run, exit status and relevant counts/artifacts. Identify failures, skipped checks and concrete limits such as blocked listeners or unavailable live API/voice access. Do not call a fetch-stub test a live integration or a text eval a voice test. Re-run required checks after subsequent code changes or integration, then hand over remaining risks without inventing results.

## Sources

Primary authority: this repo's `AGENTS.md`, `package.json`, README, `scripts/smoke-web.sh`, `scripts/eval.ts` and tests. Derived evidence/reporting ideas: [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `mllm-eval`, `check-reporting`; [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `experimental-design`, `scientific-writing`, via supplied research notes. Text is original, not copied. Clinical content and review belong to the case-design checklist.
