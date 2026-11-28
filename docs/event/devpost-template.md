# Submission draft — medBot

Codex, 2026-11-28. **Verify against live form:** confirm the 2026 platform, field names, length limits, eligibility, prior-code/AI disclosures and pitch allocation. This is a filled content draft, not a submitted entry. Public links/media and the authorized public roster still need verification; do not invent them.

## Project name

medBot

## Tagline

Interview a synthetic patient. Reflect on what you missed. Practise it with the next one.

## Challenge and audience

Avelios “VIP – Virtual Interview Patient”, hackaTUM 2026. For medical students practising English history-taking, communication and documentation with synthetic patients.

## Inspiration

A calm voice can conceal an important symptom. Good history-taking means asking for the right facts, understanding the person and documenting what was actually learned. We wanted each practice interview to lead to a concrete improvement in the next one. medBot connects simulation, reflection, coaching and repeat practice in one guided flow.

## What it does

Students select a synthetic case and personality, then interview the patient by English voice or text. Contrasting personalities share the same case facts. Disclosure triggers guide when facts emerge; a background consistency guard checks replies. The checklist stays hidden during practice, with an explicit Instructor view for inspecting disclosure and guard observations.

After interviewing, students record their main concern and confidence before feedback. A viva asks them to explain their reasoning before unlocking detailed answers. A Calgary-Cambridge communication coach supports ratings with transcript quotes, identifies missed patient cues when evidenced and suggests better questions. Annotated transcript replay connects disclosure, guard observations and coaching to conversation turns. A structured anamnesis shows documented/missing items and exports educational FHIR-like JSON; the session record can also be downloaded.

The learning page uses local history to recommend the next patient, track confidence calibration and schedule spaced reviews of missed red flags. Students can generate a synthetic patient for selected weak domains. XP, levels, streaks, badges and an optional fictional-nickname leaderboard make progress visible. Practice offers Socratic hints with an XP cost. OSCE station mode adds reading time and a timed interview; red-flag sprint mode focuses on safety concerns under time pressure.

PWA support and hosted-mode passcode access with usage controls support delivery. AI interviews still require OpenAI/network. The Evidence page presents repeated evaluation, case × personality breakdowns and descriptive Wilson confidence intervals, with separate voice evidence.

## How we built it

Next.js, React, strict TypeScript and Node 26, using OpenAI throughout the product. WebRTC voice uses `gpt-realtime` and ephemeral browser credentials; text patients use `gpt-5-mini`. Structured cases supply shared instructions and atomic fact IDs. Disclosure tools track coverage; a parallel asynchronous guard checks replies without blocking spoken audio.

Disclosed IDs determine documentation membership/completeness; OpenAI drafts report/note wording. Learner summaries and gamification live in browser storage; the optional leaderboard uses shared server state. API traces store metadata rather than prompts/response text; `/usage` exposes estimated consumption. Hosted limits have deployment/storage caveats and do not replace provider billing controls. CI and `npm run check` cover strict types, offline fetch-stubbed tests and production build. No product mock mode.

## Challenges we ran into

Consistency, selective disclosure and personality can pull in different directions. An expressive patient must preserve medical facts; answering one question should not reveal the whole checklist. We split facts/disclosure triggers, evaluated repeated interviews and kept failures visible.

A partial paired text-model test detected **8 invented facts with gpt-4.1-mini versus 0 with gpt-5-mini**. We chose consistency. Unequal completion (12 versus 9 interviews) limits the comparison. Sources: [mini partial](../../eval/results/2026-11-28T00-47-27.431Z.partial.jsonl), [5-mini partial](../../eval/results/2026-11-28T00-47-27.451Z.partial.jsonl); model assignment/decision in [next-steps](../next-steps.md) and [decisions](../decisions.md). These historical zeroes are separate from v4 below.

Voice needs separate measurement: received audio is different from hearing a reply after microphone turn detection. Benchmark first-audio latency, browser “Voice felt” and complete text-response latency remain separate metrics.

## Accomplishments and evidence

We built the path from structured case to spoken interview, reflection/viva, quoted feedback, documentation and adaptive next practice. Evidence is scoped to recorded cases/configurations, not every current library case.

