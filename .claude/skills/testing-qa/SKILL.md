---
name: testing-qa
description: Use when deciding which tests to write and run: smallest useful tests, a smoke script, a click-through checklist and what must pass before claiming a task or slice done.
---

# testing-qa

Author: Claude (Sonnet), 2026-11-21. Goal: confidence for the demo, not coverage.

## What to test (smallest useful set)
1. Contract: fixtures and API models validate against `contracts/` (one test each side).
2. Core logic: pure functions with a table of 3-5 cases including an edge case.
3. Routes: success, validation failure, one upstream failure, with fakes and no network.
4. UI: one test for the main component state logic; the rest by click-through.
5. Do not write tests for framework behavior, styling or throwaway code.

## Commands
```sh
bash scripts/check.sh --tooling-only      # shell tooling, JSON/Markdown sanity
bash app/check.sh                          # API lint+tests, web lint+typecheck+test+build, smoke
cd app/api && uv run --locked pytest -q
cd app/web && npm run check
python3 app/smoke.py                       # production HTTP smoke (see app/README.md)
```
Run only what applies to your paths, but always the check that covers the files you changed.

## Smoke script
- Extend `app/smoke.py` (or a new script under `app/`) with one request per demo step:
  health, the main read, the main write, one error case. Exit non-zero on any failure;
  print one line per step. No secrets, no live paid calls (`LLM_FAKE=1`).

## Click-through checklist (human or agent report)
- [ ] Fresh start, empty data: landing renders, no console errors.
- [ ] Happy path from first click to result, at 375 px and 1280 px.
- [ ] Each state seen once: loading, empty, error, success.
- [ ] Fixture/simulated parts are labelled.
- [ ] Backend stopped: UI shows a readable error and recovers on restart.
- [ ] Network off: fallback path works (demo-polish).
Browser automation does not run in the managed sandbox; give a human the exact command.

## Before claiming done
1. Run the relevant checks; paste exact results (counts, exit codes), not "should pass".
2. List skipped checks and why (sandbox, missing tool, no network).
3. State what is verified, inferred or unknown. A fixture-backed path is not a real integration.
4. Re-run after rebasing onto `origin/main`; then hand off (handoff skill).

Related: demo-check, backend-api, web-dev, git-multiagent.
