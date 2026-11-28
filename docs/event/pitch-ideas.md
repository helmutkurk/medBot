# Pitch ideas and action notes (medBot, hackaTUM 2026)

Claude, 2026-11-28, from the team brainstorm. Inputs: [next-steps.md](../next-steps.md) (jury criteria),
[winning-plan.md](../winning-plan.md), [overnight-plan.md](../overnight-plan.md), [decisions.md](../decisions.md),
[pitch-template.md](pitch-template.md). Numbers below are placeholders until the final eval run exists; do not
read them aloud before they are bound to an artifact.

Open items before the morning merge: allotted pitch time (confirm with organisers); whether the "ChatGPT Health"
item in the brainstorm means a competitor to position against or a model to test (unclear, see section 7);
`docs/research/competitors.md` does not exist yet (overnight stream B).

## 1. Sponsor conversation plan (Avelios mentors, Saturday)

Goal: rapport, their feedback on the realism and consistency criteria, and quotes we may use. Mentors are on site
all weekend (public challenge brief, [challenge.md](../challenge.md)).

Questions to ask (open, one per turn; let them talk):
1. Which student mistakes do you see most in documentation, and which of them could a patient simulator train?
2. What would make a virtual patient feel wrong to a clinician within the first minute?
3. How do you treat disclosure: when should a patient volunteer a fact, and when only after a direct question?
4. Which structured fields does your HIS require that a student anamnesis usually misses?
5. What do you expect as evidence that the patient is consistent over a 15-minute interview?
6. Would a structured anamnesis export (JSON with FHIR-like section names) be useful to you, or noise? What would
   a validated export need?
7. Which of our current differentiators (case creator, `/eval`, gap view) is least convincing to you?
8. Would you accept a 3-minute live demo with a backup video? What do judges usually check first?

What to validate (we do not claim these until they say so):
- Their definition of "medical consistency" matches our guard (zero invented facts, no contradictions).
- The structured anamnesis step is relevant to their HIS workflow.
- Their view on our text-versus-voice split and on the latency target (about 1.2 s is our target, not a result).

How to capture quotes for the pitch:
- Ask before quoting: "May we quote this sentence on a slide, with your role and organisation?" Write it down
  only after a yes.
- Write the quote verbatim with time and context in one line; mark "paraphrase" if it is not verbatim.
- Use the organisation and role only if they agree; no personal contact details in any file.
- Store quotes in the team notes, not in the repo, until the presenter confirms the wording with the mentor.
- A mentor's comment is an opinion; label it as such on the slide.

## 2. Demo format decision matrix

| Option | Strength | Risk | Use |
| --- | --- | --- | --- |
| Live voice (headset) | Shows real-time turn-taking, the strongest proof of "feels like a patient" | Wi-Fi, API latency spikes, mic noise in the room, headset failure | Primary |
| Text-mode live | Reliable, same cases and coach | Weakens the voice claim | Announced fallback only |
| Recorded video only | No live failure risk, controlled timing | Judges see a recording, lower trust in "real" | Backup, never primary |
| Hybrid: live voice, backup video ready | Live proof, recovery path is rehearsed | Two paths to rehearse; switching costs seconds | Recommended |

Recommendation: live voice with a backup video of steps 2 to 4 of the demo script, and a stated text-mode fallback.
Rules from [pitch-template.md](pitch-template.md): do not wait through a broken voice connection; say which
fallback we use; never read placeholders aloud. The recording must be verified (played end to end on the demo
laptop) before it counts as a backup.

Checks before choosing: one full run on the demo network and on the phone hotspot; headset test in a noisy room;
time the switch to the backup (target: under 10 s).

## 3. Real-user evidence plan (today, before 18:00)

Goal: a quick, honest signal from 3 to 5 fellow students, not a statistic.

Protocol:
1. Ask for a 2-minute consent statement before the session: "We record only your rating and one optional quote.
   No name, no recording is stored." Stop if they decline.
2. The student runs one case (the red-flag headache or chest case) in voice or text, 5 minutes.
3. Immediately after: three ratings on a 1 to 5 scale: realism of the patient, clarity of the feedback, would you
   use it again. One optional free-text quote.
4. Store only: date, case id, the three ratings, the quote if consented, and "student, medicine, year n" if they
   agree. Do not store names, Discord handles, photos, audio or the interview transcript.
5. Note any bug or dead end they hit; these go to the overnight progress log, not the pitch.

Evidence owner (see section 6) keeps a single table: date | case | realism | clarity | reuse | consented quote.
Report it as "n = 4 students, one session each, informal" unless the count is larger.

