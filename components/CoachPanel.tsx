import type { CoachReport } from "../lib/engine/index.ts";
import { communicationSkills } from "../lib/case/types.ts";
import { domainLabels } from "../lib/engine/learner.ts";
import { Progress } from "./Progress.tsx";
import styles from "./CoachPanel.module.css";

export type CoachState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; report: CoachReport };

function ScoreRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return <div className={styles.ring} role="img" aria-label={`Score ${value} out of 100`}>
    <svg viewBox="0 0 104 104" width="104" height="104" aria-hidden="true">
      <circle cx="52" cy="52" r={radius} className={styles.ringTrack} />
      <circle cx="52" cy="52" r={radius} className={styles.ringValue} strokeDasharray={`${(value / 100) * circumference} ${circumference}`} transform="rotate(-90 52 52)" />
    </svg>
    <strong>{value}</strong>
  </div>;
}

export function CoachPanel({ state, onRetry, hasMessages }: { state: CoachState; onRetry: () => void; hasMessages: boolean }) {
  if (state.status === "idle") return <p className={styles.note}>{hasMessages ? "The coach report will appear here." : "Ask the patient at least one question to receive coaching feedback."}</p>;
  if (state.status === "loading") return <Progress title="Your coach is reviewing the interview" seconds={12} stages={["Reading your transcript", "Matching your questions to the case checklist", "Rating communication skills", "Writing personal feedback"]} />;
  if (state.status === "error") return <div className={styles.error} role="alert"><p>The coach report could not be created. {state.message}</p><button type="button" onClick={onRetry}>Try again</button></div>;
  const { report } = state;
  return <div className={styles.report}>
    <div className={styles.top}>
      <ScoreRing score={report.score} />
      <div className={styles.coverage}>
        <h3>Coverage by topic</h3>
        <ul>{report.coverage.map(row => <li key={row.category}>
          <span className={styles.cat}>{row.category}</span>
          <progress value={row.found} max={Math.max(1, row.total)} aria-label={`${row.category}: ${row.found} of ${row.total}`} />
          <span className={styles.num}>{row.found}/{row.total}</span>
        </li>)}</ul>
      </div>
    </div>
    {(report.strengths.length > 0 || report.improvements.length > 0) && <div className={styles.columns}>
      {report.strengths.length > 0 && <div><h3>Strengths</h3><ul className={styles.plain}>{report.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
      {report.improvements.length > 0 && <div><h3>To improve</h3><ul className={styles.plain}>{report.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
    </div>}
    <section><h3>Calgary-Cambridge communication</h3><ul className={styles.facts}>{communicationSkills.map(skill => {
      const rating = report.communication[skill];
      return <li key={skill}><strong>{domainLabels[skill]} · {rating.score}/2</strong>{rating.evidence ? <q>{rating.evidence}</q> : <span>Not demonstrated in the transcript.</span>}<span>Next time: {rating.tip}</span></li>;
    })}</ul></section>
    <div className={styles.columns}>
      <div><h3>Covered ({report.covered.length})</h3>{report.covered.length ? <ul className={styles.facts}>{report.covered.map(f => <li key={f.factId}><strong>{f.label}</strong>{f.quote && <q>{f.quote}</q>}</li>)}</ul> : <p className={styles.note}>Nothing covered yet.</p>}</div>
      <div><h3>Missed ({report.missed.length})</h3>{report.missed.length ? <ul className={styles.facts}>{report.missed.map(f => <li key={f.factId}><strong>{f.label}</strong><span>Try: “{f.suggestedQuestion}”</span></li>)}</ul> : <p className={styles.note}>You covered every fact.</p>}</div>
    </div>
  </div>;
}
