# Next steps — 2026-11-28

Codex, 2026-11-28. Berlin deadlines: freeze Sat 28-11 18:00; submission candidate Sun 29-11 08:00; submission Sun 29-11 10:00.

Status supplied today: `npm run check` green, 41 offline tests; CI added; `feat/Helmut` pushed (`4022dfc`, `afab5ef`, `b7514c8`, `c82dacb`).
Real OpenAI verified: health; chat 4.4 s; guard 2.2 s; session ephemeral realtime key OK; coach 10 s; anamnesis 2.8 s; `/eval` and `/usage` 200. Single endpoint observations do not establish voice or latency distributions.
Cases rewritten atomically (facts 15 → 29–41), with ICE, functional impact, red flags and full medication lists; Chatty voice now uses the warm branch. New skills: `clinical-case-design`, `patient-performance`, `patient-evaluation`.
New-case eval (n=3, 12 turns) running: **[pending eval]**. Helmut is testing live voice with a headset now.

Partial paired comparison: same cells (chest-tightness-01 × two personalities; multimorbid-dizziness × two), 12 turns, n up to 3. Unequal completion limits pairing; “OK” means completed, not error-free. Issue counts are automated; persona is blind automated transcript classification.

| Patient | OK | Invented | Contradictions | Unprompted | Jargon | Persona | Text p50 / p95 | Refusals |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| gpt-4.1-mini | 12 | 8 | 5 | 5 | not supplied | 11/12 | 1129 / 1793 ms | 2 |
| gpt-5-mini | 9 | 0 | 1 | 0 | 1 | 8/9 | 3644 / 7459 ms | not supplied |

Keep `gpt-5-mini` as text patient (consistency > text latency); voice uses `gpt-realtime` independently. These historical results do not validate the rewritten cases.

Priorities by Avelios criteria, then supporting features and submission:

1. **Naturalness & voice latency — Helmut.** Finish headset checks: English speech, emotion, interruption, repetition, disclosure tools and six-turn memo.
   Acceptance: save timings/sample count, model, device/network and transcript; median speech-stopped → first audio event against ~1.2 s target, plus separate listening assessment. Result: [pending eval].
2. **Text latency — agent.** Try streaming the reply to the UI, shorter instructions and a cache-friendly prompt prefix, separately.
   Acceptance: matched first-visible-text and complete-reply timings; preserved JSON/fact-ID validation, consistency, disclosure and requested-fact retrieval.
3. **Medical consistency — agent.** Audit new-case results against authored truth; fix failures without inventing facts.
   Acceptance: 0 observed invented / 0 contradictions, per-cell evidence and audit scope; no added issues or reduced coverage on matched propositions. Result: [pending eval].
4. **Personality — agent; human subset: Helmut.** Balance blind labels; include controls without stock openings and with the same voice.
   Acceptance: ≥80% recognition, confusion matrix/per-class denominators and descriptive Wilson 95% CIs; independent human ratings recorded separately. Warm Chatty, unchanged pain scores and complete answers. Result: [pending eval].
5. **Reveal only what is asked — agent.** Run the fixed [probe suite](../.claude/skills/patient-evaluation/references/probe-suite.md): false premise, unknown measurement, narrow disclosure, full medicines, repetition, injection and long-context/memo.
   Acceptance: map legacy IDs/expectations to new atomic facts; freeze questions/permission tables; audit spoken facts versus returned IDs both ways. **Requested-fact retrieval** = correctly answered permitted propositions / answerable propositions actually requested; unknown requests separate. Raw coverage alone confounds student omissions with patient failures. Result: [pending eval].
6. **Proof beyond a lucky run — agent.** Calibrate judges with planted failures and clean/uncertain controls; keep held-out probes and all incomplete/refused attempts. LLM-student eval does not automatically run fixed probes.
   Acceptance: n=3 matched comparisons, then **n≥5 per case × personality before Sat 18:00**, 12 turns; check `/usage?source=eval` before/after, keep calls traced. Retain commit/dirty diff, hashes, models/settings, questions and transcripts; map stable propositions across fact splitting.
   Acceptance: `/eval` shows per-cell results, requested-fact retrieval and descriptive Wilson 95% CIs for binary recognition/clean interviews (not issue counts/latency), with repeated-case and detector limits. Bind pitch numbers to actual artifacts/fields using [stats](../.claude/skills/patient-evaluation/references/stats.md); exit code alone is insufficient. Final: [pending eval].
7. **Coach & anamnesis — agent.** Audit reports, quotes, gaps, free-text note and export against disclosed propositions.
   Acceptance: no undisclosed facts; missed red flags visible; both reports/transcript download work; export labelled educational FHIR-like, not validated FHIR.
8. **Case creator — agent.** Rehearse diagnosis → validated synthetic case → selection → first answer before freeze.
   Acceptance: real OpenAI generation, complete medicine/disclosure fields, clear errors, immediate playability; no unmeasured speed or clinical-validation claim.
9. **Pitch — Helmut.** Rehearse [pitch](event/pitch-template.md) and [demo](event/demo-script.md), including transitions/report waits; confirm allocation.
   Acceptance: ≤3 minutes if confirmed; same facts/different personalities, structured output, measured evidence; pending numbers stay pending until inspected.
10. **Backup video — Helmut.** Record the voice/personality/report journey; rehearse text fallback.
    Acceptance: local playback without network, synthetic data only, no secrets/account identifiers; actual path/playback time recorded. Recording readiness remains pending.
11. **Devpost — Helmut.** Verify [draft](event/devpost-template.md) against live form/rules/links; candidate Sun 08:00, submit before 10:00.
    Acceptance: accessible repo/demo/video, accurate disclosures and saved receipt. After Sat 18:00: demo-critical fixes, evidence and presentation only; disclose unmet gates.
