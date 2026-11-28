# Statistical reporting and evidence binding

Author: Codex, 2026-11-28. Use when reporting personality accuracy, clean-interview proportions, before/after changes or pitch numbers. Treat the examples as arithmetic demonstrations, never measured project results.

## Define the unit and denominator

- Use interviews for binary outcomes such as “correct personality label” or “at least one audited invention.” Record successes `x`, completed eligible interviews `n` and failed/incomplete attempts separately. For operational completion, use all attempted interviews as the denominator.
- Keep guard issue counts distinct from numbers of affected turns or interviews. A single reply can contain multiple issues; summing issues is not a binomial numerator. Define the detection/audit process and deduplication rule.
- Keep total fact-ID coverage separate from independently verified proposition coverage and requested-fact retrieval. Define requested-fact retrieval as correctly answered permitted propositions divided by answerable propositions actually requested; report unauthored requests separately.
- Preserve case × personality × repetition IDs. Turns within an interview and repeats of four fixed cases are correlated; they are not a large sample of independent clinical cases. Report per-cell counts and missing observations.

## Wilson score interval for a binary proportion

For `n > 0`, `0 ≤ x ≤ n`, set `p = x/n`. For a nominal two-sided 95% interval, use `z = 1.959964`:

```text
d      = 1 + z²/n
centre = (p + z²/(2n)) / d
half   = z/d × sqrt(p(1-p)/n + z²/(4n²))
lower  = centre - half
upper  = centre + half
```

Return no estimate for `n = 0`. Do not apply this interval to continuous coverage means, arbitrary issue counts or latency percentiles. Its usual interpretation assumes independent Bernoulli observations; label it descriptive when repeated cases undermine that assumption.

Worked example: `x = 32` correct labels out of `n = 40` interviews gives `p = 0.80`, `d ≈ 1.0960`, `centre ≈ 0.7737`, `half ≈ 0.1213`, hence approximately **65.2%–89.5%**. Write “32/40 (80%; descriptive Wilson 95% interval 65.2%–89.5%)” with the repeated-case limitation. Do not interpret this as a 95% probability that the true accuracy lies in that specific interval.

With zero observed failures in 40 independent interviews, the Wilson failure-rate interval is approximately **0%–8.8%**. Zero observed failures does not establish a zero underlying failure rate, especially with a fallible judge or narrow case set.

## Paired before/after rule

1. Freeze the case/personality set, question suite, repeats, turn limit, model IDs, supported settings and scoring rubric. Pair units by case ID × personality ID × suite ID × repetition index. Pairing comparable workloads does not make model randomness deterministic.
2. Change one intended factor where practical. If changing a case, map stable clinical propositions across versions; publish changed denominators and native coverage as well as the matched comparison. Do not present fact splitting as a performance gain by itself.
3. Run baseline and candidate with the same `--n 3` minimum. Keep unique JSON artifacts; do not overwrite baseline summaries. Counterbalance version order where feasible and record timing/batch effects. If using a stochastic LLM student, disclose that questions differ; use the fixed suite for a controlled question-matched comparison.
4. Compute per-pair changes and show per-cell results. For binary outcomes show the four paired counts: both pass, baseline-only pass, candidate-only pass, both fail. For coverage show paired percentage-point changes and all failures. For latency compare raw durations under matching workloads; do not average p95 values.
5. Apply the repo gate to observed evidence: block added inventions, contradictions, raised disclosure issues or reduced coverage. Report unchanged failures explicitly. A small, noisy improvement is not proof of superiority, and a passing exit code is not the whole gate.
6. If formal inference is justified, choose the method before seeing outcomes. Use paired methods for matched data (for example, exact McNemar for independent binary pairs). Respect clustering: resample whole independent case units with their repeats for case-level inference, or explicitly limit inference to these fixed cases. Four case clusters provide very weak generalisation; do not report precise significance from many correlated turns. Do not use a turn-level bootstrap to manufacture a large independent sample.
7. Record effect sizes, intervals, assumptions and sample-size limits. Choose a meaningful effect size before power planning; `n = 3` is an operational minimum, not a power calculation. Keep ≥5 repetitions per case/personality as the separate pre-freeze project goal.

## Evidence table template

Bind each public number to a real immutable run artifact or rating record. Replace placeholders only after inspecting it; omit an unsupported claim from the pitch.

| Pitch wording | Numerator / denominator or units | Run / rating artifact | Exact field or derivation | Version / models | Limits / review status |
| --- | --- | --- | --- | --- | --- |
| “N evaluated interviews” | Completed and attempted counts separately | `eval/results/<timestamp>.json` | `aggregate.runs`; failures recorded separately | Commit + dirty diff/hash; `patientModel`, `textModel` | Selected case set, incomplete runs |
| “Zero guard-detected inventions in N completed interviews” | Sum of issues; state interviews and patient turns | `eval/results/<timestamp>.json` | `aggregate.invented`; sum `runs[].transcript` patient messages for turns | Same | Guard is fallible; label independent audit extent separately |
| “X% personality recognition” | Correct interviews / completed classified interviews | `eval/results/<timestamp>.json` + rating artifact if human | `runs[].personalityCorrect`; `aggregate.personalityAccuracy` | Same | Wilson interval, confusion matrix, automated/human distinction |
| “Y% mean coverage” | Mean of per-interview ID fractions | `eval/results/<timestamp>.json` | `aggregate.factCoverage`; compare `runs[].revealedFactIds` with transcript | Same | Self-reported IDs; bundled facts, per-cell results |
| “Median text patient latency Y ms” | Individual complete patient-response durations | `eval/results/<timestamp>.json` | Pool `runs[].latenciesMs`; `aggregate.latencyP50Ms` | Same | Engine text completion; not voice or eval-cycle time |
| “Median voice onset Y ms” | Speech-stopped → first audio event durations | Separate live voice measurement artifact | List events, duration calculation and sample count | Realtime model, voice, device/network | Event proxy, separate from audible onset; not in text eval JSON |

Template paths above are placeholders, not evidence. Link the real files in the final report and retain their hashes when files are local/gitignored. Supplement the current harness output with hashes, scoring records and failure records as needed; do not imply those metadata are already emitted. Do not quote external benchmark scores as evidence that this simulator works.

## Sources

Reproducibility/reporting: [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `mllm-eval`, `check-reporting`, `model-assessment`; paired design, effect sizes, uncertainty and evidence binding: [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `experimental-design`, `statistical-analysis`, `statistical-power`, `scientific-visualization`, `scientific-writing`, via supplied research notes. Wilson formula and examples are general statistical knowledge, not claimed as verified suite features. Text is original, not copied.
