# Checkpoint and plan — 2026-11-28 03:00 Berlin

Claude (orchestrator), 2026-11-28. Resume from here. Deadlines: feature freeze **Sat 28-11 18:00**, submission
candidate Sun 08:00, submission **Sun 29-11 10:00**. Branch `feat/Helmut`; Helmut merges to `main`.

## What the jury scores (all must be visibly met)
hackaTUM general criteria (organisers, pasted by Helmut 2026-11-28):
1. **Innovation / ambition** — unique take, what makes it special, ambitious and creative, fits the theme.
2. **UI / UX** — easy, professional/fun not sloppy, intuitive workflow.
3. **Overall quality** — works start to finish, no bugs in the presentation, the critical feature works,
   good scoping for the time frame.
4. **Presentation** — prepared presenters, clear idea, good overall pitch.

Avelios VIP criteria: naturalness and latency; medical consistency (0 invented facts / contradictions);
personality (blind judge ≥ 80 %); reveal only what is asked; evidence beyond one lucky run.

How we answer each (the pitch must say these out loud):
| Criterion | Our answer | Proof on stage |
| --- | --- | --- |
| Innovation | Not a chatbot: an adaptive tutor. Patients by voice + learner model that picks the next patient, spaced red-flag reviews, "create a patient for my weak spots" | `/learning` page, generated case |
| Ambition | Real-time voice, structured case in → structured anamnesis out (Avelios' world), eval harness for text and voice | `/eval`, voice bench report |
| UI / UX | One clear flow: pick patient → talk → reflect → feedback → next patient | Live run, no dead ends |
| Quality | `npm run check` (70+ tests), CI, retries, no mock mode | Demo with zero errors; backup video |
| Presentation | 3-minute script, rehearsed twice, timed | `docs/event/pitch-template.md` |
| Naturalness / latency | gpt-realtime, audio-first turns; ~0.4 s model first audio | voice bench table |
| Consistency | Atomic cases, guard on every turn (text and voice) | eval table, 0 invented |
| Personality | Same facts, two people | Maya / Daniel side by side |
| Selective disclosure | `reveal_when` per fact; instructor view shows it | toggle on stage |
| Not a lucky run | n ≥ 5 per case × personality, Wilson CIs | `/eval` |

## State (verified)
- Commits on `feat/Helmut`: …, `2e29d65` learning loop, `feddf0a` audio-first voice, `9e32b2e` Maya female
  voices, `5f03366` voice plan, voice bench. `npm run check` green (70 tests + bench tests).
- Text patient stays **gpt-5-mini**: paired partial eval, gpt-4.1-mini had 8 invented / 5 contradictions /
  5 unprompted vs 0 / 1 / 0 (p50 1.1 s vs 3.6 s).
- Voice: Helmut's headset traces show speech_stopped → first audio **245–458 ms**; felt delay is the VAD
  end-of-turn wait (not yet measured). Voice bench (Maya anxious, 6 questions): gpt-realtime first audio
  p50 ≈ 400 ms, 0 guard issues for marin/shimmer/coral/sage; gpt-realtime-mini not faster (480–570 ms) and
  1 contradiction in 3 of 4 runs → **keep gpt-realtime**. Bench cost ≈ $0.28. Usage total ≈ $2.50.
- Learning loop live: hidden checklist (Instructor view), reflection before feedback, Calgary-Cambridge
  communication ratings, local learner profile, spaced red-flag reviews, recommendation, `/learning`.
- Skills in `.claude/skills/`: clinical-case-design, patient-performance, patient-evaluation (+ updated
  llm-integration, testing-qa).

## Running / waiting at checkpoint
- New-case text eval DONE (n=3, 12 turns, 24 interviews, 0 failures, `eval/summary.md`): invented 1,
  contradictions 2, unprompted 7 (all multimorbid-dizziness: stoic 1→3, 2→1; chatty 2→3), jargon 0, role 0,
  persona 19/24 = 79 % (misses: chest downplaying ×2, headache calm-engineer ×2, chatty ×1), text p50 3.2 s
  / p95 6.7 s. **Gate not met.** Next: inspect `eval/results/<latest>.json` guard details; tighten
  multimorbid `reveal_when` (likely bundled medication/fall answers) and sharpen downplaying vs anxious and
  calm-engineer vs irritable (patient-performance skill); rerun paired n=3.
- Evidence-grounded cases: Codex researched sources but its drafts were NOT saved (sandbox write denied);
  report + brief in `docs/research/case-grounding.md`. Rerun writing to `docs/research/cases-v3/`, then
  paired eval before replacing `cases/`. Keep Maya's female voices (commit 9e32b2e).
- Helmut: blind audition `eval/voice/2026-11-28T01-54-41.965Z-36c498f1/index.html` → pick Maya's voice.
- Decision for Helmut: product name (shortlist: Anamnesia, VIPatient, SayAah).

## Plan (priority order; each item = one delegable task with an acceptance check)
1. **Consistency gate on new cases** — read the n=3 eval; fix any invented/contradiction/unprompted by case
   edits only. *Check:* 0 / 0 / 0, persona ≥ 80 %.
2. **Grounded cases v3** — review Codex SOURCES.md, paired eval vs current, adopt only if not worse.
3. **Voice sprint** (`docs/voice-plan.md`): felt-latency meter in client; voice prompt v2 (one emotional
   dial, no stacked disfluencies); voices by age/sex via blind audition; semantic vs server VAD; pre-warm
   session on case select. *Check:* felt latency p50 < 1.0 s, bench 0 issues, Helmut approves by ear.
4. **UX polish for the jury** (ui-design skill): one guided flow, landing explains the value in 5 s,
   loading states for coach (≈10 s → streaming or progress), empty/error states, mobile check, name/logo.
   *Check:* click-through with no dead ends; screenshot review.
5. **Evidence**: final eval n ≥ 5 per cell + voice bench all cases before 18:00; `/eval` shows Wilson CIs
   and requested-fact retrieval. *Check:* every pitch number links to an artifact.
6. **Pitch + demo script rewrite** around: problem → talk to Maya → same facts, other personality →
   reflection + feedback → `/learning` adapts → evidence → close. Rehearse twice, ≤ 3:00.
7. **Backup video** of the full flow; **Devpost** from `docs/event/devpost-template.md`; submit by 08:00.
After 18:00: only fixes, evidence and presentation.

## Quota rhythm
Codex 5 h window resets 05:40 (was 89–94 %, effectively out until then); Claude week resets Sat 11:00. Parallel max 2 agents.
