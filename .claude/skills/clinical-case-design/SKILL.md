---
name: clinical-case-design
description: Use when authoring, generating or reviewing synthetic patient cases, disclosure conditions, teaching checklists or anamnesis mappings; audit clinical truth before polishing the dialogue.
---

# Clinical case design

Author: Codex, 2026-11-28.

Produce a case audit and a reviewable synthetic case specification for history-taking education. Keep diagnostic context private to the evaluator; do not turn this simulator into a diagnostic or treatment service.

## Establish the truth

1. Read `AGENTS.md`, `lib/case/types.ts`, `lib/case/validate.ts`, the target `cases/*.json`, and `lib/case/prompt.ts`. Inspect `lib/engine/creator.ts` for generation or `lib/engine/anamnesis.ts` for documentation work.
2. Read [history-checklist.md](references/history-checklist.md) when choosing history domains or reviewing clinical safety. Use its questions to find authoring gaps, never to fill runtime answers from textbook expectations.
3. Read [case-audit-template.md](references/case-audit-template.md) and complete it. Record provenance, learning objectives, relative timeline, version, limitations and clinical-review status. Mark unreviewed content explicitly; schema validation is not clinical approval.
4. Distinguish present, explicitly absent, unknown to the patient, and not authored. Missing data and unasked questions establish neither absence nor normality.
5. Separate patient-reported history, objective findings and evaluator-only hypotheses. A patient reporting no weakness does not establish a normal neurological examination. A suspected diagnosis does not establish a test result.

## Make disclosure answerable

- Author one independently disclosable proposition per fact ID. Split symptom timing, severity, associated symptoms, individual negatives and sensitive history when different questions elicit them. Avoid duplicate IDs for the same proposition because they inflate coverage denominators.
- Audit `truth`, `lay` and `reveal_when` together. Ensure lay wording conveys the whole authored proposition without adding meaning; “Nothing special” does not communicate forgotten blood-pressure tablets.
- Write a question-to-fact permission table with ordinary paraphrases, broad questions and narrow follow-ups. Permit a genuine full-medication request to retrieve the complete authored list, including recent additions and blood thinners. Do not make students guess special keywords.
- Keep the opening limited to the presenting complaint. Let direct questions retrieve their answers regardless of personality. Reserve uncertainty for genuinely unknown information.
- Treat `red_flag` as the repo's safety-critical feedback marker. Distinguish an actual concerning finding, a risk factor and an important screening question in the audit; not every checklist item is a positive clinical red flag.
- Put substantive ideas, concerns, expectations and functional impact into authored case content with disclosure conditions. Personality may change their expression, not their underlying content.
- Keep the case card and richer audit states in a review artifact if the schema has no suitable field. Announce any proposed `lib/case/types.ts` change to both web and engine owners before editing that shared contract.

## Audit the current cases

Check these known seams against the current files rather than assuming they have been fixed:

| Case ID | Focus |
| --- | --- |
| `chest-tightness-01` | Duplicate `bp_medication` / `daily_tablets`, misleading lay wording, current pain status, last episode and progression. |
| `abdominal-pain-01` | Bundled `period_pregnancy`; menstrual timing does not automatically permit sexual-history disclosure. Pregnancy testing and vaginal symptoms are not authored. |
| `multimorbid-dizziness` | `head_strike` bundles injury with blood-thinner use; full-list triggers omit some medicines. Fall timing, time on floor, subsequent symptoms and last apixaban dose need explicit authoring if required. |
| `thunderclap-headache` | Bundled neurological negatives and fever/injury; distinguish onset-to-peak from ongoing severity and reported history from examination. |

Propose new synthetic facts as authoring changes with a rationale. Do not quietly infer them from a diagnosis, medication or personality. Keep medication causation provisional when only temporal association is known.

## Verify and hand over

Map every documented proposition to a disclosed fact ID and supporting patient turn. Keep “not elicited” separate from “denied”; flag the current ID-based documentation path if the transcript supports only part of a bundled fact. Describe exports as FHIR-like educational JSON unless separately validated against a named specification.

Return the completed audit, permission table, unresolved clinical questions and proposed edits. Use only fictional people and details. Run `npm run check` for authorized implementation changes. For case or prompt changes, obtain paired before/after `npm run eval -- --n 3` evidence and put the numbers in the PR; block merging added inventions or reduced coverage. Read `patient-evaluation` for the comparison procedure. Treat missing checks as unverified, not passing.

## Sources

Derived ideas: [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `model-card`, `define-variables`, `generate-codebook`; [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `clinical-reports`. Attribution follows the supplied research notes; external skill text is not independently audited here. This text is original, not copied. SOCRATES/OPQRST and history domains are general clinical-education knowledge; clinical sources and limits appear in the checklist.
