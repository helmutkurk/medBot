import { loadLatestEval, loadLatestVoice, wilson } from "../../lib/server/eval.ts";
import type { EvalEvidence, EvalMetrics, Proportion } from "../../lib/server/eval.ts";
import { SiteHeader } from "../../components/SiteHeader.tsx";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const percent = (value: number | undefined, fraction = true) => value === undefined ? "—" : `${(value * (fraction ? 100 : 1)).toFixed(0)}%`;
const count = (value: number | undefined) => value === undefined ? "—" : value.toFixed(0);
const ms = (value: number | undefined) => value === undefined ? "—" : `${value.toFixed(0)} ms`;
/** "21/24 (88%, 95% CI 69–96%)" with the Wilson interval; no interval when n = 0. */
function proportion({ x, n }: Proportion): string {
  const ci = wilson(x, n);
  return ci ? `${x}/${n} (${pct(ci.p)}, 95% CI ${(ci.low * 100).toFixed(0)}–${pct(ci.high)})` : "—";
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function headline(e: EvalEvidence): string {
  const m = e.metrics;
  const personalities = e.personalitiesPerCase === 1 ? "1 personality" : `${e.personalitiesPerCase} personalities`;
  const scope = e.personalitiesPerCase ? `${plural(e.caseCount, "patient")} × ${personalities}` : plural(e.caseCount, "patient");
  const parts = [`${e.n} simulated interviews across ${scope}`];
  const facts = m.invented === undefined ? "invented facts not measured" : `${count(m.invented)} invented ${m.invented === 1 ? "fact" : "facts"}`;
  const contradictions = m.contradictions === undefined ? "contradictions not measured" : `${count(m.contradictions)} ${m.contradictions === 1 ? "contradiction" : "contradictions"}`;
  const personality = e.recognised.n ? `personality recognised in ${proportion(e.recognised)}` : "personality recognition not measured";
  return `${parts[0]}: ${facts}, ${contradictions}, ${personality}.`;
}

interface Tile { label: string; value: string; meaning: string; detail?: string }
function tiles(e: EvalEvidence): Tile[] {
  const m: EvalMetrics = e.metrics;
  return [
    { label: "Invented facts", value: count(m.invented), meaning: "Things the patient said that are not in the medical case. Lower is better; the target is zero." },
    { label: "Contradictions", value: count(m.contradictions), meaning: "Answers that conflict with the case or with an earlier answer. The target is zero." },
    { label: "Unprompted disclosures", value: count(m.unpromptedDisclosures), meaning: "Facts volunteered before the student asked. Real patients reveal what is asked, no more." },
    { label: "Medical jargon", value: count(m.jargonHits), meaning: "Replies that used clinical terms a lay patient would not know." },
    { label: "Out of character", value: count(m.outOfCharacter), meaning: "Replies that broke the assigned personality, such as an anxious patient staying calm." },
    { label: "Personality recognised", value: e.recognised.n ? pct(e.recognised.x / e.recognised.n) : "—", detail: e.recognised.n ? proportion(e.recognised) : undefined, meaning: "How often a blind judge, who sees only the transcript, names the right personality. Target: at least 80%." },
    { label: "Reply latency p50", value: ms(m.latencyP50Ms), meaning: "Median time to a complete text reply (text only; voice is separate)." },
    { label: "Reply latency p95", value: ms(m.latencyP95Ms), meaning: "Slowest 5% of replies take at least this long." },
    { label: "Fact coverage", value: percent(m.factCoverage), meaning: "Share of the case facts that the student managed to elicit within the interview." },
    { label: "Coach score", value: m.coachScore === undefined ? "—" : `${m.coachScore.toFixed(0)}/100`, meaning: "Average score the feedback coach gave the student's communication." },
    { label: "Anamnesis completeness", value: percent(m.anamnesisCompleteness, false), meaning: "How complete the student's generated history note is versus what was disclosed." },
  ];
}

export default async function EvalPage() {
  const [evidence, voice] = await Promise.all([loadLatestEval(), loadLatestVoice()]);
  return <>
    <SiteHeader current="evidence" />
    <main className={styles.main}>
      <div className={styles.intro}><span className={styles.eyebrow}>Beyond one lucky demo</span><h1>Interview evidence.</h1>
        {evidence ? <p className={styles.headline}>{headline(evidence)}</p> : <p>The latest evaluation, across cases and personalities.</p>}</div>
      {!evidence ? <section className={styles.card}><h2>No evaluation available yet</h2><p>Run the evaluation harness to create a report in <code>eval/results/</code>, then reload this page.</p><pre>npm run eval -- --n 3</pre><p>Set OPENAI_API_KEY before running the evaluation.</p></section> : <>
        <section className={styles.card} aria-label="Run information">
          <div className={styles.runHeading}><h2>Latest complete run</h2><span className={styles.mode}>{evidence.mode}</span></div>
          <dl className={styles.metadata}>
            <div><dt>Run timestamp</dt><dd>{evidence.timestamp ? <time dateTime={evidence.timestamp}>{new Date(evidence.timestamp).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time> : "Unavailable"}</dd></div>
            <div><dt>Interviews</dt><dd>{evidence.n}{evidence.failed ? ` (+${evidence.failed} failed)` : ""}</dd></div>
            <div><dt>n per case × personality</dt><dd>{evidence.nPerPair ?? "Unavailable"}</dd></div>
            <div><dt>Questions per interview</dt><dd>{evidence.turns ?? "Unavailable"}</dd></div>
            <div><dt>Patient model</dt><dd>{evidence.patientModel ?? "Unavailable"}</dd></div>
            <div><dt>Judge / guard model</dt><dd>{evidence.textModel ?? "Unavailable"}</dd></div>
          </dl>
          <p className={styles.muted}>Source: {evidence.filename}</p>
        </section>
        <section className={styles.tiles} aria-label="Aggregate metrics">{tiles(evidence).map(tile => <div key={tile.label} className={styles.tile}><strong>{tile.value}</strong><span className={styles.tileLabel}>{tile.label}</span>{tile.detail && <span className={styles.meaning}>{tile.detail}</span>}<span className={styles.meaning}>{tile.meaning}</span></div>)}</section>
        <section className={styles.card}><h2>Clean interviews</h2>
          <p className={styles.big}>{proportion(evidence.clean)}</p>
          <p className={styles.muted}>Interviews with no invented fact, no contradiction and no unprompted disclosure. Interval: Wilson, 95%, descriptive only — interviews of the same four cases are not fully independent.</p></section>
        <section className={styles.card}><h2>Case × personality</h2><p className={styles.muted}>Counts are totals; coverage, coach and completeness are means. “Recognised” and “Clean” are interviews out of n with Wilson 95% intervals; with few interviews per cell the intervals are wide. Missing measurements appear as —.</p>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Evaluation results, scroll horizontally for all metrics"><table><caption className="sr-only">Evaluation grouped by case, personality and mode</caption>
            <thead><tr><th scope="col">Case / personality</th><th scope="col">n</th><th scope="col">Clean interviews</th><th scope="col">Recognised</th><th scope="col">Invented</th><th scope="col">Contradictions</th><th scope="col">Unprompted</th><th scope="col">Jargon</th><th scope="col">Out of character</th><th scope="col">Latency p50</th><th scope="col">Latency p95</th><th scope="col">Fact coverage</th><th scope="col">Coach</th><th scope="col">Anamnesis</th></tr></thead>
            <tbody>{evidence.groups.map(g => <tr key={`${g.caseId}/${g.personalityId}/${g.mode}`}><th scope="row">{g.caseId}<span>{g.personalityId}</span></th><td>{g.n}</td><td>{proportion(g.clean)}</td><td>{proportion(g.recognised)}</td><td>{count(g.metrics.invented)}</td><td>{count(g.metrics.contradictions)}</td><td>{count(g.metrics.unpromptedDisclosures)}</td><td>{count(g.metrics.jargonHits)}</td><td>{count(g.metrics.outOfCharacter)}</td><td>{ms(g.metrics.latencyP50Ms)}</td><td>{ms(g.metrics.latencyP95Ms)}</td><td>{percent(g.metrics.factCoverage)}</td><td>{g.metrics.coachScore === undefined ? "—" : g.metrics.coachScore.toFixed(0)}</td><td>{percent(g.metrics.anamnesisCompleteness, false)}</td></tr>)}</tbody></table></div>
          {!evidence.groups.length && <p className={styles.muted}>Per-interview results are unavailable in this report.</p>}
        </section>
        {voice && <section className={styles.card} aria-label="Voice benchmark"><h2>Voice</h2>
          <div className={styles.voiceRow}>
            <div className={styles.voiceStat}><strong>{ms(voice.firstAudioP50Ms)}</strong><span>First audio p50</span></div>
            <div className={styles.voiceStat}><strong>{ms(voice.firstAudioP95Ms)}</strong><span>First audio p95</span></div>
            <div className={styles.voiceStat}><strong>{voice.guardCounts.invented} / {voice.guardCounts.contradiction} / {voice.guardCounts.unprompted}</strong><span>Invented / contradiction / unprompted ({voice.guardedMessages} audited replies)</span></div>
          </div>
          <p className={styles.muted}>Latest voice benchmark{voice.timestamp ? <> from <time dateTime={voice.timestamp}>{new Date(voice.timestamp).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time></> : ""}, {voice.turns} spoken answers{voice.model ? `, model ${voice.model}` : ""}. First audio is the delay from the end of the question to the first sound of the answer. Guard counts are automated.</p></section>}
        <section className={styles.card}><h2>How we test</h2>
          <ol className={styles.steps}>
            <li>An AI medical student asks the patient {evidence.turns ?? "up to 12"} questions, following up on the answers.</li>
            <li>An independent guard checks every patient reply against the medical case for invented facts, contradictions and unrequested disclosures.</li>
            <li>A blind judge reads only the transcript and guesses the patient's personality.</li>
          </ol>
          <p className={styles.muted}><strong>Limits:</strong> students, guard and judge are automated models, not clinicians or people; the guard can miss problems. Cases are synthetic and few. There are {evidence.nPerPair ?? "only a few"} interviews per case × personality, so intervals are wide and numbers can move between runs.</p></section>
        <p className={styles.footnote}>Patient latency measures the engine request to the complete text reply, as recorded by the harness; it excludes the student and guard requests and is not voice onset latency. Reload to see a newer run.</p>
      </>}
    </main>
  </>;
}
