# Three-minute pitch — medBot

Codex, 2026-11-28. Confirm the actual allotted time with organizers. Follow the [winning-plan beats](../winning-plan.md#demo-script-3-minutes), using the headache personality pair in place of Frank. Time speech, patient replies, report waits and transitions together; [exact demo actions](demo-script.md).

| Time | Action | Spoken script |
| --- | --- | --- |
| 0:00–0:20 | Problem and user | “Medical students need practice asking the right questions, listening to different people and documenting what they actually heard. We built medBot: synthetic patients you can interview in English by voice, with feedback on what you asked and what you missed.” |
| 0:20–1:20 | Start Daniel, Calm engineer; ask the headache sequence | “Daniel sounds composed. Watch the disclosed-facts checks: the opening does not reveal the whole history.” Ask: “What brings you here today?” “When did the headache begin?” “Did it come on suddenly or gradually?” “How bad is the pain now, out of ten?” After replies: “Calm delivery does not change severe symptoms. The sudden onset appears when we ask about it.” |
| 1:20–1:45 | End; select Irritable; start fresh | “Same case, different personality.” Ask exactly: “How bad is the pain now, out of ten?” After reply: “Different delivery; the same nine out of ten. We test that distinction across interviews.” End this interview. |
| 1:45–2:10 | Wait for coach + anamnesis; show gaps and export | “This feedback belongs to the second interview. We asked very little, so the gaps should be visible. The coach suggests questions; the anamnesis drafts documentation from disclosed facts. This export is educational FHIR-like JSON, not a validated FHIR resource.” |
| 2:10–2:35 | Open `/eval`; identify the displayed run | “In a partial text comparison, gpt-5-mini had zero guard-detected inventions, one contradiction and eight of nine personality labels correct. Its median complete text reply was 3644 milliseconds. We kept it for consistency. That is not voice latency. The rewritten-case evaluation is still pending.” |
| 2:35–3:00 | Open New patient; enter “Migraine”; Create patient | “A diagnosis starts a new synthetic case, validated against our schema and selected for practice. Generation time and clinical correctness still need checking. Our approach for Avelios is structured case in, structured anamnesis out—with visible gaps and repeatable evaluation.” If still generating, close on that honest state. |

If the refreshed eval is inspected before rehearsal, replace the pending sentence with: “On the rewritten cases: [pending eval] completed interviews, [pending eval] guard-detected inventions, [pending eval] contradictions, personality [pending eval] correct over [pending eval], descriptive Wilson 95% interval [pending eval].” Shorten to fit; never read placeholders aloud. If `/eval` displays a different run, do not describe it as the historical comparison.

Evidence card for questions (supplied status, 2026-11-28; bind public numbers to actual run artifacts before presenting):

| Partial text comparison | gpt-4.1-mini | gpt-5-mini |
| --- | --- | --- |
| Completed (“OK”, not safety-clean) interviews | 12 | 9 |
| Guard-detected invented / contradictions / unprompted | 8 / 5 / 5 | 0 / 1 / 0 |
| Jargon | not supplied | 1 |
| Blind automated transcript personality recognition | 11/12 | 8/9 |
| Complete patient text response p50 / p95 | 1129 / 1793 ms | 3644 / 7459 ms |
| Refusals | 2 | not supplied |

Same cells: chest-tightness-01 × two personalities and multimorbid-dizziness × two; 12 turns, n up to 3. Partial completion and LLM-generated questions limit pairing; automated guard counts are fallible issue counts, not affected-interview counts. No independent human rating or clinical validation is established by these figures. Case fact splitting (15 → 29–41) changes coverage denominators; requested-fact retrieval needs a separate audit. New-case n=3 run: **[pending eval]**; final n≥5 run: **[pending eval]**.

Verified today: `npm run check` green with 41 offline tests and CI added. Live OpenAI health, chat (4.4 s), guard (2.2 s), ephemeral session key, coach (10 s), anamnesis (2.8 s) worked; `/eval` and `/usage` returned 200. Single endpoint timings are not percentiles. Headset voice is being tested by Helmut: voice-onset median/sample count **[pending eval]**; `gpt-realtime` is independent of the text patient model. The ~1.2 s voice target and ≥80% recognition are targets, not established results on the rewritten cases.

Rehearsal rule: do not wait through a broken voice connection; announce text mode or play the local backup recording. Both require rehearsal; the recording is not yet confirmed ready. If reports fail, say they are unavailable; show a clearly labelled prior recording only if verified. No mocks, real patient data, invented impact figures or claims of universal factual correctness.
