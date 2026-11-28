# Realtime latency and patient delivery

Author: Codex, 2026-11-28.

Implemented; live microphone/audio behaviour remains unverified. No eval, commit, dependency addition or case edits. The other agent's interview, coach, learner and shared case-type changes were left untouched.

## Response sequencing

The voice prompt requests speech immediately and `reveal_fact` in the same response or after speaking. Tool acknowledgements remain immediate and deduplicated by call ID; fact callbacks and public client methods/callback signatures are unchanged.

Continuation is decided at `response.done` for that response, rather than with a session-wide tool flag. A completed tool-only response gets one continuation; observed audio, audio-transcript output or audio content in the final response suppresses continuation. Multiple tools are acknowledged before continuing. Duplicate done events cannot create duplicate answers. Cancelled, failed, incomplete, interrupted and previous-turn responses cannot restart speech. Final response output recovers tools when an arguments-done event was missed. This does not prove that a live model always combines a complete spoken answer and every disclosure tool correctly.

Session setup explicitly requests audio, `semantic_vad` with `eagerness: "high"`, automatic response creation and interruption. High eagerness reduces the VAD waiting allowance; test whether it cuts off students' thoughtful pauses. The six-turn memo now preserves the compact nonblocking instructions.

## Measurements

The existing latency chip receives one speech-stopped → first audio-event duration per turn through the unchanged `onLatency(number)` callback. Raw audio delta and WebRTC buffer-start are accepted; a transcript never substitutes for audio in the chip.

`/api/trace` additionally stores one metadata-only `kind: "turn"` observation, with:

- `speechToFirstAudioDeltaMs`: first GA/legacy output-audio delta, if received.
- `speechToFirstAudioBufferMs`: WebRTC `output_audio_buffer.started`, independently.
- `speechToFirstTranscriptDeltaMs`: first patient audio-transcript delta, independently.
- `speechToFirstToolCallMs`, `toolCallCount`, `toolAckMs`: first tool arrival and cumulative local acknowledgement processing time. `toolAckMs` is not provider/network round-trip time.
- Random `turnId` and interruption flag. Missing events remain absent, not zero.

The timing origin survives a tool-only continuation. Observations flush on buffer stop/clear, the next input or client close. Old-response events cannot contaminate a new turn. These observations remain visible in recent usage metadata but do not add calls, tokens or spend to usage totals. Provider-response completion and transcription usage traces remain separate.

