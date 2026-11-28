# Demo script — same facts, different person

Codex, 2026-11-28. Operational companion to the [timed pitch](pitch-template.md). All cases and utterances are synthetic. Expected replies are semantic acceptance checks, not canned output. Rehearsal and backup readiness are **unverified** until the team completes the checks below.

## Roles and preparation

| Role | Responsibility | Handoff cue |
| --- | --- | --- |
| Presenter | Pitch, patient questions, clock; announces prior runs and fallbacks. | “Same facts, different person”; “Earlier rehearsal”; “Text mode”; “Recorded run”. |
| Driver | Case selection, start/end, reflection/viva, tabs and evidence card. Only one active microphone session. | Acts on presenter cue; avoids talking over patient audio. |
| Backup operator | Verifies local video/audio, cues playback, watches failure deadlines. | Signals failed checkpoint; plays video on “Recorded run”. |

Assign roles before rehearsal; driver and backup may be combined. Older proposed rosters do not establish assignments.

1. Use the tested deployment or `http://localhost:3000` with an already configured server (`npm run dev` if needed). Never display keys, environment files, account identifiers or real personal data. Unlock hosted-mode passcode access off screen and test a fresh session. Presentation URL/access: **pending verification**.
2. Use a headset; verify audience audio and microphone permission on HTTPS/localhost. Check `/api/health` readiness and `/usage` budget off screen. Text still requires OpenAI/network; a local recording is the network-independent fallback.
3. Tab A: `/?case=thunderclap-headache&personality=calm-engineer`. Confirm **Sudden severe headache**, **Calm engineer**, **Practice**, Instructor view off, empty transcript, no active interview.
4. Tab B: `/?case=thunderclap-headache&personality=irritable`. Confirm **Irritable**, **Practice**, Instructor view off, empty transcript. Start its voice only after ending A. Prewarmed credentials may expire.
5. Tab C: complete the authentic rehearsal path below, including reflection, reports and viva. Keep **Detailed + replay** open. Label the presentation **Earlier rehearsal — same synthetic case** and announce it. Never seed feedback or learner history. Reloading loses the in-memory interview.
6. Prepare separate `/learning`, [evidence card](pitch-template.md#evidence-card-and-claim-boundaries), and `/eval` tabs; keep C untouched. Check timestamp, models, completed/failed counts and source filename. Newer local eval files have zero completed interviews; `/eval` skips those and selects the latest usable run. Zero issue counts in failed artifacts do not establish clean behaviour. Use the v4 card for historical claims. `/eval` also loads only the latest voice bench, not all four v2 reports together.
7. Backup file: **pending local path**. Duration/cue points, playback, audio routing and switch time: **pending verification**. Record the real flow including voice, personality contrast, reflection/viva, reports/replay and learning. Benchmark audio clips alone are not the complete backup.

## Main click path and exact utterances

Follow the pitch clock. Wait for each answer before speaking. If output differs materially, acknowledge what happened; a checked fact alone does not prove the spoken answer was correct.

| Pitch time | Driver click path | Utterance / acceptance check |
| --- | --- | --- |
| 0:00–0:20 | A, **Practice**. Manual selection: **Choose another patient** → **Sudden severe headache** → **Calm engineer**. Click **Start voice interview with Daniel**, wait for **Listening**. | Deliver pitch hook/problem. If selected case differs, reselect rather than improvising a new case. |
| 0:20–0:53 | A. After opening answer, check **Instructor view**. It exposes all teaching facts; checks mark disclosure. | **“What brings you here today?”** → severe headache, without the entire history. **“Did it come on suddenly or gradually?”** → sudden, maximum within one minute (`time_to_peak`). **“How bad is the pain now, out of ten?”** → nine (`current_severity`). Calm delivery must preserve severity. After reply, click orb **End interview**. |
| 0:53–1:15 | Fresh B → **Start voice interview with Daniel** → **Listening**. | “A fresh interview, same facts, different person.” **“How bad is the pain now, out of ten?”** → nine, with clipped/impatient delivery. No inherited checks/history. **End interview**. |
| 1:15–1:30 | B → **Pause before feedback** → **Main clinical concern:** `Severe headache; onset and associated red flags still need exploration.` → **Confidence (1–5): 2** → **Save reflection and see feedback**. | Reports start after this submit. Show **Viva · Explain your reasoning** when coach is ready; its question is generated. The short second interview does not establish a diagnosis. |
| 1:30–1:50 | C → **Detailed + replay** → **Calgary-Cambridge communication** → **Missed patient cues** → **Annotated replay**. | “Here is an earlier rehearsal of this same case, with the viva completed.” Show an actual quoted cue/suggested response if present. If none: “This run identified no missed cues.” Replay is an annotated transcript, not audio playback. C's report is not B's. |
| 1:50–2:10 | Switch to prepared **Your learning** tab (focus refreshes progress); preserve C. Show **Next patient**, **Spaced safety review**, level/XP, streak/badges. Point to **Create a patient for my weak spots**. | Explain recommendations and scheduled red flags using actual browser progress. No due reviews: show future dates. Zero streak: describe the daily goal to build. Never seed multi-day progress or promise a specific recommendation. |
| 2:10–2:45 | Source-labelled card; optionally prepared **Evidence** (`/eval`) tab → metadata, **Personality recognised**, **Clean interviews**, Wilson 95% intervals. | Use the pitch's v4/v2 claims. If another run is shown: “The card is v4; this page loads the latest usable run.” Label adjusted 1/1 separately from raw 2/2. |
| 2:45–3:00 | C → **Anamnesis** → missing items, **Export (FHIR-like JSON)**. Hold screen for close. | “Structured case in, structured anamnesis out.” Educational FHIR-like export; no validated interoperability claim. |

## Prepare the authentic completed rehearsal

Outside the pitch, use Practice → headache → Calm engineer → start voice. Ask the opening, onset-speed and current-severity questions above, then:

1. **“What concerns you most?”** Hear the actual concern, then return to **“How bad was it when it started?”** Expected onset severity: ten, distinct from nine now. This offers a possible missed empathy cue; the coach may identify none.
2. **“What were you doing when it started?”** → lifting weights. **“Has your neck felt stiff?”** → new stiffness. Leave other topics unasked so genuine gaps remain.
3. **End interview** → reflection `Sudden severe headache; I need to explore further red flags and respond to the patient's concern.` → Confidence **2** → **Save reflection and see feedback**. Wait for coach and anamnesis.
4. Read the generated viva question and answer it from the actual interview. If it asks for differential/reasoning, rehearsal answer: `The sudden severe headache raises concern for a secondary cause, including subarachnoid haemorrhage. Migraine is another possibility, but the abrupt peak needs further assessment. I have not completed the associated-symptom history and cannot confirm a diagnosis.` Adapt to the actual question; never promise a score. **Submit viva answer**; wait for grading.
5. After viva success, **Detailed + replay**. Confirm quotes, missing facts, communication ratings, actual missed-cue output, replay and anamnesis. If viva fails, details remain locked; use verified footage rather than claiming success.
6. Wait for reports before **Download session record**. Check **Export (FHIR-like JSON)**: unasked items remain missing, with no invented test results or normal examinations. Keep C open; use a separate learning tab.

## Optional extensions, outside 3:00

- **Unknown fact:** Fresh headache interview → **“What did the CT scan show today?”** Expected uncertainty, no invented result/new fact ID. One success does not prove universal consistency.
- **Socratic hint:** Active Practice → **Hint · −5 XP**. Read actual nudge; it should guide a question rather than reveal the answer. Hint use is recorded.
- **Creator:** Home → **New patient**, or Your learning → **Create a patient for my weak spots** → **Diagnosis:** `Migraine`; **Setting:** `Emergency department`; **Personality hints:** `Reserved versus very talkative` → **Create patient**. Wait for schema validation/selection. No guaranteed generation time or clinical correctness.
- **OSCE station:** Fresh home → **OSCE station** → start voice/text. Full 60-second reading phase, then eight-minute interview; no hints or instructor checklist. Do not start it in the main pitch.
- **Red-flag sprint:** Fresh home → **Red-flag sprint** → start. Three-minute interview, no hints; time bonus requires finding all red flags.
- **Review/motivation:** Your learning → **Start daily review** / **Open daily review**; show actual due state. **Weekly leaderboard** is opt-in with a fictional nickname only; no real person's name.
- **PWA/hosting:** Demonstrate installation only if verified on the device. PWA assets do not provide offline AI interviews. Hosted mode provides shared-passcode access, signed cookies and usage controls, with deployment/storage caveats; it is not enterprise identity or a guaranteed hard provider spend cap.

## Fallback cues

| Failure / checkpoint | Presenter says | Driver / backup action |
| --- | --- | --- |
| Mic denied/disconnect; app switches to text | “I am switching to OpenAI text mode.” | Verify text status, then type same next question in **Ask your patient a question…**, Enter. Confirm retained transcript. |
| Slow connection exposes control | “We will continue by text.” | **Continue in text** closes voice and retains history. Type next question. Typing while voice remains connected still uses Realtime, not the text patient. |
| Silent connected session without recovery control | “I am starting a fresh text interview.” | End/close stuck voice. Fresh tab at same case/personality URL → **Interview by text** → opening question. Announce reset; no implied history continuity. |
| No usable answer by 0:53/1:15, or network/API failure | “We are switching to a recorded run.” | Play verified local video at matching beat, visibly labelled **Recorded run**. Rehearse switch under 10 seconds; keep original endpoint, cut extra narration. No cached-response product mode. |
| Reports/viva slow at 1:30 | “Here is an earlier rehearsal of this same case, with the viva completed.” | C as planned. If lost, use verified real footage. If neither exists: “The detailed report is unavailable”; move to learning/evidence. |
| Evidence route unavailable/different run | “These results are from the labelled v4 text run and separate v2 voice bench.” | Use verified artifact card; omit numbers if provenance cannot be established. Final n=5: **[pending final eval]**. |

## Reset and rehearsal record

1. End active voice. If saving a completed run, finish reflection/viva and reports before **Download session record**. Never leave another tab's microphone active.
2. Reload explicit A/B URL for a clean interview: Practice, correct personality, empty transcript, zero checks, no old reports/warnings, Instructor view off. Reload discards the interview; download first if needed.
3. In-app alternative after reports finish: **Repeat with “Irritable” personality** → start. Selectors can be locked during active interview, reflection and report loading. The timed demo uses fresh tabs to avoid that wait.
4. Preserve real learning progress across rehearsals. For an intentionally fresh demo, first **Your learning → Export learning JSON**, then **Reset learning progress** (also resets gamification). Only do this when intending to discard that browser's progress. Never fabricate dates/streaks.
5. Rebuild C if reloaded; restore A/B, media, audio and evidence sources. Complete two full timed rehearsals, including waits and recovery: **run 1 duration/result: pending; run 2: pending; backup playback/switch: pending**. Confirm actual pitch allocation before declaring ready.
