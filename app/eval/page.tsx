import { loadLatestEval } from "../../lib/server/eval.ts";
import type { EvalMetrics } from "../../lib/server/eval.ts";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const percent = (value: number | undefined, fraction = true) => value === undefined ? "—" : `${(value * (fraction ? 100 : 1)).toFixed(0)}%`;
const count = (value: number | undefined) => value === undefined ? "—" : value.toFixed(0);
const latency = (value: number | undefined) => value === undefined ? "—" : `${value.toFixed(1)} ms`;
const tiles: { key: keyof EvalMetrics; label: string; format: (value: number | undefined) => string }[] = [
  { key: "factCoverage", label: "Fact coverage", format: percent },
  { key: "invented", label: "Invented facts", format: count },
  { key: "contradictions", label: "Contradictions", format: count },
  { key: "unpromptedDisclosures", label: "Unprompted disclosures", format: count },
  { key: "jargonHits", label: "Jargon hits", format: count },
  { key: "latencyP50Ms", label: "Patient latency · p50", format: latency },
  { key: "latencyP95Ms", label: "Patient latency · p95", format: latency },
  { key: "personalityAccuracy", label: "Personality distinctness", format: percent },
  { key: "coachScore", label: "Coach score / 100", format: count },
  { key: "anamnesisCompleteness", label: "Anamnesis completeness", format: value => percent(value, false) },
];

export default async function EvalPage() {
  const evidence = await loadLatestEval();
  return <>
    <header className={styles.header}><nav aria-label="Main"><a className={styles.wordmark} href="/">medBot</a><a href="/usage">Usage</a><a href="/">Back to patients</a></nav></header>
    <main className={styles.main}>
      <div className={styles.intro}><span className={styles.eyebrow}>Beyond one lucky demo</span><h1>Interview evidence.</h1><p>The latest evaluation, across cases and personalities.</p></div>
      {!evidence ? <section className={styles.card}><h2>No evaluation available yet</h2><p>Run the evaluation harness to create a report in <code>eval/results/</code>, then reload this page.</p><pre>npm run eval -- --n 3</pre><p>Set OPENAI_API_KEY before running the evaluation.</p></section> : <>
        <section className={styles.card} aria-label="Run information">
          <div className={styles.runHeading}><h2>Latest run</h2><span className={styles.mode}>{evidence.mode}</span></div>
          <dl className={styles.metadata}><div><dt>Run timestamp</dt><dd>{evidence.timestamp ? <time dateTime={evidence.timestamp}>{new Date(evidence.timestamp).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time> : "Unavailable"}</dd></div><div><dt>Interviews</dt><dd>{evidence.n}</dd></div><div><dt>n per case × personality</dt><dd>{evidence.nPerPair ?? "Unavailable"}</dd></div></dl>
          <p className={styles.muted}>Source: {evidence.filename}</p>
        </section>
        <section className={styles.tiles} aria-label="Aggregate metrics">{tiles.map(tile => <div key={tile.key} className={styles.tile}><strong>{tile.format(evidence.metrics[tile.key])}</strong><span>{tile.label}</span></div>)}</section>
        <section className={styles.card}><h2>Case × personality</h2><p className={styles.muted}>Counts are totals; coverage, coach and completeness are means. Personality distinctness is blind-judge label accuracy. Missing measurements appear as —.</p>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Evaluation results, scroll horizontally for all metrics"><table><caption className="sr-only">Evaluation grouped by case, personality and mode</caption><thead><tr><th scope="col">Case / personality</th><th scope="col">Mode</th><th scope="col">n</th>{tiles.map(tile => <th scope="col" key={tile.key}>{tile.label}</th>)}</tr></thead><tbody>{evidence.groups.map(group => <tr key={`${group.caseId}/${group.personalityId}/${group.mode}`}><th scope="row">{group.caseId}<span>{group.personalityId}</span></th><td>{group.mode}</td><td>{group.n}</td>{tiles.map(tile => <td key={tile.key}>{tile.format(group.metrics[tile.key])}</td>)}</tr>)}</tbody></table></div>
          {!evidence.groups.length && <p className={styles.muted}>Per-interview results are unavailable in this report.</p>}
        </section>
        <p className={styles.footnote}>Patient latency measures the engine request to the complete text reply, as recorded by the harness; it excludes the student and guard requests and is not voice onset latency. Anamnesis completeness is shown when included in the report. Reload to see a newer run.</p>
      </>}
    </main>
  </>;
}
