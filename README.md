# medBot

A voice patient for medical students to interview, built for hackaTUM 2026 and the Avelios challenge “VIP – Virtual Interview Patient”. Synthetic cases, distinct personalities, selective disclosure, and a background consistency guard. All patient interactions, reports and case generation run against OpenAI.

## Quick start

Use Node 26 (Node >=24 supported; native TypeScript stripping is required).

```sh
cp .env.example .env.local
# Required: add OPENAI_API_KEY to .env.local before starting.
npm install
npm run dev
```

Open http://localhost:3000. Select a case and personality, start the interview, and allow the microphone. You can always type a question. Without a key, the app shows setup instructions. If microphone access fails, OpenAI text remains available. Voice needs HTTPS or localhost and a browser supporting WebRTC.

The only required setting is `OPENAI_API_KEY`. `/api/health` returns `{ ready, models }`; without a key, interview endpoints return HTTP 503 with code `no_api_key`. OpenAI timeouts return 504 and upstream failures return 502, with no generated substitute content. Optional model settings are documented in `.env.example`; an empty text model uses the engine default. Keep real environment files local.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | Strict TypeScript validation |
| `npm test` | Offline engine tests using native Node TypeScript |
| `npm run eval` | Text interview evaluation; reads `.env.local` if present |
| `npm run check` | Typecheck, tests, and production build |
| `npm run smoke` | After a build, start a server without a key; check setup, health, cases, `/eval` and chat 503; stop and clean up |

## Architecture

```text
Browser ── WebRTC audio + oai-events ── OpenAI Realtime
   │         (ephemeral key only)
   │
   ├─ /api/session ── OpenAI client secret minting
   ├─ /api/chat ───── patient engine ── OpenAI text
   ├─ /api/guard ──── consistency guard ── OpenAI text
   ├─ /api/coach ──── end-of-interview coach report ── OpenAI text
   ├─ /api/anamnesis ─ structured documentation + FHIR-like export
   ├─ /api/cases/generate ─ validated synthetic case creation
   ├─ /eval ──────── latest evaluation evidence
   ├─ /api/memo ───── session instructions + consistency memo (mid-call)
   └─ /api/health, /api/cases
             Next.js API routes
                    │
                lib/engine
                    │
                cases/*.json + cases/generated/*.json
```

The server loads and validates cases. The browser gets case summaries and a teaching checklist, not the full patient prompt. Voice and text use the same engine-generated instructions. `reveal_fact` tool calls update coverage; the background guard reports potential issues without blocking speech. Changing case or personality starts a fresh interview. The app stores no conversations; requests sent to OpenAI are subject to your provider settings.

The “Voice felt” chip measures the last voiced microphone frame → first sustained remote-track audio using Web Audio energy analysis. It includes VAD wait and keeps provider speech-end → audio/transcript/tool event metrics separately in metadata-only traces. Each measured turn includes `micSilenceToAudibleMs`, a random session ID and cumulative session p50/p95 with sample count. This estimates browser playback onset, excluding headset hardware delay; use a headset and a foreground tab. Missing energy/playback measurements stay absent. Text latency remains the complete browser request round trip.

`OPENAI_TURN_DETECTION` selects `semantic_high` (default), `semantic_medium` (patient waits longer), or `server_400` (400 ms silence, 200 ms prefix padding, threshold 0.5). Invalid/empty values use `semantic_high`. Restart the server and start a fresh interview after changing it. Compare felt latency and unwanted cut-offs by headset before choosing a different default.

Selecting a patient/personality prefetches an ephemeral credential. A selection click also requests microphone permission and prepares the local WebRTC offer; automatic/recommended initial selection and asynchronous case generation do not request microphone permission. Start reuses that preparation, enables the mic and exchanges SDP with OpenAI. Credentials within 30 seconds of expiry are refreshed; unused local mic/peer resources close after 60 seconds. Changing selection, switching to text or leaving closes unused resources. Start still needs a network SDP exchange, so instant connection is a goal rather than a measured guarantee.

## Coach, anamnesis and transcript export

