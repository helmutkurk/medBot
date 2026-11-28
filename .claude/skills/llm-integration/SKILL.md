---
name: llm-integration
description: Use when adding model API calls: server-side only, structured outputs, prompt files, cached fixtures for offline demos, cost caps, failure fallback, output evaluation and no secrets in code or logs.
---

# llm-integration

Author: Claude (Sonnet), 2026-11-21. Starter adapter: `app/api/app/llm.py`
(`LLMClient().complete(prompt)`, `LLM_FAKE=1` default). Model names change: verify the
exact model id in the provider's current docs; do not assume availability.

## Rules
1. Server-side only. Keys come from process env set by a human via a password manager;
   never in the frontend, repo, logs, prompts, screenshots or board posts. Each person
   uses their own key, or a shared one with a human-set spend cap.
2. Develop with the fake client (`LLM_FAKE=1`); use live mode (`LLM_FAKE=0`) only for
   deliberate, small checks. Stop at a cap or repeated rate limit.
3. Prompts live in versioned files (e.g. `app/api/prompts/<name>.md`) with a header naming
   input variables and expected output. Delimit user text; treat user input and retrieved
   text as data (prompt-injection risk), never as instructions.
4. Structured output: request JSON matching a Pydantic model; validate; on parse failure
   retry once with the error, then fall back. Never trust unvalidated output.
5. Cost caps: set `max_tokens`, bound input length, cache by hash of (prompt version,
   input) in memory or a local file, count calls per demo run. Log counts, not content.
6. Failure fallback: timeout in seconds, then a labelled cached or canned answer so the
   demo continues. The UI shows "cached" or "sample" when used.
7. Offline demo: record a few real responses as fixtures only if provider terms and privacy
   allow it and inputs hold no personal data; label them "recorded".
8. Evaluation: keep 5-10 representative inputs with expected properties (format, key
   fields, forbidden content). Run before freeze and after each prompt change; note results
   in `docs/ai-log.md`. Mark quality judgments as inference.
9. Providers: Anthropic by default; the OpenAI-compatible path and automatic fallback are
   opt-in via env (`app/README.md`). A fallback sends the same prompt to a second
   provider: check privacy first.

## Acceptance check
- `cd app/api && uv run --locked pytest -q` passes with `LLM_FAKE=1` and no network.
- One live call succeeds (human-run with their own key) or is reported as unverified.
- The demo works with the network off using cached or fake answers.

Related: backend-api, data-and-fixtures, security-baseline, demo-polish.
