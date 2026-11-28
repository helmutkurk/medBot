# Three-minute pitch — medBot

Codex, 2026-11-28. Confirm the actual allotted time with organizers. The 3:00 target includes replies, clicks and transitions; timed rehearsal is still required. Follow the [exact demo path](demo-script.md). All patients are synthetic.

## Timed script

| Time | Spoken line | On-screen action |
| --- | --- | --- |
| 0:00–0:10 · Hook | “A patient can sound calm and still describe a dangerous headache. Will you ask the question that reveals it?” | Show **Sudden severe headache**, **Calm engineer**, Practice mode, checklist hidden. |
| 0:10–0:20 · Problem | “Medical students need practice with both the history and the person. medBot connects that interview to reflection, feedback and the next practice session.” | Point to the guided steps; start voice. |
| 0:20–0:53 · Live interview | Ask, pausing for replies: **“What brings you here today?” “Did it come on suddenly or gradually?” “How bad is the pain now, out of ten?”** Then: “The checklist is hidden during practice. Here is the instructor's view: onset appears when we ask.” | Wait for **Listening**. After opening reply, toggle **Instructor view**. Show onset/current-severity checks as answers arrive. Expected current severity: nine. End before switching tabs. |
| 0:53–1:15 · Same facts, different person | “A fresh interview, same facts, different person.” Ask **“How bad is the pain now, out of ten?”** Then: “Still nine. Different delivery must preserve the case.” | Switch to the fresh **Irritable** tab; start, hear reply, **End interview**. No inherited history. |
| 1:15–1:30 · Reflection | “Before showing answers, we ask the learner to reflect. Then a viva asks them to explain their reasoning.” | Enter concern: `Severe headache; onset and associated red flags still need exploration.` Confidence **2** → **Save reflection and see feedback**. Show viva/loading state. |
| 1:30–1:50 · Coach and replay | “Here is an earlier rehearsal of this same case, with the viva completed. The Calgary-Cambridge coach links feedback to quotes and missed patient cues. Replay puts those moments back in the conversation.” | Switch to the genuine completed rehearsal, explicitly labelled **Earlier rehearsal** in the presentation. Show **Detailed + replay**, communication ratings, **Missed patient cues**, **Annotated replay**. If no cue was identified, say so. |
| 1:50–2:10 · Adaptive learning | “The missed red flags shape the next patient and spaced reviews. XP, levels, badges and a daily streak make returning visible. Progress stays in this browser; the leaderboard is optional.” | Switch to the prepared **Your learning** tab; preserve C. Show **Next patient**, **Spaced safety review**, level/streak/badges. Point to **Create a patient for my weak spots**; do not wait for generation. Show actual progress, including zeroes. |
| 2:10–2:45 · Evidence | “Our v4 text run completed twenty-two interviews: ninety-one percent persona recognition, four unprompted disclosures, and one invention and one contradiction after removing empty guard placeholders. Voice was separate: forty-eight turns, no detected inventions or contradictions, three unprompted disclosures, and per-personality first-audio medians of three-fifty-eight to five-forty-three milliseconds. That measures request to received audio. Our Evidence page shows Wilson confidence intervals.” | Show the source-labelled evidence card below. Use the prepared **Evidence** tab for run identity and descriptive intervals only: it loads the latest usable run, skipping files with no completed interviews. Verify its source against v4. |
| 2:45–2:55 · Why Avelios | “For Avelios: structured case in, structured anamnesis out. Disclosed facts and gaps stay visible in an educational FHIR-like export.” | Return to completed rehearsal → **Anamnesis**, missing sections, **Export (FHIR-like JSON)**. |
| 2:55–3:00 · Close | “medBot turns each interview into a concrete next practice step.” | Hold on the note and next-step recommendation. Stop at 3:00. |

The earlier rehearsal must be a real OpenAI session with reflection, viva and reports completed. Never inject mock feedback. A recording or text fallback replaces a beat; it does not extend the pitch. Do not promise live reports will finish during the allotted beat.

## Evidence card and claim boundaries

These numbers describe dated artifacts, not every current case or deployment. Keep source labels on the slide.

