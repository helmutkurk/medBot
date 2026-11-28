---
name: patient-evaluation
description: Use when modifying the interview harness, judging patient behaviour, comparing prompt or case versions, or preparing demo numbers; require calibrated, traceable evidence beyond a lucky run.
---

# Patient evaluation

Author: Codex, 2026-11-28.

Produce an evaluation report with transcript evidence, failures, denominators, uncertainty and artifact links. Keep factuality, disclosure, naturalness and personality separate so a safety failure cannot disappear inside an average.

## Define the comparison

Read `AGENTS.md`, `scripts/eval.ts`, relevant cases, `lib/case/prompt.ts`, and the engine patient/guard paths. Read [probe-suite.md](references/probe-suite.md) for fixed adversarial probes and judge controls; read [stats.md](references/stats.md) before comparing versions or quoting numbers.

Record the tested commit and dirty-diff identity, case/prompt hashes, patient/text/voice model IDs as applicable, exact questions or student prompt, turn limit, repeats, context/memo policy, generation settings actually sent and unavailable settings. Do not claim a seed or temperature was fixed when the adapter does not send it. Keep raw transcripts and rating records with the run artifacts.

Use matched case × personality × question-suite × repetition units for before/after comparisons. State the hypothesis and decision rule before running. Keep a held-out probe set to reduce tuning to the demo. If fact splitting changes coverage denominators, create a stable proposition mapping and report both measures.

## Audit assertions independently

For each patient assertion, record the case support, whether it contradicts truth, whether the question permitted it and the exact patient turn. Compare both directions: spoken facts missing from `revealed`, and returned IDs with no spoken support. Give partial bundled facts only proposition-level credit; the patient-returned ID alone is not proof of full disclosure.

Correct false premises contradicted by authored facts. Express uncertainty about genuinely unknown or unauthored facts; do not agree with a suggested measurement or fabricate a denial. Score requested-fact retrieval separately from total interview coverage so student omissions and patient failures remain distinguishable.

Treat the runtime guard as a fallible detector, not an independent gold standard. The current harness derives invented/conflict/unprompted counts from guard issues and coverage from patient-returned IDs. Label those automated metrics and independently audit a subset before stronger claims. Audit the coach and anamnesis against actual disclosed propositions and transcript quotes, including free-text notes.

## Calibrate and blind the ratings

1. Run the labelled invention, contradiction, over-disclosure, uncertainty and clean controls in the probe reference. Record expected versus detected labels and false alarms. If controls are missed, fix or qualify the judge before accepting its scores.
2. Score factuality and disclosure with explicit failures. Rate naturalness separately with anchored examples (scripted/evasive, partly natural, responsive everyday speech); record evidence for each rating. Use `patient-performance` for audio anchors.
3. Hide the true personality label, balance classes and retain existing candidate rotation. Add tests without stock opening lines/catchphrases and a same-voice voice comparison. Publish the confusion matrix and per-class counts, not just aggregate accuracy.
4. Obtain independent human ratings on a defined, blinded subset; adjudicate disagreements against the case and permission table. Record actual ratings before calculating agreement. If no human subset exists, say so; never manufacture kappa, ICC or clinician approval.

## Run and gate

- Run `npm run check` for authorized code changes. Run `npm run eval -- --n 3` before and after case/prompt changes; use matching settings and put before/after numbers in the PR. Check `/usage?source=eval` against the capped key before and after; keep calls traced. Never inspect or print environment-file contents.
- Use `--case`, `--personality`, `--turns` and `--md` only as supported in the current harness. Do not claim the fixed probes are automated by that command: the present harness uses an LLM student. Run a separately implemented/authorized probe driver or annotate exported transcripts and mark unrun probes pending.
- Preserve failures and incomplete attempts. The current CLI may stop before writing a report if a call fails; record that attempt separately instead of treating absent artifacts as a clean run.
- Block merging any prompt/case change that adds invented facts or lowers coverage. Also block added contradictions and disclosure regressions under the roadmap's no-raised-issues rule. Inspect affected cells and failure examples, not only pooled averages. Do not claim a passing merge gate merely from exit code: current eval exits nonzero for inventions/contradictions, but does not enforce every comparison rule.
- Keep `--n 3` as the required comparison baseline; aim for ≥5 repetitions per case/personality before freeze per `docs/winning-plan.md`. Treat ≥80% blind recognition as a project target with uncertainty, not proof from selected examples.
- Evaluate voice separately outside browser-restricted sandboxes. The text harness establishes neither emotional voice delivery nor the roughly 1.2-second voice-onset target.

## Report

Return per-cell and aggregate counts, explicit denominators, uncertainty where applicable, observed defects and adjudication evidence. Link every pitch number to its actual `eval/results/*.json` field or rating artifact using the evidence table in `stats.md`. Say “zero observed inventions in this evaluated sample” with the detector/audit limits; do not claim universal absence of hallucinations or clinical validation. Keep missing measurements visible.

## Sources

Derived via supplied research notes: [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `mllm-eval`, `design-ai-benchmarking`, `check-reporting`, `model-assessment`; [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `statistical-power`, `statistical-analysis`, `experimental-design`, `scientific-critical-thinking`, `scientific-writing`. External skill text is not independently audited here. Text is original, not copied. Wilson intervals are general statistical knowledge, not a verified feature of either suite.
