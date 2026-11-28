# Voice sprint plan (naturalness + latency)

Claude (orchestrator), 2026-11-28 04:00. Goal: a patient that sounds like a real person and answers as fast as a
person would (~0.5–0.8 s after the student stops), proven by numbers, not by one lucky demo.

## What the data says (Helmut's headset test, traces/llm.jsonl, kind "turn")
- Model is already fast: speech_stopped → first audio buffer 245–458 ms; the reveal_fact tool now arrives
  after the audio (~1.9 s), so audio-first works.
- The felt delay is mostly *before* speech_stopped: the VAD waiting to decide the student has finished.
  That wait is not measured yet.
- Maya (24, female) used male voices cedar/ash → fixed (marin anxious, shimmer reserved), commit 9e32b2e.
- Over-stacked delivery rules (audible breathing, stumbles, "tense, thin, high") risk theatrical speech.

## Phase 1 – measure what the student feels (agent, parallel)
1. **True perceived latency in the client**: mic energy analyser (last voiced frame) → remote track
   energy analyser (first audible frame). Show it in the latency chip; trace p50/p95 per session.
   *Check:* chip shows "felt" ms; trace has `micSilenceToAudibleMs`.
2. **`scripts/voice-bench.ts`** (Node WebSocket to Realtime, server-side key): fixed question set per
   case × personality, sent as text turns; measures request → first audio delta, saves WAV + transcript,
   runs each patient transcript through the guard (voice consistency evidence), writes
   `eval/voice/<ts>/report.md` and a blind audition page (`index.html`, labels A/B/C).
   Variables: model (gpt-realtime vs gpt-realtime-mini if the key allows), voice, prompt version.
   *Check:* one command produces latency table + audio files + guard counts.

## Phase 2 – make it sound human (agent)
3. **Voice prompt v2** following OpenAI's Realtime prompting structure (Role, Personality & Tone, Pacing,
   Variety, Sample phrases, Rules), short bullets, one emotional dial per personality, no stacked
   disfluencies; anxious = worried content and a slightly faster pace, not breathing noises.
   Compact facts for voice: lay + reveal_when + red-flag marker (truth only where lay is ambiguous).
4. **Voices matched to age/sex and personality**, chosen by blind audition (Helmut, 5 min):
   marin/cedar first, then shimmer/coral/sage/ash/verse/echo; speed per personality 0.95–1.08.
5. **Turn-taking**: compare semantic_vad high vs server_vad (silence 350/450 ms, prefix 200 ms) on
   felt latency and false cut-offs; pick per default, expose a "patient waits longer" toggle.
6. **Pre-warm**: create the session + WebRTC when a case is selected, so "Start" is instant.

## Phase 3 – decide and lock (orchestrator + Helmut)
7. Run bench: {gpt-realtime, mini} × {prompt v1, v2}; accept only if guard invented/contradictions = 0
   and felt latency improves; Helmut picks voices blind. Text eval re-run for any shared prompt change.
8. Commit winners; Helmut final headset run of the demo path; numbers into pitch and /eval.

## Scheduling (quota)
Codex 5 h window resets 05:40 and Claude's week resets 11:00: Phase 1 (1+2) runs as two parallel Codex
tasks after 05:40; Phase 2 after the bench exists; Helmut listens once per phase. Feature freeze 18:00.
