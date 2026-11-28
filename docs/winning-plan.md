# Winning plan (branch feat/Helmut)

Author: Helmut with Claude, 2026-11-28. Complements docs/roadmap.md (timeline) with the "why we win" story.

## What the judges want to hear
Avelios builds a hospital information system: treatment-process-oriented, fully structured data, used by
university hospitals (LMU Munich, MHH) and Sana. Their deck asks for naturalness, medical consistency,
personality, selective disclosure and proof "beyond one lucky demo run". So our story has three beats:

1. **It feels like a real patient** (live voice, two personalities of the same disease, emotion, lay words).
2. **It is medically trustworthy, and we can prove it** (disclosure tool, consistency guard, eval numbers over
   many runs, not one demo). Recent literature names reproducible evaluation as the open problem for LLM
   virtual patients; we ship an evaluation harness and show its table.
3. **It fits Avelios' world** (structured data in, structured data out): cases are structured records, and
   every interview ends as a structured anamnesis the student can compare with the ground truth, the same
   documentation step a clinician performs in a HIS.

## hackaTUM jury criteria (organisers, 2026-11-28)
Innovation/ambition, UI/UX, overall quality (works start to finish, no bugs on stage, critical feature works,
good scoping) and presentation quality. Mapping of each criterion to our feature and on-stage proof:
[next-steps.md](next-steps.md#what-the-jury-scores-all-must-be-visibly-met).

## Differentiators to build (priority order)
1. **Structured anamnesis + documentation feedback.** After the interview, the system drafts the anamnesis
   from what was actually disclosed (HPI, past history, medication, allergies, family, social), marks gaps
   against the case truth and exports it as JSON with FHIR-like section names. Avelios-specific hook.
2. **Evidence page `/eval`.** Shows the latest eval run: coverage, invented facts, contradictions,
   unprompted disclosures, jargon, latency p50/p95, personality distinctness. Judges see numbers live.
3. **Case creator.** Diagnosis + setting + personality → a validated synthetic case in seconds
   (`validateCase` gate), playable immediately. Shows scale: one case file, unlimited patients.
4. **Clinically meaningful demo cases.** Beyond chest tightness and appendicitis:
   - *Multimorbid elderly patient with polypharmacy* (dizziness and a fall after a new tablet, diabetes,
     several medicines): the literature gap, and daily reality in Avelios' hospitals.
   - *Red-flag headache* (sudden worst-ever headache hidden behind a calm personality): shows that safety-
     critical facts come out only to the student who asks the right question.
   Same disease, two personalities stays the core demo moment.
5. **Coach** (done): covered vs missed with quotes and suggested questions.

Not doing: personal data about judges or anyone real. All cases stay synthetic.

## Demo script (3 minutes)
1. 0:00 Problem: students get few standardized-patient hours; actors are expensive and inconsistent.
2. 0:20 Live: interview Frank (Downplaying) by voice for ~60 s; facts panel fills only when asked.
3. 1:20 Switch to Anxious Frank, same question: different person, same facts.
4. 1:45 End → coach + structured anamnesis with gaps.
5. 2:10 `/eval`: "N interviews, 0 invented facts, X % personality recognition, median latency Y".
6. 2:35 Case creator: type a diagnosis, new patient in seconds. Close: "structured case in, structured
   anamnesis out, built for hospitals that run on structured data."
Backup: recorded video of steps 2–4, text-mode fallback.

## Quality bar before the freeze (Sat 18:00)
- Live voice works with headset; median latency under ~1.2 s.
- Eval n ≥ 5 per case × personality: 0 invented facts and contradictions, personality accuracy ≥ 80 %.
- `npm run check` green on every merge; main always demoable.
