# medBot

A voice patient for medical students to interview, built for hackaTUM 2026 and the Avelios challenge “VIP – Virtual Interview Patient”. Synthetic cases, distinct personalities, selective disclosure, and a background consistency guard. Works offline with a clearly labelled deterministic text mock.

## Quick start

Use Node 26 (Node >=24 supported; native TypeScript stripping is required).

```sh
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local to enable voice and OpenAI text.
npm install
npm run dev
```

Open http://localhost:3000. Select a case and personality, start the interview, and allow the microphone. You can always type a question. Without a key, text uses the mock engine; if microphone access fails, text remains available. Voice needs HTTPS or localhost and a browser supporting WebRTC.

The only required setting is `OPENAI_API_KEY`. Optional model settings are documented in `.env.example`; an empty text model uses the engine default. Keep real environment files local.

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

## Architecture

```text
Browser ── WebRTC audio + oai-events ── OpenAI Realtime
   │         (ephemeral key only)
   │
   ├─ /api/session ── OpenAI client secret minting
   ├─ /api/chat ───── patient engine ── OpenAI text / deterministic mock
   ├─ /api/guard ──── consistency guard ── OpenAI text / mock
   ├─ /api/coach ──── end-of-interview coach report ── OpenAI text / mock
   ├─ /api/memo ───── session instructions + consistency memo (mid-call)
   └─ /api/health, /api/cases
             Next.js API routes
                    │
                lib/engine
                    │
                cases/*.json
```

The server loads and validates cases. The browser gets case summaries and a teaching checklist, not the full patient prompt. Voice and text use the same engine-generated instructions. `reveal_fact` tool calls update coverage; the background guard reports potential issues without blocking speech. Changing case or personality starts a fresh interview. The app stores no conversations; requests sent to OpenAI are subject to your provider settings.

Voice latency is measured in the browser from `input_audio_buffer.speech_stopped` to the first output-audio event. Text latency is the full browser request round trip. Last and median values are shown separately for these two measures. Voice latency is an event-based approximation of audible onset, not an acoustic measurement. Speech transcription is asynchronous; incomplete transcripts can limit guard observations.

## Coach report, consistency memo and transcript export

- `POST /api/coach` with `{ caseId, history, revealed }` returns a `CoachReport` (score, coverage per category, covered facts with the student's quote, missed facts with suggested questions, strengths, improvements). After **End interview** the summary shows it; the label “Mock coach” appears when no key is set.
- Long voice conversations: after every 6th patient turn the browser asks `POST /api/memo` (`{ caseId, personalityId, revealed }`) and sends the returned text as a Realtime `session.update` (`{ session: { type: "realtime", instructions } }`) over the data channel. The ephemeral key is never used for this; instructions come from the server. This `session.update` shape follows the GA session object used for client secrets and has not been exercised against a live session.
- **Download transcript** (below the composer and in the summary) saves a JSON file with case, personality, messages, revealed fact ids, latencies, guard warnings and the coach report, for demos and the pitch.
- If the microphone is denied or the connection drops, the interview continues in text mode and the transcript is kept.

## Demo script

1. `npm run dev`, open http://localhost:3000 (mock mode works without a key).
2. Pick a case and a personality, press Start, ask about the complaint, then medication and family history.
3. Watch disclosed facts and the consistency check update; press End interview.
4. Show the coach report (score, missed facts, suggested questions) and download the transcript as evidence.
5. Repeat with another personality to show the same disease with a different patient.

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
