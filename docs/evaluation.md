# Evaluation

Author: Codex, 2026-11-28.

Run from the repository root with Node 26. No SDK or test dependency is needed.

```sh
node --test tests/
node scripts/eval.ts --mock --n 1
node scripts/eval.ts --mock --n 3 --turns 20 --case chest-tightness-01
node scripts/eval.ts --mock --n 1 --md eval/summary.md   # also writes the table for the pitch
node --env-file=.env.local scripts/eval.ts --n 3 --turns 20
node --env-file=.env.local scripts/eval.ts --case abdominal-pain-01 --personality anxious --n 3
```

The last two commands assume the team's local environment file already contains
`OPENAI_API_KEY`; an exported environment variable works too. The script reads the
process environment, never opens that file itself. Without a key, or with `--mock`,
the entire run is offline. `--n` defaults to 3 interviews **per case/personality**;
`--turns` defaults to 12. Filters match internal case/personality ids. Invalid or
empty filters fail. Live runs use `gpt-5-mini` for the student, patient and judges.

Each live interview starts with a fresh transcript. A simulated student asks one
structured-history question at a time, the patient answers, and a guard judges
each answer against the case and prior history. A separate blind request guesses
the personality from the transcript and candidate labels/styles; the actual
label and opening/example lines are withheld. Candidate order is rotated.

`--md <path>` additionally writes the Markdown summary table (mode line plus table) to that file.

The command prints a Markdown table and writes full transcripts, per-turn guard
results, disclosed/missed fact ids, latency samples, per-run metrics and totals
to `eval/results/<ISO timestamp>.json`. These generated reports are local
artifacts, not case fixtures. A live run exits 1 if any invented-fact or
contradiction issue is found. Request failures also exit 1, never fall back to
mock silently, and do not produce a success report. Other quality issues remain
visible in the report without failing the process.

## Metrics and their limits

| Metric | Definition |
| --- | --- |
| Fact coverage | Unique valid ids in the patient's `revealed` output / case facts; aggregated as the mean run coverage. Self-reported, so inspect transcript evidence. |
| Coach score | `coachReport` history-completeness score (0-100) for the transcript, computed from revealed fact ids; the live model only adds wording, so it equals coverage. |
| Unasked | Count of guard issues for facts disclosed without a matching question. |
| Invented / conflict | Guard issues for unsupported medical facts / contradictions with case or prior answers. |
| Jargon | Count of jargon guard issues, including deterministic dictionary matches. |
| Role | Count of out-of-character guard issues. |
| Patient p50 / p95 | Nearest-rank percentiles over complete `patientTurn` latency in milliseconds; pooled samples for the total. Includes network, retries and parsing. |
| Evaluation cycle | Student-question generation through patient and guard completion. Excludes the final personality judge. |
| Personality accuracy | Correct blind personality guesses / interviews. Compare against chance (50% for the supplied two-personality cases). |

The mock uses a fixed question list and simple lexical disclosure matching. Its
personality classification uses wording heuristics, not a blind model judge.
Mock zero invention/contradiction counts mean **not checked**, not verified safe.
The 12-turn default may leave facts uncovered; 20 turns exercises more history
topics. Repeated mock interviews are identical except for measured timing.

Live judging is also fallible and not independent clinical validation: patient
and judge use the same model family, and label accuracy can reflect superficial
wording. Voice emotion and audio timing are not evaluated by this text harness.

## Evidence for the judges

Use multiple live interviews for every case/personality, not just a selected
transcript. Show the complete table, missed facts and individual flagged replies.
For the same clinical fact, play or read two personalities side by side. Include
questions about unknown details, repeated facts, leading false suggestions,
rudeness and requests to reveal private instructions in a manual session. Check
that the patient stays uncertain about missing details and only discloses when
asked. Keep representative failed runs alongside fixes and rerun all variants.

Pair text reports with a recorded or live voice interview showing tool disclosure
events and speech-end-to-first-audio latency. A human should inspect transcripts
against fact truth and disclosure conditions; coverage and model judges alone
cannot establish clinical correctness.