## 4. Pitch story hooks mapped to the jury criteria

| Criterion (next-steps.md) | Hook or line | Proof on stage |
| --- | --- | --- |
| Innovation / ambition | "Not a chatbot: an adaptive tutor. It picks the next patient from what you missed." | Learning page, generated case |
| UI / UX | "One flow: pick a patient, talk, reflect, get feedback, next patient." | Live run without dead ends |
| Overall quality | "Same facts, two people: the test is whether the patient stays consistent." | Two personalities side by side, guard counts |
| Presentation | "Problem in 20 seconds, then the interview, then the numbers." | Timed rehearsal, under 3:00 |
| Avelios: naturalness and latency | "Voice first; first audio in about 0.4 s in our bench, end-to-end felt delay still measured." | Voice bench table, dated |
| Avelios: consistency | "Zero guard-detected invented facts in N interviews; the guard is fallible." | `/eval` with Wilson intervals |
| Avelios: selective disclosure | "Facts come out only when the student asks the right question." | Reveal toggle in the instructor view |
| Avelios: personality | "Same disease, different person." | Maya and Daniel pair; blind recognition result |
| Avelios: evidence beyond one run | "Numbers from repeated interviews, not one lucky run." | Eval table with n and cell list |

Lines to avoid: "medically perfect", "undetectable from a real patient", "AI replaces standardised patients",
"validated FHIR export", "clinically proven".

## 5. Roadmap slide items (future, not built for the hackathon)

- Partner / role-play mode: a student plays the doctor, a second student plays the patient with a case card; both
  receive feedback on their own performance. Open question: how strangers join (a Discord voice call is one
  option); needs a privacy and safety review before any real person joins.
- Doctor-sourced cases with consent: clinicians could record or describe real anonymised cases to build more
  realistic patients. Only with informed consent, pseudonymisation, and an ethics approval. Never real data in the
  hackathon; it is a roadmap item, not a demo claim.
- Community: an open case library with review by teachers; contribution guidelines before any contribution opens.
- Leaderboard: opt-in, nickname only, no accounts; we already plan this in the product (see decisions.md). Present it
  as a motivation feature, not a grading tool.
- Learning analytics for students: local by default and opt-in; the learner profile stays on the device.
- HIS integration: structured case in, structured anamnesis out; map sections to FHIR resources only after a
  validation step with Avelios.

## 6. Team task split for the morning merge (proposal)

| Role | Responsibility | Owner |
| --- | --- | --- |
| Presenter | Pitch script, timing, Q&A, quotes | Proposed: Helmut |
| Demo driver | Runs the live flow, switches to fallback | Proposed: one member, not the presenter |
| Backup operator | Plays the backup video or text fallback on command; checks the recording before each run | Proposed: second member |
| Evidence owner | Real-user table, eval links, numbers in the pitch | Proposed: one member |
| Merge owner | Merges `main` into `feat/Helmut` by merge, runs `npm run check` | Helmut |
| Sponsor liaison | Keeps the mentor notes and approved quotes | Proposed: one member |

Owners are proposals until the team confirms them. Morning checklist: merge, `npm run check` green, demo driver
runs the flow twice, backup video checked, quotes confirmed with their owners.

## 7. Risks and honest wording

| Risk | Mitigation | Wording on stage |
| --- | --- | --- |
| Wi-Fi or API failure during the demo | Backup video, text-mode fallback, rehearsed switch | "We are switching to the recorded run." |
| Voice latency above target | Report measured numbers only; keep the latency claim to the bench | "First audio in our bench; felt delay is being measured." |
| Eval not finished by 18:00 | Show the last completed run and say so; no pending numbers aloud | "This run is from [date]; the final run is still in progress." |
| Judges see the text model is slower than voice | Explain the choice: consistency over speed (gpt-5-mini chosen on the paired eval) | "We kept the text model that was more consistent." |
| Over-claiming medical accuracy | Say "guard-detected", "in N interviews", "not clinically validated" | "This is training material, not clinical validation." |
| Real personal data in demos or quotes | Synthetic cases only; quotes with consent; no names in repo | No personal data on slides. |
| "ChatGPT Health" comparison | Unclear what the brainstorm meant; do not compare until defined | Do not mention until the team agrees. |
| Competitor claims without research | Use only verified competitor facts from stream B | Name a competitor only with a source. |

Questions for Helmut (not decided here): the pitch time; whether to show the ChatGPT Health point at all; whether
the real-user session may run today on the public Wi-Fi or only on the hotspot; which quotes may be shown.
