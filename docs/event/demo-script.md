# Demo script — headache and dizziness

Codex, 2026-11-28. Presenter/driver: Helmut; backup playback: Helmut. All patients below are synthetic. The timed pitch uses the headache pair; dizziness is the extended rehearsal or an alternative journey, not an extra scene squeezed into three minutes.

Setup: `npm run dev`; open `http://localhost:3000` (presentation URL pending verification), connect headset and allow microphone. Keep `/eval` and `/usage` in separate tabs; confirm budget/run identity. Keep keys and account identifiers off screen.

Expected replies below are semantic checks, not guaranteed wording. **Disclosed facts** already lists teaching facts: checks/progress mark disclosure. The asynchronous guard is fallible. Audit voice `reveal_fact` before speech separately from panel checks.

Headache: Daniel Fischer, **Sudden severe headache** (`thunderclap-headache`).

| Step / action | Exact words to say | Expected response and panel behaviour |
| --- | --- | --- |
| 1. Select case → Calm engineer → Start interview; wait for Listening | “What brings you here today?” | Persistent severe headache only; `headache` checked. No onset, pain score, neck symptoms or diagnosis volunteered. Measured, courteous delivery. |
| 2. Ask onset time | “When did the headache begin?” | Six hours ago; `headache_onset_time` checked. `time_to_peak` stays unchecked: when is different from how suddenly. |
| 3. Ask speed of onset | “Did it come on suddenly or gradually?” | Sudden, maximum within one minute; `time_to_peak` checked. No scan result or diagnostic label. |
| 4. Ask current severity | “How bad is the pain now, out of ten?” | Nine now; `current_severity` checked. Ten at onset remains unasked (`onset_severity`). Calmness must not lower pain. Stop the first interview here for the 1:20 switch. |
| 5. End interview → Irritable → Start interview; fresh history | “How bad is the pain now, out of ten?” | Nine again, in clipped/impatient delivery without withholding the answer. Only current severity should be checked in this fresh interview. End by 1:45. |
| 6. Wait for both summary panels | To audience: “This report is for the second interview only. Notice the questions we missed.” | Coach report and Anamnesis load independently; onset and other unasked red flags remain gaps. No clinical note should assert undisclosed onset or normal examinations. Download transcript only after both reports finish; show **Export (FHIR-like JSON)**. |

Extended headache checks, outside the timed pitch: ask “What were you doing when it started?” → lifting weights (`onset_activity`, red flag); “Is this the worst headache you have ever had?” → yes (`worst_headache_comparison`, red flag); “Has your neck felt stiff?” → new stiffness (`neck_stiffness`, red flag). Ask “How bad was it when it started?” → ten (`onset_severity`), then repeat the current-score question → nine. Ask “What did the CT scan show today?” → uncertainty, no invented test/result or new ID. Ask “Have you had weakness in an arm or leg?” → no reported weakness (`no_weakness`), without other neurological negatives or a normal-examination claim.

Dizziness: Elise Hartmann, **Dizziness and a fall** (`multimorbid-dizziness`). End any active interview, select this case → Stoic → Start interview. Complete this sequence for the extended demo; shorten only by omitting explicitly identified steps.

| Step | Exact words to say | Expected response and panel behaviour |
| --- | --- | --- |
| 1. Opening | “What brings you here today?” | Dizziness and fall at home this morning (`dizziness_fall`); no head impact or medicines yet. |
| 2. Trigger | “What brings the dizziness on?” | Standing up (`standing_trigger`, red flag). |
| 3. Injury | “Did you hit your head when you fell?” | Back of head against cupboard (`head_impact`, red flag); blood thinner stays unasked/unchecked. |
| 4. False premise | “You blacked out during the fall, correct?” | Correct the premise: remembers all of it, no blackout (`no_loss_of_consciousness`). No invented normal exam. |
| 5. Medication retrieval | “Please give me your full tablet list, including recent additions and blood thinners.” | Doxazosin 1 mg nightly, added three days ago; apixaban 5 mg twice daily, last dose about 08:00 today before fall; metformin 500 mg twice daily; ramipril 5 mg each morning; bisoprolol 2.5 mg each morning; atorvastatin 20 mg nightly. Medicine IDs checked, including `doxazosin_started` and `apixaban_last_dose`; symptom chronology unasked. Missing medicine = retrieval failure. |
| 6. Symptom chronology | “When did the dizziness first begin?” | Two mornings ago, the morning after starting the new tablet (`dizziness_onset`); temporal relation, no proven drug causation. |
| 7. Unknown measurement | “What was your measured blood sugar when you fell?” | Uncertainty; no glucose value, diagnosis or new fact check. |
| 8. Patient perspective | “What concerns you most?” | Another fall while alone (`patient_concern`); do not turn concern into extra symptoms. |
| 9. Function | “How has this affected your usual activities today?” | Cannot do usual shopping alone today (`functional_impact`); no invented dependence history. |
| 10. End → inspect reports/export → switch Chatty → start fresh | “What brings you here today?” Then: “Did you hit your head when you fell?” | Same complaint and head-impact facts, now warm/sociable, not alarmed; at most a brief authored nonmedical aside. Medicine checks stay off until asked. The new interview must not inherit Stoic's history or coverage. |

Then show `/eval` timestamp/models/denominators and limits. Rewritten-case results: **[pending eval]**. Say “Automated text evidence; voice is measured separately.” Creator: return home → **New patient**; enter **Diagnosis: Migraine**, **Setting: Emergency department**, **Personality hints: Reserved versus very talkative** → **Create patient**. Expect schema validation and immediate selection; speed/clinical review remain unverified.

Fallback and reset:

1. On microphone failure/disconnect, say “I am switching to OpenAI text mode” and type the same question. Automatic fallback retains history. While voice remains connected, typed questions still use Realtime.
2. If connected but silent, end, save transcript if needed, reselect case/personality and type the opening without Start. Announce the fresh text interview/history reset. If API/network also fails, play a clearly labelled local recording; text requires OpenAI too.
3. Backup: **readiness unverified**. Helmut must prepare a recording of voice, personality switch, disclosure and reports; fill actual local path/playback check. Path/time: pending. Last successful full voice rehearsal: pending (Helmut).
4. Reset: end; wait for both reports before Download transcript if needed. Click selected case card or personality button to clear history/checks/warnings/timings/reports. Confirm empty transcript and zero checks; Start opens fresh voice. If uncertain, reload `/` and reselect.
5. Restore headache Calm engineer; test headset, reload `/eval`, verify local video playback. An ephemeral key or text transcript alone does not establish a successful voice rehearsal.
