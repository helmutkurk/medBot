# Competitor and prior-art research: AI virtual patients and clinical communication training

Date: 2026-11-28. Method: web search and page fetches on 2026-11-28 (no code downloaded or run).
Legend: **[V]** verified on a page fetched today; **[S]** from a search snippet or third-party summary only; **[U]** unverified, from background knowledge or vendor marketing. Vendor claims are marketing unless a study is cited. Several vendor sites blocked fetches (Geeky Medics returned 403, Oscer returned only a title), so those rows rely on secondary sources.

medBot reference (from README / docs/next-steps.md): voice (OpenAI Realtime, WebRTC) and text patient; two personalities per case; `reveal_when` selective disclosure; background consistency guard; Calgary-Cambridge coach report; structured anamnesis + FHIR-like export; adaptive learner profile with spaced red-flag review; validated case creator; `/eval` page with Wilson CIs and n>=5 per case x personality; synthetic cases only; no stored conversations.

## 1. Products and systems analysed (16)

### Commercial / product

**1. Oscer** - https://oscer.ai (SourceForge listing: https://www.sourceforge.net/software/product/Oscer)
- What: chat with patients of different presentations; timed and scored cases with "real-time, objective diagnostic feedback"; optional hints; scripts and rubrics provided [S].
- Target: medical learners; listing also says hospitals/clinics [S]. Modality: text (voice not confirmed). Gamification: none found.
- Pricing: from $6.99/month on SourceForge; G2 says no pricing provided, so possibly outdated [S]. Evidence: none found. Note the oscer.ai page itself returned only a title ("Free Sign Up").
- UX pattern: hint reveal during a case (cost-free scaffold).