- `POST /api/coach` with `{ caseId, history, revealed }` returns a `CoachReport` (score, coverage per category, covered facts with the student's quote, missed facts with suggested questions, strengths, improvements). After **End interview** the summary shows it.
- `POST /api/anamnesis` with `{ caseId, history, revealed }` returns an `AnamnesisReport`. After **End interview**, the Anamnesis panel sits beside the coach: documentation completeness, missed red flags, documented and missing items by section, and a drafted clinical note. Membership and completeness come deterministically from disclosed fact ids; OpenAI drafts the documentation wording. **Export (FHIR-like JSON)** downloads a Composition-shaped educational export, not a validated FHIR resource.
- Long voice conversations: after every 6th patient turn the browser asks `POST /api/memo` (`{ caseId, personalityId, revealed }`) and sends the returned text as a Realtime `session.update` (`{ session: { type: "realtime", instructions } }`) over the data channel. The ephemeral key is never used for this; instructions come from the server. This `session.update` shape follows the GA session object used for client secrets and has not been exercised against a live session.
- **Download transcript** (below the composer and in the summary) saves a JSON file with case, personality, messages, revealed fact ids, latencies, guard warnings, the coach report and the anamnesis, for demos and the pitch. Wait until both reports finish to include them; unavailable reports are exported as `null`, with the anamnesis status recorded.
- If the microphone is denied or the connection drops, the interview continues in text mode and the transcript is kept.

## Create a patient

Choose **New patient** in the case grid. Enter a diagnosis (3–200 characters), optionally age (0–120), sex, setting and personality hints. Generation validates a complete synthetic case with contrasting personalities, saves it locally and selects it for immediate interviewing. An OpenAI API key is required.

`POST /api/cases/generate` accepts `{ diagnosis, setting?, age?, sex?, personalityHints? }` and returns HTTP 201 with `{ case, mode }`. The case contains the picker summary, red-flag count and teaching checklist. Generated JSON files live in `cases/generated/` (gitignored); they are loaded alongside the built-in cases. This requires a writable persistent filesystem for persistence across restarts. Use fictional details only.

## Evaluation evidence

Open **Eval** in the header or visit `/eval`. This server-rendered page reads the newest JSON file in `eval/results/`, showing run mode, timestamp, interview count, aggregate metrics and a case × personality table. It includes fact coverage, invented facts, contradictions, unprompted disclosures, jargon, patient text latency p50/p95, personality label accuracy, coach score and anamnesis completeness when recorded. Missing measurements appear as **—**. Only OpenAI evaluation reports are shown.

```sh
npm run eval -- --n 3
```

Reload `/eval` after a run. Harness patient latency covers the engine text request through the complete reply; browser text round-trip and voice onset measurements remain visible in the interview. Evaluation results stay local and are gitignored.

## Usage tracking

Open **Usage** in the header or `/usage` for calls, input/output tokens, estimated USD spend, operation/model breakdowns and the last 50 calls. `/api/usage` serves the same data; both support `?source=app|eval`. Reload to refresh. Metadata-only records append to gitignored `traces/llm.jsonl` (override the directory with `MEDBOT_TRACE_DIR`); no prompts, response text, keys or patient details are stored. Responses API attempts, including retries and failures, are logged separately. Realtime response and transcription usage are sent from the browser with text/audio and cache breakdowns. Session credential requests are counted with zero tokens. Costs use standard rates in `lib/engine/pricing.ts`, checked against [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and model pages on 2026-11-28; they are estimates, not an enforced cap. Unknown models are flagged with $0 cost. Calls without usage, lost browser reports and unreported transcription usage may undercount spend; compare with the provider billing dashboard. Files require a persistent writable server filesystem.

## Demo script

See [the winning plan](docs/winning-plan.md#demo-script-3-minutes) for the three-minute demo: contrasting personalities, coach and structured anamnesis, `/eval`, then the case creator. Set `OPENAI_API_KEY`, then start with `npm run dev`. Rehearse live voice with a headset and keep a backup recording.

## Realtime GA verification

Checked against the official OpenAI docs on 2026-11-28:

- [Client secrets](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create): `POST /v1/realtime/client_secrets`, 600-second expiry, nested `session.audio` transcription, semantic VAD and voice, function tools, and top-level `value` / `expires_at` response fields.
- [WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc): ephemeral bearer authentication, SDP posted to `/v1/realtime/calls` with `application/sdp`, and the `oai-events` data channel. No beta header.
- [Conversations](https://developers.openai.com/api/docs/guides/realtime-conversations) and [server events](https://developers.openai.com/api/reference/resources/realtime/server-events): input transcription, `response.output_audio_transcript.done`, tool output followed by `response.create`, and output-audio start events. The client also accepts the older `response.audio_transcript.done` name.

The configured default remains `gpt-realtime`; model names can be overridden. Live API access and microphone playback need a manual smoke test with a funded key.

## Add a case

Add `cases/<id>.json` following `lib/case/types.ts` and the existing synthetic example. Give each fact a unique ID, category, clinical truth, lay wording and disclosure trigger. Include patient background, unknown-answer wording, never-say terms and at least one personality with a supported voice. The engine validates files and sorts cases by title; restart or reload to see additions. Run `npm run check` and the evaluation harness before demoing new cases.

## What the judges look at (from the Avelios deck)

- Naturalness: fast responses, stays in character.
- Medical consistency: no invented or contradictory facts.
- Personality: two patients with the same disease feel different.
- A working demo: someone talking to the patient, live or recorded.
- “Show your patient behaves correctly, beyond one lucky demo run.”

Must have: believable background story, English speech in and out, distinct personality with emotion in the voice, flowing conversation that reveals facts only when asked, working demo. Not needed: login, business plan.

## Team next steps

- Add challenge-specific cases and compare personalities using the evaluation harness.
- Smoke-test voice, interruption, tool disclosure and guard behavior with the team's key.
- Rehearse a short interview and record a backup demo.

## Demo safety

Use synthetic cases only; never enter real patient information. This is an education demo, not clinical advice. Use a headset, cap API spend and keep the text fallback and a backup recording ready. The app has no authentication or per-user quotas; keep this foundation local or behind access controls before sharing a funded deployment. Follow [AGENTS.md](AGENTS.md) for contribution rules.