| Artifact | Result | Interpretation |
| --- | --- | --- |
| Text v4: [summary](../../eval/summary.md), [raw report](../../eval/results/2026-11-28T02-42-28.926Z.json), [acceptance log](../overnight-progress.md) | n=3 planned across 8 cells, 12 turns; **22 completed, 2 failed**; **4 unprompted**, **91% persona recognised**, **9.5% unknown answers**, complete text reply **p50 2.9 s**. | Automated guard/blind transcript persona judging. Unknown-answer share is the supplied v4 analysis recorded with acceptance status, not a medical-error rate. |
| Text v4 guard audit | **1 invented fact, 1 contradiction after discarding guard placeholders**. | Raw summary/aggregate is **2 / 2**. Abdominal-pain/anxious run 3 contains one invented and one contradiction issue with detail `None`; exclude those two empty placeholders. Retain the two substantive detections. Not a zero-error text result. |
| Voice v2: [chest](../../eval/voice/2026-11-28T08-11-14.188Z-11e42da1/report.md), [abdomen](../../eval/voice/2026-11-28T08-12-20.307Z-91de1143/report.md), [dizziness](../../eval/voice/2026-11-28T08-13-08.347Z-1205e267/report.md), [headache](../../eval/voice/2026-11-28T08-14-19.409Z-6b3cc933/report.md) | **48 turns over 8 personalities**, six each; cell first-audio **p50 358–543 ms**; **0 invented, 0 contradictions, 3 unprompted** detected. | Text request → first received audio delta; excludes microphone/VAD and headset playback. One conversation per cell; descriptive cell medians, not a pooled interval/human voice-quality rating. |
| Final n=5 per case × personality | **[pending final eval]** | Artifact, completed/failed, coverage, inventions/contradictions/unprompted, persona/Wilson intervals and latency: **[pending final eval]**. Never substitute targets or failed runs for results. |

Eval artifacts remain local/gitignored and may not resolve in a public repository. Before submission, attach a reviewed synthetic-only evidence bundle through the authorized submission workflow, retain source identifiers and verify public links. `/eval` selects the latest usable run, skipping files with no completed interviews; verify its source before calling it v4. Zero completed interviews cannot establish clean performance.

## What we learned

Naturalness, consistency, requested-fact retrieval and coaching need separate checks. Completion is not an error-free result. Automated guard counts/persona labels are fallible; repeated interviews of the same cases are correlated, so Wilson intervals are descriptive. We have not established clinical validity, coach agreement with independent human raters or improved learning outcomes. Schema-valid generated cases need medical review. FHIR-like export is educational, not validated interoperability.

Existing products/research offer related simulation and coaching. Our focus is the combined loop of controlled disclosure, personalities, transparent repeated evaluation, adaptive practice and structured documentation. The [competitor review, sections 3–4](../research/competitors.md#3-steal-list-top-12-ranked) informed this focus; it establishes neither exclusive features nor head-to-head superiority.

## What's next

Finish final repeats and fixed requested-fact probes; calibrate guard/coach against independent human ratings; measure voice turn-taking and interruption with real playback; obtain clinical review of synthetic cases; evaluate learning outcomes. With Avelios, explore mapping the educational anamnesis to validated structured documentation. Real hospital integration and real-patient imports are not built.

## Built with

Next.js · React · TypeScript · Node.js · OpenAI Responses API · OpenAI Realtime API · WebRTC · Web Audio · PWA

Hosting target: Vercel, per [decisions](../decisions.md); deployment status/URL require verification.

## Links, media and access

- **Repository:** pending verified public URL.
- **Live demo:** pending verified URL/access instructions; test a fresh session. Keep keys/credentials out of the entry and recordings.
- **Video:** pending verified link, capture and full audio/playback check. Follow the [demo script](demo-script.md); label earlier rehearsals/recorded footage.
- **Screenshot captions:** “Same facts, different person”; “Reflect and explain before the answer key”; “Quoted coaching and annotated replay”; “Next patient and spaced red-flag review”; “Evidence with sample sizes and uncertainty”. Capture real UI/progress.
- **Team / credits:** authorized submitter supplies the approved public roster in the live form. Disclose AI assistance as required. Documentation: Codex, 2026-11-28.

## Data, licenses and submission

Synthetic cases only; no real patient records or personal profiles of real people, including judges. OpenAI processes interview content. Learner summaries/reflections are browser-local; exports can contain synthetic transcripts; the optional leaderboard publishes a fictional nickname and scores. Call traces are metadata only. Educational prototype, not clinical advice.

Verify repository license, dependency notices, case provenance and live challenge rules. No unapproved quotes or implied sponsor endorsement. Verify final links/receipt before marking submitted. Team plan, Berlin: feature freeze Sat 28 November 18:00; candidate Sun 29 November 08:00; submission before Sun 29 November 10:00, subject to current organizer instructions. Submission time/receipt: **pending**.
