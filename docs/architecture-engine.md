# Patient engine

Author: Codex, 2026-11-28.

All cases are synthetic. `lib/case/types.ts` is the shared, unchanged contract.
`lib/engine/index.ts` exports the public engine API. Runtime code uses only built-in
Node APIs and `fetch`; Node 26 runs the TypeScript directly with type stripping.
Relative imports include `.ts`, and type-only imports disappear at runtime.

## Case loading and disclosure

`listCases()` reads and validates `process.cwd()/cases/*.json`, rejects duplicate
case ids, and sorts summaries by title. `loadCase(id)` matches the internal id,
not the filename; missing ids throw the exported `CaseNotFoundError`. Invalid
cases fail closed with validation errors rather than becoming patient prompts.

`buildPatientInstructions(case, personality)` is deterministic and shared by the
text engine and Realtime voice session. It contains every fact's id, clinical
truth, lay wording and disclosure condition. Clinical truth is reference material;
the patient must speak lay English, avoid `never_say` and other jargon, and answer
only the current question in 1–3 sentences. Background supports small talk and
cannot establish additional medical facts. Unknown details use `unknown_answer`,
including unknown negative findings.

In voice mode, supply both these instructions and `buildRevealFactTool(case)` to
the Realtime session. The model must call `reveal_fact(fact_id)` **before** speaking
each fact, including repetitions. The host records the id and returns a tool
result so speech can continue. In text mode, `patientTurn` uses a strict JSON
schema with `reply` and `revealed`, filters out unknown ids, and deduplicates ids.
These are model-reported disclosures, not a proof that the spoken/text answer
obeys the condition. The guard and transcript review provide additional checks.

## Consistency and personality

The case remains the source of truth on every turn. Call `patientTurn(c, p,
history, studentText, opts)` with preceding messages only; the function appends
the current student text for the model. Preserve all prior answers in `history`.
Call `guardTurn(c, historyWithCurrentStudentQuestion, reply, opts)` before adding
the candidate patient reply to that history. The guard compares the reply with
the case and preceding conversation for inventions, contradictions, jargon,
unprompted facts and departure from the patient role. It reports issues; it does
not rewrite, block or repair the reply. The caller decides how to surface them.

Personality changes wording, hesitation, emotion, humour and voice, never facts.
Opening lines and example lines guide delivery without adding medical evidence.
`getPersonality(c)` selects the first entry; an explicit unknown id throws.

Without `opts.apiKey`, the engine uses deterministic keyword matching over
disclosure conditions and lay text, greetings, opening lines and styled unknown
answers. It returns at most one matching fact per turn. This is an offline demo
and integration baseline, not a semantic patient simulator. The mock guard
detects dictionary jargon, verbatim facts without a matching question and explicit
AI/assistant role breaks; it does **not** assess invented facts or contradictions.

## Voice delivery, memo and coach

`buildPatientInstructions` ends with a short VOICE DELIVERY section derived from the
personality (pace, pauses, tone, the emotion to perform) and never changes facts.
`buildConsistencyMemo(case, revealedIds)` returns a short reminder of already
disclosed facts in lay wording; the web client can send it through Realtime
`session.update` every few turns. It grants no new disclosure permission. The mock
answers broad questions ("tell me about yourself", "anything else?") without facts.

`coachReport(case, history, revealedIds, opts)` returns a `CoachReport` (score,
per-category coverage, covered facts with the eliciting student question, missed
facts with a suggested question, strengths, improvements). Membership, coverage and
score are always computed from revealed ids; with an API key the model only supplies
feedback wording, verbatim quotes and suggested questions, and any failure falls
back to the deterministic mock report.

## OpenAI boundary and latency

`openai.ts` calls the [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
with `text.format` set to strict `json_schema`, `store: false`, and default model
`gpt-5-mini` (overridable through `opts.model`). One 15-second deadline covers the
whole request, retry delay and response parsing. HTTP 429 and 5xx get one retry;
numeric Retry-After delays are bounded to two seconds. Caller cancellation also
stops the request. Errors expose a kind and optional HTTP status; provider error
bodies, credentials and raw network exceptions are never logged or returned.

`PatientTurn.latencyMs` measures from entry into `patientTurn` to the parsed reply,
including prompt construction, API time and retry. The evaluation additionally
measures student + patient + guard cycles. Neither is voice end-to-end latency:
the web client must measure speech end to first audible patient response.

## Add a case

1. Add a JSON file under `cases/` with a unique safe lowercase `id` and an explicit
   synthetic provenance `note`. Fill every `PatientCase` field.
2. Give each fact a unique snake_case id, supported category, clinical truth,
   everyday lay wording and an explicit disclosure condition. Include important
   negatives as facts. Keep independently asked topics in separate facts.
3. Provide `unknown_answer`, a jargon list and at least two distinct personalities
   with supported Realtime voices, opening lines and examples. Keep medical facts
   out of background and personality examples.
4. Run `node --test tests/`, then `node scripts/eval.ts --mock --n 1 --case <id>`.
   Inspect transcripts and follow with repeated live evaluation before presenting.
