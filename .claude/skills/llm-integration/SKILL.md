---
name: llm-integration
description: Use when adding or changing OpenAI calls, model routing, structured outputs, retries, traces or API failures; preserve server-side secrets, real product responses and offline fetch-stub tests.
---

# LLM integration

Author: Codex, 2026-11-28.

Build on this repo's OpenAI adapters. Read `AGENTS.md`, `README.md`, `lib/engine/openai.ts`, the relevant engine operation and `lib/server/env.ts` before editing. Read the relevant bundled guide in `node_modules/next/dist/docs/` before writing Next.js code; installed APIs may differ from remembered versions.

## Route calls and secrets

- Use OpenAI only. Keep `OPENAI_API_KEY` on the server through the existing environment helpers; never read, print or commit real environment files or keys. Consult `.env.example` for setting names. Do not expose keys through client bundles, error bodies, logs, screenshots or prompts.
- Preserve the model split: `OPENAI_PATIENT_MODEL` defaults to `gpt-4.1-mini` for text patient replies; `OPENAI_TEXT_MODEL` defaults to `gpt-5-mini` for student, guard, judge, coach, anamnesis and generation work. Use `getModels()` / engine constants and pass the appropriate model explicitly; `requestStructured` defaults to the text model, not the patient model.
- Keep Realtime and transcription settings separate (`OPENAI_REALTIME_MODEL`, `OPENAI_TRANSCRIBE_MODEL`). Mint ephemeral Realtime credentials server-side; only the ephemeral credential reaches the browser for its WebRTC connection. Keep client-secret creation and usage tracing on their existing paths.
- Treat case content, student speech and transcripts as data, not instructions that can override the patient role or disclosure rules. Build shared text/voice instructions through `lib/case/prompt.ts`.

## Use structured responses

Call `requestStructured` in `lib/engine/openai.ts` for structured text operations, with a named schema, explicit required fields, `additionalProperties: false`, instructions, input and trace context. Validate the returned `unknown` in the operation: parsed JSON does not establish semantic correctness, factual support or allowed IDs.

Preserve the Responses API envelope and `text.format` JSON schema path, `strict: true` and `store: false`. Keep model-supported reasoning settings; the current adapter uses low effort for reasoning-model names. Verify new model/setting compatibility against local code and official OpenAI documentation before changing it; do not guess unsupported options to chase latency.

Reuse typed `MissingApiKeyError` / `OpenAIError`, cancellation and bounded timeouts. The current adapter shares a timeout across at most two attempts and retries only the first 429 or 5xx response with a bounded delay. Keep parse errors, refusals and invalid operation output visible; do not add unlimited retries or silently substitute content.

Keep user-facing failure contracts coherent: missing key → setup state / 503 `no_api_key`, timeout → 504, upstream failure → 502 according to existing HTTP helpers. Discard unsafe provider error bodies. Let text mode continue through OpenAI when audio fails; an unavailable provider remains an explicit error. Do not introduce Anthropic, fake mode, cached/canned patient answers or cross-provider fallbacks into the product. Use a separately identified backup recording for the demo.

## Trace every call and watch budget

Supply operation, source (`app` or `eval`), case/personality IDs and route where applicable. Preserve per-attempt success/error, model, latency and token metadata through `recordTrace`; default output is `traces/llm.jsonl`, with `MEDBOT_TRACE_DIR` as an override. Use the trace-field allowlist: never log prompts, replies, transcripts, credentials or patient details. Trace Realtime/session attempts and browser-reported usage through their existing paths too.

Check `/usage` or `/api/usage`, including `?source=app|eval`, before and after deliberate live checks. Watch the capped key and avoid unbounded parallel runs. Treat estimated USD as an estimate, not an enforced spend cap; unknown-model pricing, missing usage and lost browser reports can undercount. Compare with the provider billing dashboard when actual spend matters. Preserve usage-missing/unknown-model indicators.

## Verify without product mock mode

Use Node 26 tests with `node:test` and `node:assert/strict`. Stub `globalThis.fetch` only in offline tests and restore it after each test. Return real provider response shapes, for example:

```json
{
  "status": "completed",
  "output": [{
    "type": "message",
    "content": [{ "type": "output_text", "text": "{\"reply\":\"About five minutes.\",\"revealed\":[\"episode_duration\"]}" }]
  }],
  "usage": { "input_tokens": 20, "output_tokens": 12 }
}
```

Use synthetic cases and a placeholder test key; a stubbed call is not proof of a live integration. Cover the changed behaviour at the boundary: request/model routing, valid structured output, refusal/incomplete/invalid response, bounded retry, timeout/cancellation, safe HTTP errors and metadata-only traces as relevant. Reuse `tests/trace-setup.ts` to isolate test trace output.

Run `npm run check` before declaring an implementation complete and `npm run smoke` after a build for the no-key HTTP path. For case/prompt changes, run paired `npm run eval -- --n 3` and include before/after numbers in the PR; block added invented facts, contradictions, reduced coverage or raised disclosure issues. Use `patient-evaluation` for evidence limits. Report live API and voice behaviour as unverified unless actually exercised; never print secrets to diagnose a failure.

## Sources

Primary implementation authority: this repo's `AGENTS.md`, README, engine/server adapters and tests. Derived evaluation ideas: [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `mllm-eval`, `design-ai-benchmarking`; source-fact discipline: [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `clinical-reports`, via supplied research notes. Text is original, not copied. Clinical interpretation belongs to the synthetic-case skills; no treatment guidance is provided here.