| Evidence | Result | Artifact and qualification |
| --- | --- | --- |
| Text eval v4, gpt-5-mini | n=3 planned across 8 case × personality cells, 12 turns; **22 completed, 2 failed**; **4 unprompted**, **91% persona recognised**, **9.5% unknown answers**, complete text reply **p50 2.9 s**. | [Summary](../../eval/summary.md), [v4 raw report](../../eval/results/2026-11-28T02-42-28.926Z.json), [acceptance log](../overnight-progress.md). Unknown-answer share is the supplied v4 analysis, recorded in the acceptance status; it is not a medical-error rate or a summary column. |
| Text guard audit | **1 invented fact, 1 contradiction after discarding guard placeholders**. | Raw summary/aggregate still reports **2 / 2**. In abdominal-pain/anxious run 3, one invented and one contradiction issue have detail `None`; exclude those two placeholders only. Retain the two substantive detections. Label adjusted figures explicitly. |
| Voice bench v2, gpt-realtime | **48 turns over 8 personalities** (4 cases × 2), six turns each. Per-personality first-audio **p50 358–543 ms**; **0 invented, 0 contradictions, 3 unprompted**, guard-detected. | Reports: [chest](../../eval/voice/2026-11-28T08-11-14.188Z-11e42da1/report.md), [abdomen](../../eval/voice/2026-11-28T08-12-20.307Z-91de1143/report.md), [dizziness](../../eval/voice/2026-11-28T08-13-08.347Z-1205e267/report.md), [headache](../../eval/voice/2026-11-28T08-14-19.409Z-6b3cc933/report.md). Text request → first received audio delta, excluding microphone/VAD and headset playback. Range of cell medians, not a pooled interval. |
| Partial paired text-model test | gpt-4.1-mini: **8 invented facts**; gpt-5-mini: **0**. We chose consistency. | [mini partial](../../eval/results/2026-11-28T00-47-27.431Z.partial.jsonl), [5-mini partial](../../eval/results/2026-11-28T00-47-27.451Z.partial.jsonl); model assignment/decision in [next-steps](../next-steps.md) and [decisions](../decisions.md). Same four cells, 12 turns, n up to 3; 12 versus 9 completed interviews. Unequal completion limits comparison; historical zeroes do not describe v4. |
| Final n=5 per cell | **[pending final eval]** | Artifact, completed/failed, coverage, inventions/contradictions/unprompted, persona/Wilson interval and latency: **[pending final eval]**. Never read placeholders aloud. |

Guard and persona judge are automated and fallible. Repeated interviews of the same cases are correlated; Wilson intervals on `/eval` are descriptive. No clinical validation, human-rated coach agreement, improved learning outcomes or validated FHIR interoperability is established. Schema validation of generated cases is not medical review. The [competitor review, sections 3–4](../research/competitors.md#3-steal-list-top-12-ranked) informed the combined learning loop; it is not a head-to-head test or proof of exclusive features.

## Six likely judge questions

1. **How do you stop inventions?** “Structured case truth, disclosure triggers and a background guard constrain and check replies. They do not guarantee correctness: adjusted text v4 still had one invention and one contradiction; the separate voice bench detected none in 48 turns.”
2. **Why not a faster text model?** “The partial paired test detected eight invented facts with gpt-4.1-mini and zero with gpt-5-mini. We chose consistency despite slower complete text replies. Voice uses gpt-realtime independently.”
3. **Is voice really about 0.4 seconds?** “The bench's cell medians were 358–543 ms from text request to received audio. That excludes microphone turn detection and headset playback. The browser's ‘Voice felt’ meter measures a different path.”
4. **What differs from existing virtual patients?** “Our focus is the complete loop: controlled disclosure and personalities, reflection/viva, quoted coaching and replay, adaptive next cases, and structured documentation with repeatable evidence. Related products offer parts of this; we have no head-to-head superiority result.”
5. **Does adaptation prove students learn better?** “No outcome study yet. Coverage and communication feedback recommend practice and schedule missed red flags. XP and streaks reward returning; they are not measures of clinical competence.”
6. **Can Avelios use real hospital records today?** “This prototype uses synthetic cases only. It demonstrates structured case in and structured anamnesis out with educational FHIR-like JSON. Clinical review and interoperability validation come before clinical integration.”

## Four hackaTUM criteria the script must hit

- **Innovation / ambition:** Show that the interview changes the next practice task while structured input becomes structured documentation.
- **UI / UX:** Demonstrate choose → talk → reflect → feedback → next patient, with the answer key hidden during practice.
- **Overall quality:** Hear a live answer, compare the same fact across personalities, disclose measured failures and recover with a rehearsed fallback.
- **Presentation:** Explain the problem early, label prior runs and evidence sources, rehearse handoffs and finish within the confirmed allocation.
