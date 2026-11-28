# Patient engine

Author: Codex, 2026-11-28.

All cases are synthetic. `lib/case/types.ts` is the shared contract.
`lib/engine/index.ts` exports the public engine API. Runtime code uses only built-in
Node APIs and `fetch`; Node 26 runs the TypeScript directly with type stripping.
Relative imports include `.ts`, and type-only imports disappear at runtime.

## Case loading and disclosure

`listCases()` reads and validates `process.cwd()/cases/*.json` and
`cases/generated/*.json`, rejects duplicate
case ids, and sorts summaries by title. `loadCase(id)` matches the internal id,
not the filename; missing ids throw the exported `CaseNotFoundError`. Invalid
cases fail closed with validation errors rather than becoming patient prompts.
`listCases(directory?)` and `loadCase(id, directory?)` accept a cases-directory
override for isolated tests. A missing `generated/` directory is allowed. Facts
accept an optional boolean `red_flag` for safety-critical history items.

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

All five engine operations require `opts.apiKey` and call OpenAI. An absent or
blank key throws the exported `MissingApiKeyError`; upstream failures throw
`OpenAIError`. The guard merges local `findJargon` dictionary matches with the
model's issues. Disclosure, role and medical consistency checks use OpenAI.

## Voice delivery, memo and coach

`buildPatientInstructions` ends with a short VOICE DELIVERY section derived from the
personality (pace, pauses, tone, the emotion to perform) and never changes facts.
`buildConsistencyMemo(case, revealedIds)` returns a short reminder of already
disclosed facts in lay wording; the web client can send it through Realtime
`session.update` every few turns. It grants no new disclosure permission.

`coachReport(case, history, revealedIds, opts)` returns a `CoachReport` (score,
per-category coverage, covered facts with the eliciting student question, missed
facts with a suggested question, strengths, improvements). Membership, coverage and
score are always computed from revealed ids. The model supplies feedback wording,
verbatim quotes and suggested questions. Request failures or malformed output
throw typed errors; no substitute feedback is returned.

## Structured anamnesis and case creation

`anamnesisReport(c, history, revealed, opts)` returns `AnamnesisReport`, including
seven `AnamnesisSection` rows, a plain-text note and a FHIR-like Composition.
Complaint maps to presenting complaint, symptom to history of present illness,
history to past history, and lifestyle/social to social history; other categories
map to their named sections. Unknown and duplicate revealed ids cannot increase
completeness. Missing facts and `redFlagsMissed` always come from case truth and
revealed ids. The model receives only documented facts and the transcript and
rewrites their text and the note, including when no facts have been disclosed.
Invalid membership or request failures throw typed errors. Empty sections say “Not documented”, never an inferred
negative finding. The export is a demo shape, not a validated FHIR resource.

`generateCase(input, opts)` accepts `CaseDraftInput` (diagnosis plus optional
setting, age, sex and personality hints). Strict Responses output
produces a complete synthetic case with 10–15 facts and two personalities with
different voices. Validation errors trigger one fresh generation attempt; a
second invalid result throws `OpenAIError` with kind `invalid_response`. Generated ids use `gen-<diagnosis-slug>-<hash>`;
provenance explicitly states synthetic and AI-generated. Setting and personality
hints guide generation; every case must pass `validateCase` before it is saved.

`saveGeneratedCase(c, directory?)` validates and writes only `gen-` ids under
`cases/generated/` (or the directory override). Re-saving identical content is
allowed; different content with the same id is rejected. Loading validates these
files together with built-in cases, including duplicate-id checks and title sort.
The dizziness and sudden-headache demo cases each supply 15 facts and two
contrasting personalities; safety-critical facts in all four built-in cases are
marked for documentation feedback.

## OpenAI boundary and latency

`openai.ts` calls the [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
with `text.format` set to strict `json_schema`, `store: false`, and default model
`gpt-5-mini` (overridable through `opts.model`). One 15-second deadline covers the
whole request, retry delay and response parsing (20 seconds for documentation,
45 seconds per case-generation attempt). HTTP 429 and 5xx get one retry;
numeric Retry-After delays are bounded to two seconds. Caller cancellation also
stops the request. `OpenAIError` exposes a kind and optional HTTP status; provider error
bodies, credentials and raw network exceptions are never logged or returned.
Routes map missing keys to 503 `no_api_key`, timeouts to 504 and upstream failures
to 502. Health returns `{ ready: boolean, models }`; the UI shows setup steps
instead of an interview when the key is absent.

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
4. Run `npm test`, then `npm run eval -- --n 1 --case <id>` with an API key.
   Inspect transcripts and follow with repeated evaluation before presenting.
