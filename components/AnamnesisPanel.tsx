import type { AnamnesisReport } from "../lib/engine/index.ts";
import { downloadJson } from "./download.ts";
import { Progress } from "./Progress.tsx";
import styles from "./AnamnesisPanel.module.css";

export type AnamnesisState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; report: AnamnesisReport };

export function AnamnesisPanel({ state, onRetry }: { state: AnamnesisState; onRetry: () => void }) {
  if (state.status === "idle") return <p className={styles.muted}>Ask the patient a question to create an anamnesis.</p>;
  if (state.status === "loading") return <Progress title="Drafting your anamnesis" seconds={10} stages={["Collecting what the patient disclosed", "Sorting findings into sections", "Writing the clinical note"]} />;
  if (state.status === "error") return <div className={styles.danger} role="alert"><p>The anamnesis could not be created. {state.message}</p><button type="button" onClick={onRetry}>Try again</button></div>;
  if (state.status !== "ready") return null;
  const { report } = state;
  const completeness = Math.max(0, Math.min(100, Math.round(report.completeness)));
  return <div className={styles.report}>
    {report.redFlagsMissed.length > 0 && <div className={styles.danger}><strong>Red flags still to explore · {report.redFlagsMissed.length}</strong><ul>{report.redFlagsMissed.map(f => <li key={f.factId}>{f.label}</li>)}</ul></div>}
    <div className={styles.top}>
      <div className={styles.ring} role="img" aria-label={`${completeness}% documentation completeness`}>
        <svg viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="44" className={styles.track} /><circle cx="52" cy="52" r="44" className={styles.value} strokeDasharray={`${completeness * 2.7646} 276.46`} transform="rotate(-90 52 52)" /></svg><strong>{completeness}%</strong>
      </div>
      <div><strong>Documentation completeness</strong><p className={styles.muted}>Case facts documented from disclosed items.</p><span className={styles.mode}>OpenAI draft</span></div>
    </div>
    <div className={styles.sections}>{report.sections.map(section => <section key={section.section}>
      <h4>{section.title}</h4>
      {section.documented.length > 0 && <ul className={styles.documented}>{section.documented.map(f => <li key={f.factId}>{f.text}</li>)}</ul>}
      {section.missing.length > 0 && <div className={styles.missing}><strong>Missing</strong><ul>{section.missing.map(f => <li key={f.factId} className={f.redFlag ? styles.redFlag : undefined}>{f.label}{f.redFlag && " · Red flag"}</li>)}</ul></div>}
      {!section.documented.length && !section.missing.length && <p className={styles.muted}>No case facts in this section.</p>}
    </section>)}</div>
    <div><h4>Drafted note</h4><p className={styles.note}>{report.note}</p></div>
    <button type="button" className={styles.export} onClick={() => downloadJson(report.fhirLike, "medbot-anamnesis-fhir-like.json")}>Export (FHIR-like JSON)</button>
    <p className={styles.muted}>Educational draft. FHIR-like export, not a validated FHIR resource.</p>
  </div>;
}
