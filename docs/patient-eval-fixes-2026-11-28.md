# Targeted patient consistency and disclosure audit

Author: Codex, 2026-11-28.

Scope: targeted revision of three existing synthetic teaching cases and the patient response boundary. Clinical review remains pending. These changes support history-taking education, not diagnosis, treatment or real patient care. Existing case provenance is retained; the new fall negatives are explicitly authored fiction requested for this revision, not inferred from the suspected cause or remembered consciousness.

## Case cards and proposition audit

| Case / source | Timeline anchor | Targeted revision and truth state | Review limits |
| --- | --- | --- | --- |
| `chest-tightness-01` / `cases/example-chest-tightness.json` | Started Tuesday, four days before interview | `onset_speed`: gradual build over about a minute (present), without bundling the activity or onset date. `exertion_trigger`: stairs/uphill trigger (present); broaden disclosure to onset questions. | Existing clinical truth retained; clinical review pending. |
| `abdominal-pain-01` / `cases/abdominal-pain.json` | Started yesterday afternoon; migrated overnight | `abdominal_site`: current low-right pain (present). `initial_pain_site`: initial belly-button pain (historical, present). Distinguish both in truth, lay wording and permissions without creating duplicate IDs. | No new location, examination or diagnosis inferred; clinical review pending. |
| `multimorbid-dizziness` / `cases/multimorbid-dizziness.json` | Today's fall about 10:00; interview about noon | Add `no_fall_jerking`, `no_fall_tongue_biting`, `no_fall_wetting`: three separate patient-reported absences during the fall. | Newly authored synthetic negatives, not objective findings or seizure exclusion. Bowel-control history remains unauthored; clinical review pending. |

## Question-to-fact permissions

| Question / ordinary paraphrase | Permitted facts | Boundary |
| --- | --- | --- |
| Chest: “When/how did it start?”, “Sudden or gradual?”, “What were you doing?” | `exertion_trigger`, plus independently requested `onset` / `onset_speed` | Circumstance of onset is permitted; duration, relief, radiation and other history still require their own triggers. |
| Abdomen: “Where does it hurt now?” / broad opening | `abdominal_site` | Say low on the right now; do not append the initial belly-button site. |
| Abdomen: “Where did it first hurt?” | `initial_pain_site` | Initial site is historical; migration timing requires its own trigger. |
| Abdomen: “Did it move?” / “Describe it from the beginning” | `pain_migration` (and initial site for a course-from-beginning request) | Migration remains separate from current radiation. |
| Fall: “Any jerking/shaking?” | `no_fall_jerking` | Does not disclose tongue biting, wetting or other unrequested negatives. |
| Fall: “Did you bite your tongue?” | `no_fall_tongue_biting` | Does not disclose other fall negatives. |
| Fall: “Did you wet yourself/lose bladder control?” | `no_fall_wetting` | Does not establish bowel control. |
| Fall: “Did you black out?” | Existing `no_loss_of_consciousness` | Does not permit any of the three new negatives by itself. |
| Repeated permitted question | Same requested fact IDs and propositions | Repetition grants no extra disclosure. Medication and sensitive-history triggers are unchanged. |

## Text and voice boundary

The text adapter first filters and deduplicates returned IDs against the selected case. With at least one valid disclosed ID, it removes the selected case's complete generic unknown-answer wording, ignoring case, punctuation, whitespace and apostrophe style. Unknown-only answers retain that wording. Specifically scoped uncertainty remains available for unsupported parts of multipart questions. Leaked `reveal_fact` invocations and model delimiters are removed without granting any fact coverage. An empty cleaned reply is an invalid provider response.

Both prompts make the same uncertainty distinction explicit. Realtime additionally forbids speaking tool/meta tokens. Audio cannot be post-processed by this text cleanup; live voice compliance is unverified.

## Evidence and expected effect

Baseline: `eval/results/2026-11-28T10-27-47.638Z.json`, configured n=5, 39 completed interviews. Automated guard totals: 9 contradictions, 10 unprompted disclosures, 3 inventions, 1 out-of-character issue. These are detector findings, not independent clinical ratings.

The exact complete generic fallback appears in five contradiction-tagged candidate replies (chest downplaying run 3; dizziness stoic run 1; abdominal reserved runs 1, 4 and 5). Cleanup removes that text when a valid fact ID is reported. The dizziness finding also cites uncertainty in an earlier turn, so removing its suffix alone does not establish that the entire finding disappears. The headache irritable run 2 contradiction uses a specifically scoped last-use paraphrase; it is outside the exact/normalized generic-fallback rule. Remaining timing, appetite and location findings require separate assessment.

Expected, not measured: fewer fallback-induced contradictions, three fewer chest-onset disclosure findings under the revised permission, removal of the observed tool-token leak, less confusion between abdominal initial/current site, and supported retrieval of the three requested fall negatives. Do not subtract these expectations from the baseline to publish an after score. The fall guard detail groups bladder/bowel control, but the actual candidate says “wet myself”; only the urine-loss negative has been authored, and bowel-control history remains unknown.

Coverage mapping: existing fact IDs are unchanged. Chest stays at 36 facts; abdomen stays at 44; dizziness increases from 44 to 47. Compare dizziness coverage on its original 44 IDs separately from new-negative retrieval and native 47-ID coverage. No actual new interview or documentation has been produced; new fall negatives can support symptom-history documentation only when spoken, with the corresponding disclosed ID and supporting transcript quote. Never count an unasked negative as denied or a patient report as a normal examination.

Validation: `npm run check` passed (strict typecheck, all 24 test files, all built-in case validation, production build) in an isolated copy of the current source without environment files. Offline fetch-stub tests exercise the real Responses API envelope, selected-case fallback normalization, valid-ID gating, scoped uncertainty, leaked tool calls and empty-cleaned-response errors. The existing arbitrary 45-fact ceiling in the demo-case test was removed to allow the additional atomic negatives; schema and safety-fact assertions remain. Paid paired evals and live voice were explicitly excluded from this task; the before/after merge gate remains unverified. No clinician approval or measured performance improvement is claimed.

The post-build `npm run smoke` was attempted in the same environment-free copy and stopped because this sandbox prohibits localhost listeners. The HTTP smoke remains unverified; run `npm run build && npm run smoke` outside the sandbox. No browser was launched, no paid eval was run and no commit was made.
