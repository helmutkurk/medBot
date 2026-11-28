# Synthetic case audit template

Author: Codex, 2026-11-28. Fill with evidence rather than assuming a complete or clinically reviewed case.

## Case card

| Field | Value |
| --- | --- |
| Case ID / JSON path / version or hash | |
| Synthetic provenance / generator prompt version if applicable | |
| Intended use / learning objectives | History-taking education; specify objectives. |
| Out of scope / limitations | Clinical diagnosis, treatment and real patient use. Add case-specific limits. |
| Relative timeline and interview time anchor | |
| Clinical review status / role / date | Pending unless actually reviewed; avoid personal reviewer data. |
| Author / date / changes | |

## Proposition audit

Use one row per independently askable proposition, including components currently bundled under one ID. Label diagnostic context and objective findings separately from patient-reported history.

| Fact ID / component | Truth state: present, absent, unknown, not authored | Truth and lay wording agree? | Timeline / units consistent? | Duplicate or bundled? | Clinical concern / risk factor / screening item | Evidence or proposed action |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Question-to-fact permissions

Record the current trigger and intended permission separately when they conflict. Include broad opening, full medication list, specific symptom, sensitive-history and repeated-question examples.

| Question / permitted paraphrases | Allowed proposition(s) / IDs | Excluded unrelated propositions | Current trigger mismatch | Proposed fix / rationale |
| --- | --- | --- | --- | --- |
| What medicines do you take, including new or occasional tablets? | All authored medicines | Unasked unrelated symptoms | | Avoid hidden-keyword requirements. |
| When was your last period? | Menstrual timing | Sexual activity / test results | | Keep sensitive history independently disclosable. |

## Documentation mapping

| Documented proposition | Section | Disclosed fact ID | Supporting patient turn / quote | Status: supported, partial, not elicited, unknown | Fix |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

Check the full note as well as structured rows. Do not turn a missing fact into a denial, a partial bundled answer into a complete finding, or patient history into a normal examination. Keep unvalidated exports labelled FHIR-like.

## Decision and evidence

- List clinical uncertainties, disclosure defects and proposed synthetic authoring changes.
- Record schema validation, `npm run check` result and paired eval artifact paths when implementation is authorized.
- Record before/after coverage, inventions, contradictions, unprompted disclosures and remaining regressions. Reconcile changed fact denominators with a stable proposition mapping.
- Record review status and blocking findings. Leave unresolved placeholders visible rather than calling the case ready.

## Sources

Derived from [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `model-card`, `define-variables`, `generate-codebook`, and [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `clinical-reports`, via supplied research notes. Text and template are original, not copied. Clinical interpretation requires the separate history checklist and appropriate review.
