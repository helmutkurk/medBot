# Realtime voice benchmark

Author: Codex, 2026-11-28.

Run with Node 26 from the repository root. The npm command loads `.env.local` if it exists, just like the text eval; the script only reads environment variables. No dependencies or browser process are needed. Runs spend OpenAI budget: review `/usage?source=eval` before and after.

Compare models across all current cases and personalities, with each personality's authored voice:

```sh
npm run voice-bench -- --case all --personality all --models gpt-realtime,gpt-realtime-mini --prompt compact --questions 8 --out eval/voice
```

Audition four voices for Anxious Maya:

```sh
npm run voice-bench -- --case abdominal-pain-01 --personality anxious --models gpt-realtime --voices marin,shimmer,coral,sage --prompt compact --questions 8 --out eval/voice
```

Defaults: all cases, all personalities, `gpt-realtime`, case voice, `compact`, six questions, `eval/voice`. `--questions` accepts 1–8 and takes that prefix of the fixed suite: opening, onset, character, red flag, full medication list, contradicted premise, absent information, repeated onset question. Eight includes the two final probes. Questions retain the case facts' `reveal_when` provenance. Provenance lists are not a scored permission table or fact coverage claim. The false-premise and absent-information probes are authored for the four built-in cases; additional cases require explicit probe mapping before paid calls.

`--prompt v1` uses `buildPatientInstructions` and the original before-speaking tool description. `compact` uses `buildRealtimeInstructions` and the app's audio-first tool description. Both use `buildRealtimeSpeed`, the same transcription setting, `reveal_fact`, and audio-only output. The benchmark sets `turn_detection: null` and explicitly requests mono little-endian PCM16 at 24 kHz. Each case/personality/model/voice cell starts a fresh conversation. Turns retain history; there is no memo refresh, seed, temperature override, reconnect or response retry. A tool-only completed response receives a follow-up; a completed response with audio receives no extra response. Tool acknowledgements are deduplicated, and invalid fact IDs get `{ok:false}`.

Authentication uses `POST /v1/realtime/client_secrets` with the session configuration and 600-second expiry, followed by Node's native two-argument `WebSocket(url, ["realtime", "openai-insecure-api-key.<ephemeral>"])`. This follows the documented browser-compatible path without relying on a nonstandard `headers` constructor option. Only the ephemeral secret enters the subprotocol; the long-lived key is sent as an HTTPS Authorization header when minting it. Neither credential is persisted. See [Node WebSocket](https://nodejs.org/api/globals.html#class-websocket), [OpenAI WebSockets](https://developers.openai.com/api/docs/guides/realtime-websocket), and [client secrets](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create).

Each timestamped directory contains:

- `report.md`: per-cell first-audio p50/p95, completion p50, completed/planned turns, five guard issue counts, guarded/missing observation counts (including audio turns without a transcript), estimated spend and failures.
- `results.json`: settings, commit/dirty identity, script/case/instruction hashes, fixed questions, per-turn transcripts, timings, fact IDs, guard results/failures, and metadata-only traces for the run. Traces are also written through `recordTrace` to the normal ledger. Cost includes credential, realtime and text guard calls, including failed attempts. The existing price table has no `gpt-realtime-mini` rate: those records explicitly flag unknown pricing and undercount its cost. Missing response usage is flagged too.
- Opaque UUID-named WAV files, including partial recordings after failures.
- `index.html`: open locally for shuffled A/B/C… players per question, temporary listening notes, and a button to reveal model/voice/personality/prompt. No external resources. Labels are independent across questions. This is practical blinding, not encryption: do not inspect source or raw results before rating.

Audio conversations time out after 240 seconds, including credential creation and handshake. Guard calls run afterward, each bounded to 30 seconds; their latency does not enter voice measurements. Failed conversations do not prevent later cells from running. Reports checkpoint after every cell. Exit status is nonzero for conversation/guard execution failures, but guard issue counts require inspection and do not constitute an automatic merge gate.

Latency starts immediately before sending the text question, stops at the first nonempty audio delta and at the final `response.done` after any tool-only responses. Nearest-rank percentiles include completed turns only; failed and partial observations remain in JSON. This measures request-to-audio-event latency, not speech/VAD timing, network playback buffering or audible headset onset. One conversation per cell and correlated turns cannot establish a model winner or general clinical accuracy. The guard is an automated, fallible detector; this command does not run calibration controls or human ratings. Inspect the transcript and listen before making stronger claims.

Offline verification:

```sh
node --import ./tests/trace-setup.ts tests/voice-bench.test.ts
npm run check
```

Transport/clock injection exists for offline tests only; the CLI always connects to OpenAI. No live model, voice access or listening quality is established by those tests.
