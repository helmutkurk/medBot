# Interview modes and feedback handoff

Author: Codex, 2026-11-28. Branch: `feat/Helmut`. No commit or push performed.

Implemented Practice (untimed, hints), OSCE (60-second reading followed by an 8-minute interview), and a
3-minute red-flag sprint. Timed expiry closes voice, cancels outstanding interview requests, ignores late
patient responses and opens reflection. Changing patient or restarting resets timing, hints and reports.
OSCE reading can be cancelled but cannot be skipped. Voice-to-text recovery keeps the station deadline.

Hints use the existing real OpenAI adapter with metadata-only traces. `/api/hint` rejects other modes,
case IDs, fact objects and unknown fields: its model input contains only transcript messages and already
covered category names. Successful hints are counted, exported and cost 5 XP each, with an XP floor.
Coach opportunities require exact quotes from an adjacent patient cue and student response at the claimed
zero-based transcript index. Unsupported quotes are dropped. Replay shows disclosure events, red flags,
guard flags, Calgary-Cambridge phases supported by communication evidence, and validated missed cues.
Disclosure chips mark the transcript position where the disclosure event was received; a tool event alone
is not independent proof of every spoken proposition. Guard events remain fallible observations.

After reflection, numeric coverage feedback precedes a generated viva question. The question generator
has no case answer key. Grading receives authored case facts only after a nonempty answer. Detailed coach,
anamnesis and answer-key exports unlock after grading, to avoid feeding the answer into the viva. The
learner profile stores only the viva score, mode, hint count and elapsed time alongside existing summaries;
no viva answer or transcript is added to browser persistence. Viva earns up to 20 XP. Sprint scoring is
red flags found / total; finding every flag before expiry earns up to 20 extra XP. Brief feedback gives one
next action; Detailed adds the full reports and replay. Session-record JSON downloads entirely in the
browser, with coverage and numeric scores available even while answer-key report text is locked.

## Exact files changed by unit

Files shared across units are listed in each applicable row. This list describes this assignment only;
other dirty files belong to the parallel hosting work and must be reviewed by that coordinator.

| Unit | Files |
| --- | --- |
| Modes, timers and reading stem | `lib/engine/interview-mode.ts`, `components/Interview.tsx`, `components/Interview.module.css`, `lib/engine/learner.ts` |
| Practice hints and XP discount | `app/api/hint/route.ts`, `lib/engine/hint.ts`, `components/Interview.tsx`, `lib/engine/learner.ts`, `lib/engine/gamification.ts`, `components/learner-storage.ts`, `components/Rewards.tsx` |
| Missed-cue coaching | `lib/engine/coach.ts`, `components/CoachPanel.tsx`, `tests/coach.test.ts`, `tests/eval.test.ts` (updated offline coach response shape) |
| Annotated replay and feedback depth | `lib/engine/replay.ts`, `components/AnnotatedReplay.tsx`, `components/Interview.tsx`, `components/Interview.module.css` |
| Viva and profile/XP integration | `app/api/viva/route.ts`, `lib/engine/viva.ts`, `components/VivaPanel.tsx`, `components/Interview.tsx`, `lib/engine/learner.ts`, `lib/engine/gamification.ts`, `components/learner-storage.ts`, `components/Rewards.tsx` |
| Session-record download | `lib/engine/session-record.ts`, `components/Interview.tsx` |
| Shared trace registration | `lib/engine/trace.ts`: only added `hint` and `viva` to `OPERATIONS`; this file also contains the hosting agent's independent storage changes, which were preserved |
| Offline tests and external visual QA | `tests/interview-features.test.ts`, `scripts/capture-interview-modes.sh`, `docs/interview-modes-handoff.md` |

`lib/case/types.ts` is unchanged. No edits to `components/realtime/*`, `lib/case/prompt.ts`, `cases/`,
hosting-owned HTTP/environment/access/privacy/feedback files, dependencies or lockfiles.

## Verification actually run

- `npm run check`: passed (strict typecheck, all offline test files and production build).
- `node --import ./tests/trace-setup.ts tests/interview-features.test.ts`: 7/7 tests passed. Covers mode
  deadlines, hint request privacy and errors, viva generation/grading separation, score validation,
  idempotent profile updates and XP, replay chips, and locked/unlocked JSON record contents.
- The added coach test verifies adjacent roles/turns, invented quotes, blank quotes and invalid indices.
- `git diff --check`: passed.
- `bash -n scripts/capture-interview-modes.sh`: passed. The browser script was not executed.
- `npm run smoke`: blocked before server startup because the sandbox disallows localhost listeners.
- Build succeeded with dynamic-filesystem tracing warnings from the parallel hosting storage/leaderboard
  code. Those paths were left to its owner.

Paired required `npm run eval -- --n 3` attempts:

| Version | Artifact | Completed / attempted | Network failures | Coverage / invention comparison |
| --- | --- | ---: | ---: | --- |
| Before coach prompt edit | `eval/results/2026-11-28T08-11-28.110Z.json` | 0 / 54 | 54 | unavailable |
| After coach prompt edit | `eval/results/2026-11-28T08-18-49.884Z.json` | 0 / 54 | 54 | unavailable |

Both commands exited 1. The empty aggregate's zero fields are not measured quality results. No claim of
preserved coverage or zero inventions can be made; the live prompt comparison remains an acceptance task
for a network-enabled environment before merge. Both runs used the harness defaults (12 turns,
`gpt-5-mini` patient and text models); no successful model request reached the changed coach prompt.
Metadata usage around the candidate attempt: estimated eval spend remained $3.0805437; trace calls went
from 3418 to 3526 due to failed/retried requests. This is an estimate, not a billing or cap guarantee.

## Outside-sandbox checks

Run `npm run check && npm run smoke` where localhost listeners are allowed. For visual checks, run
`npm start` in one terminal and `bash scripts/capture-interview-modes.sh` in another (an installed Chromium
is required; override `MEDBOT_BROWSER_BIN` if needed). The script writes picker screenshots at 375 and
1280 pixels to `docs/review/interview-modes/`; no screenshots are claimed yet.

With real OpenAI access, complete this walkthrough at both widths and with keyboard navigation:

1. Practice: start text, ask a question, request a hint, end and reflect. Verify one hint costs 5 XP and
   appears in the session JSON. Confirm hint errors are readable and do not charge for an unseen hint.
2. OSCE: start text, verify the stem and disabled composer for the full 60 seconds, then the 8:00 timer.
   Confirm no Hint button or instructor answer key; expiry opens reflection and late replies cannot append.
   Repeat by voice and recover to text; the timer must continue rather than restart.
3. Sprint: confirm 3:00, no hints, found/total scoring and a time bonus only when all red flags were found.
   Verify expiry and early manual completion. Compare exported timing and score with the UI.
4. Feedback: answer the viva without opening the answer key; confirm grade, increased XP and a single
   updated learner session after reload. Switch Brief/Detailed and inspect quote-supported opportunities,
   replay chips, documentation and record download. A fresh patient must discard previous viva/hints.
5. Force an unavailable provider and verify visible retry/error states for coach, hints and viva. Confirm
   the record remains downloadable with partial coverage, report statuses and numeric scores.

Re-run `npm run eval -- --n 3` with network access for a valid paired before/after comparison of the coach
prompt. New hint/viva live responses and voice/browser behaviour remain unverified by offline fetch stubs.
