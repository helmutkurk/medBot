# Overnight plan — Sat 28-11 04:00 → 10:00

Claude (coordinator), 2026-11-28. Helmut asleep; treat 11:00 as delivery. Coordinator does not code: it writes
briefs, launches executors, verifies independently and records decisions in `docs/decisions.md`.
Progress log: `docs/overnight-progress.md`. Read both after any context reset.

## Hard limits
- Push only `feat/Helmut`, normal push; never force, never `main`, never open/approve/merge PRs.
- Bring `main` in by merge, not rebase. Stage named paths only. No agent attribution in commits.
- Synthetic cases only. **No personal data about judges or anyone real**; "judges analysis" = public info
  about the Avelios challenge and company only. No real patient recordings (doctor-recording idea is a
  pitch roadmap item with consent/pseudonymisation, not built tonight).
- No mocks in the product. Ask-before-dependency rule (AGENTS.md): **no new npm dependencies tonight**;
  everything with platform APIs (PWA manifest, service worker, Notifications, CSS, SVG).
- Every prompt/case change: paired eval before acceptance; never accept more invented facts or less coverage.

## Quota rule
If an executor's quota runs out: wait with a timer if the reset is soon, otherwise hand the brief to the other provider (Sonnet ↔ Codex); re-check `creditos` before each launch.

## Executors and quota (check `vault_guard.py creditos` before each launch)
- Codex `gpt-6.1-sol high` (`codex-encargo`) for code; resets 05:40, weekly 36 % → bulk of the night.
- Claude Sonnet for code/research while Codex is out; Haiku for reading. Claude week 88 % until 10:59 → sparing.
- Max 2 parallel. Disjoint paths per task; `git status` before each launch.

## Workstreams (value order)
| # | Stream | Executor | Paths | Acceptance |
| --- | --- | --- | --- | --- |
| A | Consistency gate: eval v4 of corrected cases (running) | — | cases/, prompt.ts | invented/contradiction/unprompted ≤ previous and → 0; persona ≥ 80 % |
| B | Competitor research: similar products/papers, steal list | Sonnet (web) | docs/research/competitors.md | ≥ 8 products, features table, top-10 adoptable ideas ranked |
| C | Merge `main` (Christoph's 5 cases + catalogue), adapt cases to current schema/tests | Codex | cases/, docs/cases.md | check green, cases playable |
| D | Voice sprint (`docs/voice-plan.md`): felt latency meter, voice prompt v2, pre-warm, VAD choice | Codex | components/realtime, app/api/session, lib/case/prompt.ts | bench 0 issues, felt p50 < 1 s |
| E | Gamification + learning science: XP, levels, daily goal, streak + freeze, badges, opt-in nickname leaderboard (server JSON store, nickname only), test modes (full interview, red-flag sprint 3 min, OSCE station 8 min timed, "best next question" quiz from real case data, spaced red-flag review), mascot + logo (original SVG), learning colour system | Codex | lib/engine/gamification.ts, components/game/*, app/leaderboard, app/api/leaderboard | tests, check, no dead ends |
| F | Mobile web app: PWA manifest, icons, service worker (shell only, API never cached), bottom nav on small screens, install prompt, opt-in local reminder notifications | Codex/Sonnet | app/manifest.ts, public/, components/MobileNav* | Lighthouse-style checks manual, 375 px screenshots |
| G | Competitor steal list → implement the top 2–3 that fit (after B) | Codex | per idea | each with acceptance |
| H | Pitch ideas + rewrite pitch/demo/devpost around final features and numbers | Sonnet → Opus review | docs/event/* | ≤ 3 min script, all numbers bound to artifacts |
| I | Final evidence: eval n ≥ 5 per cell, voice bench all cases | coordinator | eval/ | `/eval` updated |
| K | Hosting for real feedback from doctor friends: Vercel (not GitHub Pages: app needs server routes + secret key). Access passcode, per-IP rate limit + daily spend cap, serverless-safe storage for leaderboard/traces (no new deps → Vercel env + fetch-based store or disable server-file features in hosted mode), privacy notice, in-app feedback form. Deploy itself waits for Helmut (his account) | Codex | lib/server/*, app/api/*, middleware/proxy, docs/deploy.md | `npm run check`, local prod run with HOSTED=1 |
| J | UI review pass at 375/1280 px via browser screenshots; fix top issues | Sonnet | components/, app/ | screenshots in progress log |

Order: A,B now · C,D at 05:40 · E,F next · G,H · I,J last. Helmut in the morning: voice audition, headset test,
backup video, sponsor talks, team merge.
