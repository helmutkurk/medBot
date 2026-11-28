# Case grounding research (Codex, 2026-11-28)

Final report of the evidence-grounding task. Drafts were not saved (sandbox write denied); rerun with the brief in this file's appendix and writable_roots for the scratch path, or write directly to a branch copy.

1. Blocked: the requested destination is read-only; no files were saved.
2. Prepared four revised case drafts in session memory.
3. Fact counts: chest 33; abdomen, dizziness and headache 40 each.
4. All four passed `validateCase` in memory.
5. Drafted `SOURCES.md` with dated URLs, evidence tables, changes and open questions.
6. Preserved pregnancy-test uncertainty, consistent with [NICE guidance](https://www.nice.org.uk/guidance/ng126/chapter/Symptoms-and-signs-of-ectopic-pregnancy-and-initial-assessment).
7. Revised medication wording, timelines, personality examples and voice pairs.
8. No repository edits, environment-file reads, commits or competing eval runs.
9. A closing hash check detected concurrent changes to `abdominal-pain.json`; reconciliation is needed.
10. Saving the drafts and validator requires writable access or authorization for the proposed alternate path.

## Appendix: brief
```
Repo /home/hks/Projects/hackatum. Read AGENTS.md and FOLLOW .claude/skills/clinical-case-design/ and .claude/skills/patient-performance/ (with references). Read cases/*.json, lib/case/types.ts, lib/case/validate.ts, lib/case/prompt.ts. Do not read .env.local, do not commit. Write ONLY to /home/hks/.cache/claude-tmp/claude-1000/-home-hks-Projects-hackatum/afe9bc99-7df1-41e2-9cc5-687bd2f3769a/scratchpad/cases-v3/ (copies of the 4 case files + SOURCES.md); do not edit cases/ (eval running).

Goal: ground all 4 synthetic cases in real, public clinical evidence so a German hospital-IT vendor's clinical judges find them authentic. Patients stay fictional (no real patient data, no real people).
Research with network (cite URLs with access date in SOURCES.md, per case): German AWMF S3/S2k guidelines and NICE/ESC where applicable — chest pain / stable vs unstable angina (NVL Chronische KHK, ESC 2024 CCS), acute abdominal pain/appendicitis in young women incl. pregnancy exclusion, falls/syncope/orthostatic hypotension in older adults on anticoagulation (ESC syncope 2018, DEGAM, NICE NG232 head injury), thunderclap headache/SAH (DGN Leitlinie, NICE). Extract: typical presentation and timeline, red flags, typical comorbidities/risk factors, realistic medication regimens with doses and German generic names as patients would say them (e.g. "Ramipril five milligrams in the morning"), realistic home BP/glucose values a patient might know, social context typical in Germany (Hausarzt referral, Notaufnahme, Pflegedienst, Rente), and what a patient would plausibly NOT know.
Then revise the cases: make each fact consistent with the evidence, adjust truth/lay where implausible, add missing evidence-typical patient-knowable items (keep atomic facts; keep existing ids when the proposition stays; total facts per case <= 40), make lay wording sound like a real person (contractions, vague time anchors like "after the Tagesschau" only if natural in English; keep speech in English), and make example lines more human. Pick Realtime voices per personality among supported ones favouring the most natural (marin, cedar, plus others) so the two personalities of a case clearly differ.
Validate all 4 with validateCase via a small script in /home/hks/.cache/claude-tmp/claude-1000/-home-hks-Projects-hackatum/afe9bc99-7df1-41e2-9cc5-687bd2f3769a/scratchpad. In SOURCES.md: per case, the evidence table (claim → source), changes made, and open questions. Report a 10-line summary.
```
