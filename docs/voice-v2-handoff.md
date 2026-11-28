# Voice v2 implementation and handoff

Author: Codex, 2026-11-28.

Implements voice-plan Phase 1 item 1 and Phase 2 items 3, 5 and 6. No case edits, shared case contract changes, dependencies, commits, pushes or paid calls. The text patient prompt and default tool definition are unchanged. This supersedes the measurement/delivery description in `realtime-latency-report.md`.

## Units and files

| Unit | Files |
| --- | --- |
| Felt timing | `components/realtime/energy.ts`, `components/realtime/client.ts`, `components/Interview.tsx`, `lib/engine/trace.ts`, `app/api/trace/route.ts`, `tests/realtime-sequencing.test.ts`, `tests/realtime-trace.test.ts`, `tests/usage.test.ts` |
| Realtime prompt v2 | `lib/case/prompt.ts`, `tests/realtime-prompt.test.ts` |
| Configurable VAD | `lib/server/env.ts`, `app/api/session/route.ts`, `.env.example`, `tests/realtime-prompt.test.ts` |
| Pre-warm | `components/realtime/prepare.ts`, `components/realtime/client.ts`, `components/Interview.tsx`, `tests/realtime-prepare.test.ts` |
| Documentation | `README.md`, this handoff |

## Measurement

The “Voice felt” chip uses the existing `onLatency(number)` path only for measured track energy, never a transcript/buffer-event fallback. Mic RMS ≥0.015 updates the last voiced frame; 120 ms of silence confirms that boundary without adding hangover to the duration. Remote RMS ≥0.008 for 25 ms confirms onset, using the first frame in that sustained run. Analysis uses 1024-sample windows with animation-frame polling, before visual gain/smoothing. Playback must be unpaused and Web Audio running. Fixed thresholds, room noise, echo, quiet speech and foreground scheduling need headset validation; this is browser-track timing, not sound measured at the ear.

Every turn retains independent provider event metrics. Felt turns add `micSilenceToAudibleMs`, `sessionId`, cumulative nearest-rank `micSilenceToAudibleP50Ms`/`micSilenceToAudibleP95Ms` and `feltSampleCount`. Summaries describe measured turns, including a turn interrupted after audible onset; missing onsets are omitted. Records flush at buffer stop/clear, new input or close. Turn `latencyMs` spans from the earlier of measured mic silence and provider speech-end to flush, allowing felt wait to include VAD. Usage totals still exclude turn observations. No audio, prompts or transcripts enter traces.

## Prompt and delivery

The Realtime-only prompt uses Role & Objective, Personality & Tone, Pacing, Variety, Sample phrases and Rules. One label-derived emotional dial overrides source physical performance cues. Anxiety is concerned wording, a slightly faster pace and occasional reassurance/clarity questions; acted breathing, sighing, coughing and stacked disfluencies are prohibited. Every authored fact (truth, lay wording, reveal condition, red flag), patient/background, personality, unknown answer and never-say list remains verbatim in reference data. Full truth is retained to avoid guessing which lay statements are ambiguous. Samples are tone guides, never additional facts or canned responses.

Authored examples for the same permitted `episode_duration` question in `chest-tightness-01`:

| Dimension | Downplaying | Anxious |
| --- | --- | --- |
| Complete answer | “About five minutes each time.” | “About five minutes each time. Does that sound worrying?” |
| Emotional dial | Restraint | Concern |
| Pace | Even, economical | Slightly faster, clear |
| Repetition | Same duration | Same duration; vary optional clarity question |
| Empathy | Brief acknowledgement | Warmer acknowledgement, no symptom change |
| Interruption | Stop, answer resumed question | Stop, answer resumed question |

These are authored examples supported by the case, not measured model output. Transcript factuality, disclosure, naturalness, personality recognition and audio delivery are unmeasured. The existing audio-first `reveal_fact` sequencing and six-turn memo path remain intact.

Structure and VAD fields were checked against [OpenAI voice prompting](https://developers.openai.com/api/docs/guides/voice-prompting) and [OpenAI VAD guidance](https://developers.openai.com/api/docs/guides/realtime-vad). Presets: `semantic_high` (default), `semantic_medium`, `server_400` (400 ms silence, 200 ms prefix, threshold 0.5); all enable response creation and interruption.

## Pre-warm lifecycle

Selection prefetches a credential; only a selection/Start gesture requests the microphone and prepares peer/data channel/local offer. Source tracks stay disabled until Start. No SDP or microphone audio is sent to OpenAI before Start. Start consumes prepared resources and exchanges SDP; it is faster in principle, not proven instant. Resources close on changed selection/text/unmount or after 60 idle seconds. Near-expiry credentials refresh with a 30-second safety margin, including permission dialogs that outlast a credential. Cancellation stops late-arriving microphone tracks; denied permission can retry on another gesture. Prefetch errors surface at Start with text fallback.

## Verification and remaining gate

Offline checks cover structured prompt/fact preservation, preset request bodies, tool/audio sequencing, felt-vs-event timing, noise/hangover, interruption, privacy/usage accounting, prefetch deduplication, credential refresh, idle cleanup, permission denial and cancellation. `npm run check` passed: strict typecheck, all 21 offline test files and production build. Build emitted two existing dynamic-filesystem tracing warnings in `lib/server/leaderboard.ts`, outside this task. `npm run smoke` was attempted and blocked by sandbox localhost-listener restrictions; run `npm run check && npm run smoke` outside the sandbox. No browser was launched. No live improvement, guard result or before/after eval number is claimed.

Coordinator runs the paid gate and compares against baseline before adopting the prompt:

```sh
npm run voice-bench -- --case all --personality all --models gpt-realtime --prompt compact --questions 6
```

The bench sends text and cannot validate microphone/VAD or audible headset latency. Preserve all attempts, compare coverage and guard issues, and reject added inventions/contradictions or lower coverage. Text instructions were not changed; any required paired `npm run eval -- --n 3` remains with the coordinator and budget review.

Helmut, run `npm run dev` outside the sandbox and use a headset:

1. Select case/personality, allow the mic, then Start. Confirm no patient audio/transmission before Start, quicker start, correct selected patient, and working text fallback on denial. Switch rapidly; wait >60 seconds; retry after credential expiry. Check no lingering mic after leaving/text/end.
2. Ask six fact-bearing questions. Compare the felt chip to the heard gap; confirm traces contain felt values, sample count/session p50/p95 and the separate event timings. Try quiet speech and ordinary room noise; do not use hidden-tab numbers as evidence.
3. Compare identical questions in both personalities. Anxiety should sound worried and conversational, without acted breaths/stumbles. Repeat a fact, ask an unknown question and a false premise; verify all and only spoken facts are recorded.
4. Interrupt before/during speech, pause thoughtfully mid-question, and continue beyond six patient replies. Confirm no duplicate/restarted speech, stale timing or loss of facts/memo instructions.
5. Compare fresh sessions with all three VAD presets. Record felt p50/p95, sample count and false cut-offs, plus model/voice/device/network. Check `/usage` before/after.