**2. Geeky Medics AI virtual patients** - https://geekymedics.com/category/osce/history-taking/ (fetch blocked); secondary: https://www.iatrox.com/blog/geeky-medics-ukmla-ai-simulator-which-exam-skills-it-tests-that-mcq-banks-miss
- What: type or speak a consultation (history, information-giving, counselling); AI examiner auto-marks and asks post-scenario viva questions [S]. 700+ virtual patients advertised on history-taking page; 800+ rising to 1,300+ on full access per iatroX [S]. Institutions can author scenarios; their docs warn that vague scripts make the AI "fill gaps and make assumptions" [S] (https://support.geekymedics.com/en/article/tips-for-creating-realistic-virtual-patients-1kvjps4/).
- Target: UK students (OSCE, PLAB, UKMLA). Gamification: not found. Pricing: bundles with AI credits, e.g. PLAB GBP 39.99/year with 150 AI credits [S] (https://app.geekymedics.com/purchase/plab-bundle-summary).
- Evidence: none published. Third-party critique: scores are "directional", communication stations only, no timing enforcement [S].

**3. Quesmed OSCE-AI** - https://quesmed.com/osce-ai/ [V]
- What: full OSCE stations vs AI patient by voice or text, with an AI examiner for follow-up questions; defined persona, lay language, vocal cues (pauses, sighs); claims ~900 ms response; 340+ stations (page also says 450+, inconsistent).
- Feedback: station-specific mark scheme, session score, global rating Fail to Excellent, marks scored/missed, strengths and focus areas, "Replay" of sessions, reading time and timed consultations.
- Gamification: daily streak, daily flashcards, progress counter, dashboard. Pricing: GBP 14.99/month, 29.99/6 months, 39.99/year; unlimited attempts, no credits.
- Evidence: "marking validated in a blind study against practising doctors" and "100,000+ students" - no study details (unverified marketing).

**4. Body Interact** - https://bodyinteract.com/virtual-patient-simulator/ , https://wolterskluwer.com/en/solutions/lippincott-medicine/medical-education/body-interact-virtual-patient-care-simulator [S]
- What: 3D virtual patient: dialogue, physical exam, vitals monitoring, test ordering, drugs, physiology-driven deterioration, timer; recent AI assistant ("Sophia") and history taking for consultation scenarios.
- Target: institutions (medical, nursing, PA). Modality: 3D avatar + UI. Pricing: institutional licence (not public). Evidence: vendor claims 500+ institutions, 17+ years; the "global impact study" page is marketing, no outcome data found.
- UX pattern: emergency scenarios where the patient worsens if the learner is slow.

**5. Virti** - https://virti.com/solutions/medical-training [S]
- What: AI role-play platform; AI patient scenarios with per-answer coaching (e.g. prompts about onset, duration, triggers); scores empathy, clarity, confidence; cohort analytics for educators; audit-ready exports (CQC/GMC).
- Target: organisations/NHS trusts. Modality: speak or type, avatar/video. Pricing: enterprise. Evidence: own marketing ("60% find it more effective than face to face"), unverified.

**6. AMBOSS (Assistants beta, MediCoach)** - https://www.amboss.com/us/newsroom/amboss-assistants , https://www.amboss.com/de/medicoach [S]
- What: Clinical Case Simulator for reasoning, "Learn by Teaching" (user explains a topic back to the AI), History Checklist builder, MediCoach (German exam-style questioning chatbot). Not a voice patient. Gamification of AMBOSS not confirmed by search [U]. Pricing: subscription [U].

**7. OSCELab / other OSCE apps** - https://apps.apple.com/us/app/oscelab/id6757703626 [S]: free with in-app purchases, OSCE prep for students; details unverified. Also MedMock (credit-based, GBP 5 taster for 30 credits) and PLABable "OSCE AI Patient" https://plabable.com/news/17726 [S].

### Research systems and open source

**8. MedSimAI** (Cornell/UCSF et al.) - https://arxiv.org/html/2503.05793v2 [V]
- What: instructor-configured AI SP (demographics, history, style, emotion); GPT-4o text, OpenAI Realtime voice, up to 30 min; assessment by 28-item MIRS rubric or custom checklists (SPIKES, SSHADESS), item-level feedback citing the conversation in 2-3 min; Learning Hub with scheduling, past encounters, dashboards by Kalamazoo elements, goal setting, reflections.
- Evidence: 410 learners, 1,024 encounters, 3 sites; Site A OSCE history taking 82.8 to 88.8 (quasi-experimental, d=0.75); Site B no DOCS gain; auto-scoring vs human raters only 32.5% exact, 87% on proficient/not-proficient; voice sessions scored slightly lower than text; SRL features had low engagement without curriculum integration. Very close to our stack (OpenAI Realtime) - the nearest academic analogue.

**9. EasyMED** ("Human or LLM as Standardized Patients?") - https://arxiv.org/html/2511.14783v2 [V]
- What: multi-agent VSP: auxiliary agent maps each question to one of 31 intents that gate disclosure, patient agent phrases the retrieved fact in persona, evaluation agent gives itemised feedback. Text only.
- Evidence: SPBench (58 cases, 3,208 QA pairs, 14 specialties), EasyMED 96.98 vs human SP 97.33 vs GPT-4o 89.54; feedback accuracy 87% (kappa 0.76) on 60 sessions; 4-week crossover with 14 students (small); anxiety 0.5 vs 3.2 with human SPs; ~$0.73 vs ~$53 per session (approximate). Closest to our "selective disclosure + consistency" claim.

**10. Holderried et al., GPT-4 simulated patient with automated feedback** - https://pmc.ncbi.nlm.nih.gov/articles/PMC11364946/ [V]
- What: illness-script patient, 8-minute written history; feedback prompt returns yes/no per history category as JSON, batched 8 per call. 106 students, 1,894 QA pairs: 99.3% of answers plausible and matching; feedback kappa 0.832 vs human rater; 8 categories kappa < 0.6. Model for reporting inter-rater agreement.

**11. Lavigne et al., AI-Standardized Clinical Examination (ASCE), NEJM AI** - https://www.2minutemedicine.com/artificial-intelligence-ai-based-clinical-exam-training-significantly-improved-medical-students-standardized-clinical-exam-performance/ [V, via summary]
- RCT, 251 students, GPT-4 text-based encounters (16) with scored written feedback; OSCE median 11.4 vs 10.7 (p=0.02); higher emotional readiness, lower stress. Strongest outcome evidence found; supports "repeated practice with feedback transfers to OSCE".

**12. LLM virtual patient + tutor agents (Unity/robot)** - https://arxiv.org/html/2508.13943v1 [V]
- Patient agent plus a tutor agent addressed with "@tutor" for hints at any time; browser Whisper (transformers.js); post-session strengths/weaknesses and checklist score. 18 participants rated patient 4.38/5, tutor 4.33/5; Gemini 1.5 Flash 2.07 s response time (our ~0.4 s voice first-audio is much lower).

**13. PatientSim (NeurIPS 2025 D&B spotlight)** - https://github.com/dek924/PatientSim [V]
- Open source persona-driven simulator: 4 axes (personality, language proficiency, recall level, confusion level) = 37 combinations; profiles from MIMIC-ED/IV; persona-fidelity and profile-consistency evaluation scripts; HF Spaces demo; license not stated, 54 stars. Persona axes are a menu of "difficulty knobs" we do not have.

**14. Dartmouth AI Patient Actor** - https://geiselmed.dartmouth.edu/thesen/wp-content/uploads/sites/111/2024/12/Thesen-et-al-2024-AI-Patient-Actor-MSE.pdf [S]: free browser (Streamlit) app, educators upload their own cases; text. Also SOPHIE (serious-illness conversations with automated feedback, arXiv 2505.02694) [S]; Ohio State VSP avatar; CU Anschutz live AI avatars with assignable emotions https://news.cuanschutz.edu/nursing/how-ai-avatars-can-improve-patient-communication [S].

**15. Nova Sonic virtual SP (IWSDS 2026)** - https://aclanthology.org/2026.iwsds-1.16 [V abstract only]: speech-to-speech VSP, 4 cases, 20 third-year students surveyed on realism and learning value; findings not in abstract.

**16. German-language projects** [S]: Universitätsklinikum Würzburg "KIPS" (LLM virtual patient in real time, standardised feedback), IU "KI-Patient:in IPL" (https://www.iu.de/forschung/projekte/ki-patient-ipl/; ~79% of participants preferred AI training to actor role-play, empathy and non-verbal limited) - https://www.zm-online.de/news/detail/hier-trainieren-die-studierenden-arzt-patienten-gespraeche-mit-ki . No Charité/TUM/Heidelberg system surfaced in search; this does not prove none exists.

Also relevant: systematic review of LLM virtual patients for history taking (JMIR 2026) https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12811743/ ; Calgary-Cambridge-based OSCEai study and multicase stability study https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12396829/ ; MedEasy design requirements https://arxiv.org/pdf/2606.17512 [S].
Not found/not verified: SimConverse, Simbie, Doctor's Dilemma, OpenAI consumer health features (searches returned nothing on these names; treat as unverified).

## 2. Feature comparison vs medBot

Y = yes/documented, P = partial, N = not found, ? = unverified. "Product" columns use the evidence above.

| Feature | medBot | Oscer | Geeky Medics | Quesmed | Body Interact | Virti | MedSimAI | EasyMED | Holderried | PatientSim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Real-time voice patient | Y (Realtime) | ? | Y | Y | P (dialogue) | Y | Y | N | N | N |
| Text patient | Y | Y | Y | Y | P | Y | Y | Y | Y | Y |
| Multiple personalities, same facts | Y (2/case) | ? | P (persona text) | P | N | P | Y (instructor sets) | Y | N | Y (37 combos) |
| Selective disclosure rules per fact | Y (`reveal_when`) | ? | ? | ? | ? | ? | ? | Y (31 intents) | P | P |
| Consistency guard at runtime | Y | ? | ? | ? | N | ? | N | P (intent/fact retrieval) | N | offline eval only |
| Communication-framework coach | Y (Calgary-Cambridge) | N | P (domains) | P (mark scheme) | N | P (empathy, clarity) | Y (MIRS, SPIKES) | P | N | N |
| Itemised checklist feedback | Y | P | Y | Y | ? | P | Y | Y | Y | N |
| Structured anamnesis / FHIR-like export | Y | N | N | N | N | N | N | N | N | N |
| Adaptive learner profile | Y | N | N | P (dashboard) | N | P (cohort) | P (hub) | N | N | N |
| Spaced red-flag review | Y | N | N | P (flashcards) | N | N | N | N | N | N |
| AI case creator (validated) | Y | ? | P (institutions author) | N | N | Y (create) | Y (templates) | N | N | N |
| Published evaluation with CIs | Y (`/eval`, Wilson) | N | N | claim only | N | N | Y | Y | Y | Y |
| Mid-session hint/tutor | N | Y (hints) | ? | AI examiner Q&A | ? | Y (coach) | N | N | N | N |
| Session replay / review | P? | N | ? | Y | ? | ? | Y | N | N | N |
| Streak / gamification | N | N | N | Y (streak, flashcards) | N | N | N | N | N | N |
| Time-boxed station mode | N | Y | N | Y | Y (timer) | ? | Y (30 min cap) | N | Y (8 min) | N |
| Institutional/cohort analytics | N | ? | Y (institutions) | N | Y | Y | Y | N | N | N |
| Pricing | n/a | from $6.99/mo [S] | credit bundles | GBP 14.99/mo | institutional | enterprise | research | research | research | free OSS |

Rows for medBot "Session replay" should be checked against the app before claiming; "P?" is an assumption.

## 3. Steal list: top 12 (ranked)

Ranking = judging impact (innovation, UI/UX, quality, presentation, Avelios criteria) weighted by feasibility in under 6 h with Next.js + OpenAI, no new dependencies. Effort estimates are rough.

1. **Inter-rater agreement for the coach (Holderried kappa 0.83; EasyMED kappa 0.76).** Impact: very high (quality, "evidence beyond a lucky run"). Sketch: hand-label 3-5 saved transcripts against the checklist (or have a teammate do it), compute Cohen's kappa and %agreement in a script, show one line on `/eval` ("coach agrees with human rater, kappa X, n items Y"). ~1.5 h.
2. **Honest "what we do not claim" panel plus literature anchor.** Judges reward calibrated claims; cite MedSimAI (auto-scoring only 87% on proficiency threshold), ASCE RCT (251 students, p=0.02) as why this matters. Sketch: one slide plus a short block on `/eval`. ~30 min. Presentation impact high.
3. **Replay with annotated timeline (Quesmed "Replay").** Sketch: after the interview, render the transcript with chips on turns (revealed fact, guard flag, Calgary-Cambridge phase, missed opportunity); data already exists from `reveal_fact` and coach. ~2 h. High UI/UX and demo value.
4. **Missed-cue / empathy-opportunity markers (Virti per-answer coaching; MedSimAI empathy theme 18%).** Sketch: ask the coach to emit `opportunities: [{turn, patientCue, learnerResponse, better}]` in its JSON schema; show 2-3 in the report. ~1 h.
5. **On-demand "tutor" hint ("@tutor", arXiv 2508.13943; Oscer hints).** Sketch: button "Hint" calls a small endpoint that sees only learner-side coverage (not hidden facts) and returns a Socratic nudge ("Have you explored associated symptoms?"); log hints used and discount the score. ~1.5 h.
6. **Persona difficulty knobs (PatientSim axes: recall level, confusion, language proficiency).** Sketch: add optional `difficulty` modifiers (vague historian, tangential, minimises symptoms) appended to the personality prompt; expose as a toggle at case start; add to eval matrix. ~1.5 h but needs eval run (AGENTS.md rule).
7. **Streak and daily 3-card red-flag review (Quesmed streak/flashcards; Duolingo).** Sketch: store streak count and last-review date in localStorage next to the learner profile; `/learning` shows "Today: 3 red flags due" using the existing spaced scheduler. ~1 h. See section 5.
8. **Instructor/cohort summary view (Virti, Body Interact, MedSimAI analytics).** Sketch: aggregate the local learner profile into a "class heat map" of mostly-missed red flags using seeded demo data, labelled as demo data. ~2 h; only if time. Avelios/institution story.
9. **Time-boxed station mode with reading time (Quesmed, Holderried 8 min).** Sketch: optional 8-minute timer with 60 s "reading" screen showing the stem; auto-ends and goes to feedback. ~1 h. Increases realism and demo pace control.
10. **Audit-ready export (Virti CQC/GMC export; our FHIR-like export).** Sketch: single "Download session record" JSON bundling transcript metadata, coverage, guard events, coach scores; no storage. Fits the "no stored conversations" privacy line. ~45 min.
11. **Post-session viva question (Geeky Medics AI examiner).** Sketch: after feedback, one generated question ("What are your top 3 differentials and why?") graded against the case's diagnosis; feeds the learner profile. ~1.5 h.
12. **Cost-per-session and latency tile (EasyMED $0.73 vs $53).** Sketch: compute estimated tokens/audio minutes from `traces/llm.jsonl` metadata, show "approx. cost per interview" on `/eval`; label as estimate. ~45 min. Strong pitch line if the number is measured; do not copy EasyMED's figures.

Suggested slice for the remaining time: 1, 2, 4, 7, 12 (about 4 h), then 3 if time. Avoid 6 and 8 unless eval capacity exists (feature freeze 18:00).

## 4. Differentiation: what medBot does that they do not (honest)

1. **Runtime consistency guard on every turn in both voice and text.** EasyMED gates disclosure by intent/fact retrieval and PatientSim evaluates offline, but no reviewed system documents a parallel guard that flags contradictions or invented facts live. Unverified for closed products (Quesmed, Geeky Medics, Oscer).
2. **Same facts, two personalities, with a blind-judge style evaluation and Wilson CIs on a public page.** Personas exist elsewhere (PatientSim, MedSimAI, EasyMED), but none surfaced a per-case x per-personality, confidence-interval evidence page; MedSimAI/EasyMED report aggregate study results instead. Closed products unverified.
3. **Structured case in, structured anamnesis and FHIR-like record out (Avelios' domain).** No reviewed learning product advertised a structured clinical documentation export from the interview. Unverified for products behind paywalls.
4. **Adaptive learner model that chooses the next patient, schedules red-flag reviews and generates a case for the learner's weak spots.** Quesmed has streak and flashcards; MedSimAI has a goal-setting hub; neither was found to close the loop into case generation. Unverified.
5. **Voice with measured latency (~0.4 s first audio) and published bench numbers, no mock mode, offline-testable.** Quesmed claims 900 ms without evidence; the tutor-agent paper measured ~2 s. We have not run a head-to-head, so this compares claims, not systems.

Honest weaknesses to pre-empt: no outcome study (ASCE and MedSimAI have one); text patient is gpt-5-mini; synthetic cases only; Quesmed/Geeky Medics have hundreds of cases and offline mobile apps; no timed OSCE mode, hints or replay yet; coach reliability vs human raters not yet measured (steal-list item 1).

## 5. Gamification patterns that fit history taking

Duolingo, Anki, Brilliant and AMBOSS details below are background knowledge and were not re-verified today **[U]**; research citations are well-known but should be checked before putting them on a slide.

| Pattern | Used by | Fit for history taking | Learning-science justification |
| --- | --- | --- | --- |
| Spaced repetition scheduling of weak items | Anki, AMBOSS Qbank/Library flashcards, Duolingo practice | Red-flag questions (e.g. "Is this the worst headache of your life?") reviewed at growing intervals, triggered by missed items | Spacing effect and testing effect (Ebbinghaus; Cepeda et al. 2006; Roediger and Karpicke 2006) |
| Daily streak with small daily goal | Duolingo, Quesmed | "3 red-flag reviews today" rather than a long session | Habit formation and distributed practice; risk: extrinsic pressure (Deci and Ryan self-determination theory); offer freeze/rest day |
| Progress rings and mastery levels per skill | Brilliant, Duolingo skill tree, MedSimAI hub by Kalamazoo elements | Per-domain mastery (opening, HPI, red flags, PMH, closing, empathy) from Calgary-Cambridge | Visible competence supports intrinsic motivation; deliberate practice needs specific targets (Ericsson) |
| Immediate, specific feedback with retry | Brilliant, Duolingo | "Try the same patient again" with a different personality and compare scores | Feedback and retrieval practice; transfer across personas builds flexible skill (variability of practice) |
| Adaptive difficulty | Duolingo, Brilliant, PatientSim axes | Vague or guarded patient once red flags are mastered | Zone of proximal development; desirable difficulties (Bjork) |
| Hints with a cost | Oscer, Brilliant | Hint button reduces max score, tracked in profile | Scaffolding that fades; hint use is itself a diagnostic of weak spots |
| Interleaving of cases | Anki decks, Qbanks | Alternate chest pain, headache, abdominal pain cases rather than blocking | Interleaving improves discrimination between similar presentations |
| Reflection prompt after the session | MedSimAI reflections, Learn by Teaching (AMBOSS) | "What would you ask differently?" one-line reflection stored in profile | Metacognition and self-regulated learning; MedSimAI found missed items and flow were the top reflection themes |
| Leaderboards / leagues | Duolingo | Poor fit for novices anxious about speaking; prefer private personal bests or opt-in cohorts | Social comparison can raise anxiety; EasyMED reported lower anxiety when practising with AI than with human SPs, so keep it low-stakes |
| Loss aversion / streak freeze | Duolingo | Use sparingly | Can undermine intrinsic motivation; avoid dark patterns in a medical-education setting |

## 6. Caveats

- Vendor evidence (Quesmed, Virti, Body Interact, Geeky Medics) is marketing only; do not cite their numbers as fact on stage.
- Pricing figures are from pages visible on 2026-11-28 and a Black Friday banner was present on Quesmed; Oscer pricing conflicts between sources.
- Search coverage was limited (standard mode, US-only search); products such as SimConverse, Simbie, Doctor's Dilemma, Shadow Health and OpenAI health features were not located and are not analysed.
- No code was downloaded or run; PatientSim and others were assessed from their GitHub/paper pages only.