WebRTC transports audio on a media track, so raw audio deltas may be absent; buffer-start is an event-based approximation, not measured sound at the headset. Transcript latency is available in traces, not a new UI chip. [OpenAI Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), [server events](https://developers.openai.com/api/reference/resources/realtime/server-events).

## Instruction sizes

JavaScript string character counts, original shared instructions → compact Realtime instructions. All authored facts (including truth, lay text, reveal conditions and red-flag metadata), patient/background, personality, never-say terms and unknown answer are retained. Counts exclude the tool schema and appended consistency memo.

| Case | Personality | Before | After | Reduction |
| --- | --- | ---: | ---: | ---: |
| Chest tightness | Downplaying | 14,821 | 13,326 | 10.1% |
| Chest tightness | Anxious | 14,862 | 13,334 | 10.3% |
| Multimorbid dizziness | Stoic | 19,584 | 17,741 | 9.4% |
| Multimorbid dizziness | Chatty | 19,620 | 17,806 | 9.2% |
| Abdominal pain | Reserved | 17,934 | 16,047 | 10.5% |
| Abdominal pain | Anxious | 17,945 | 16,055 | 10.5% |
| Thunderclap headache | Calm engineer | 17,634 | 15,911 | 9.8% |
| Thunderclap headache | Irritable | 17,516 | 15,770 | 10.0% |

Text instructions and the default tool definition were compared with HEAD and are identical for all eight pairs. Offline tests verify the compact prompt retains the complete structured data and disclosure/unknown-answer restrictions. These checks establish instruction preservation, not live factual accuracy or disclosure coverage.

## Delivery and voices

Voice instructions now request contractions, sparse self-correction, natural numbers, conversational full lists, brief empathy reactions and occasional related questions when personality permits. Reserved/downplaying restrictions still take priority. Pain pauses need an authored, relevant pain fact; a sharp breath associated with movement additionally needs an explicitly supported and permitted movement-pain fact. No invented movement or breathlessness.

| Personality | Expected contrast | Current voice → audition recommendation |
| --- | --- | --- |
| Downplaying | One complete plain answer, dry understatement, no reassurance request | cedar → cedar; keep a contained delivery |
| Chest anxious | Slightly uneven pace, occasional restart/check-in | ash → marin; audition expressive hesitation |
| Stoic | Slow, firm, protective of independence | sage → cedar; audition measured restraint |
| Chatty | Warm rhythm, answer first, at most one permitted nonmedical aside | coral → marin; audition warmth without alarm |
| Reserved | Soft, economical, complete answers even on intimate topics | cedar → cedar; keep soft restraint |
| Abdominal anxious | Small pauses, occasional restart; pain never embellished | ash → marin; audition hesitancy without theatrical distress |
| Calm engineer | Exact authored values, deliberate rhythm, full pain severity | echo → cedar; audition clear measured speech |
| Irritable | Clipped answer first, brief frustration, never withholding | verse → cedar; audition firm falling inflections |

These are audition hypotheses, not listening results or provider claims about each voice's character. OpenAI recommends marin/cedar for quality; personality instructions must supply the contrast. Cases/voices were not edited. [OpenAI voice guidance](https://developers.openai.com/api/docs/guides/realtime-conversations).

Authored comparison for the same permitted `episode_duration` question: Downplaying, “About five minutes each time.” Anxious, “About five minutes each time. Am I explaining that clearly?” Both state only the same duration. These illustrate the intended performance, not generated examples. Transcript and audio ratings: unmeasured.

Verified session field: `audio.output.speed` (0.25–1.5, default 1; postprocessing rather than model thinking speed). Personality-derived optional speed is 0.98 for downplaying/reserved/stoic/calm and 1.03 for anxious/chatty/irritable; unclassified personalities omit it. No shared personality schema change. Treat these small adjustments as headset-tuning candidates. [OpenAI client-secret reference](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create).

## Verification and handover

`npm run check` passed after the final code changes: strict typecheck, all 13 offline test files, production build. Targeted offline tests cover tools before/after audio/transcripts, multiple calls, duplicate events, final-output recovery, tool-only continuation, invalid IDs, failure/cancellation, interruption and stale events, independent timing, privacy, usage totals and session/memo settings. No live API or performance improvement was measured.

`npm run smoke` was attempted after the build and stopped because localhost listeners are blocked. Run it outside the sandbox. Live eval was intentionally not run, as requested; no before/after factuality or coverage claim is made.

Helmut: run `npm run dev` outside the sandbox and verify with a headset:

1. Ask a fact-bearing question, repeat it, then ask for several permitted facts. Hear exactly one complete answer each time and confirm all and only spoken fact IDs are recorded. Check an unknown question and a false premise.
2. Interrupt before speech and during speech, then resume. Confirm no restarted/doubled answer, silence or stale latency chip. Confirm high VAD eagerness allows natural student pauses.
3. Continue beyond six patient turns; confirm memo updates retain immediate speech and consistent facts.
4. Compare all personality pairs for contractions, hesitation, empathy, lists/numbers, question frequency and supported pain breaths. Rate transcript and audible delivery separately. Audition suggested voices in fresh sessions and compare personalities using the same voice too.
5. Collect speech-end → audio event and transcript timing with sample count, model, voice, device/network and interruptions. Compare perceived onset with the chip and separate trace fields; do not treat buffer/transcript events as acoustic measurements. Check `/usage` before and after the live session.

Files changed by this task: `components/realtime/client.ts`, new `components/realtime/response.ts`, `app/api/{session,memo,trace}/route.ts`, `lib/case/prompt.ts`, `lib/engine/trace.ts`, `lib/server/usage.ts`, new `tests/realtime-{prompt,sequencing}.test.ts`, `tests/usage.test.ts`, and this report.
