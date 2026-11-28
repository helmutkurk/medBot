import { loadUsage } from "../../lib/server/usage.ts";
import type { UsageTotals } from "../../lib/server/usage.ts";
import { SiteHeader } from "../../components/SiteHeader.tsx";
import styles from "../eval/page.module.css";
import usageStyles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const money = (value: number) => `$${value.toFixed(6)}`;
const count = (value: number) => value.toLocaleString("en-US");

function Breakdown({ title, rows }: { title: string; rows: (UsageTotals & { label: string; unknownModel?: boolean })[] }) {
  return <section className={styles.card}><h2>{title}</h2><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={title}>
    <table><caption className="sr-only">{title}</caption><thead><tr><th scope="col">{title === "By operation" ? "Operation" : "Model"}</th><th scope="col">Calls</th><th scope="col">Input</th><th scope="col">Output</th><th scope="col">Est. USD</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}{row.unknownModel && <span>Unknown price · excluded from cost</span>}</th><td>{count(row.calls)}</td><td>{count(row.inputTokens)}</td><td>{count(row.outputTokens)}</td><td>{money(row.costUsd)}</td></tr>)}</tbody>
    </table></div></section>;
}

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ source?: string | string[] }> }) {
  const { source: query } = await searchParams;
  const source = query === "app" || query === "eval" ? query : undefined;
  const usage = await loadUsage(source);
  return <>
    <SiteHeader />
    <main className={styles.main}>
      <div className={styles.intro}><span className={styles.eyebrow}>Every call counts</span><h1>API usage.</h1><p>Watch token usage and estimated spend across interviews and evaluations.</p></div>
      <nav className={usageStyles.filters} aria-label="Usage source">{[{ label: "All calls", href: "/usage", value: undefined }, { label: "App", href: "/usage?source=app", value: "app" }, { label: "Eval", href: "/usage?source=eval", value: "eval" }].map(filter => <a key={filter.label} href={filter.href} aria-current={source === filter.value ? "page" : undefined}>{filter.label}</a>)}</nav>
      <p className={styles.muted}><a href="/eval">Back to evidence</a></p>
      <p className={styles.footnote}>Costs are estimates, not a billing statement or spending cap. Unknown models show $0 and are excluded from estimated spend. Calls without reported usage show zero tokens; browser delivery failures and unreported transcription usage can leave totals incomplete. Reload for updates.</p>
      {!usage.totals.calls ? <section className={styles.card}><h2>No usage recorded yet</h2><p>Start an interview or run an evaluation, then reload this page to see API usage{source ? ` from ${source}` : ""}.</p></section> : <>
        <section className={styles.tiles} aria-label="Usage totals">{[
          { label: "Calls", value: count(usage.totals.calls) }, { label: "Input tokens", value: count(usage.totals.inputTokens) },
          { label: "Output tokens", value: count(usage.totals.outputTokens) }, { label: "Estimated spend · USD", value: money(usage.totals.costUsd) },
        ].map(tile => <div key={tile.label} className={styles.tile}><strong>{tile.value}</strong><span>{tile.label}</span></div>)}</section>
        <p className={styles.muted}>Since {usage.since && <time dateTime={usage.since}>{new Date(usage.since).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time>}</p>
        <div className={usageStyles.breakdowns}><Breakdown title="By operation" rows={usage.byOperation.map(row => ({ ...row, label: row.operation }))} /><Breakdown title="By model" rows={usage.byModel.map(row => ({ ...row, label: row.model }))} /></div>
        <section className={styles.card}><h2>Recent calls</h2><p className={styles.muted}>Last 50 records, newest first. Reasoning is included in output; cached tokens are included in input.</p>
          <ol className={usageStyles.recent}>{usage.recent.map((trace, index) => <li key={`${trace.ts}-${index}`}>
            <div><strong>{trace.operation}</strong> <span className={styles.mode}>{trace.status}</span><p className={styles.muted}>{trace.model} · {trace.source}{trace.route ? ` · ${trace.route}` : ""}</p><p className={styles.muted}>{trace.caseId}{trace.personalityId ? ` / ${trace.personalityId}` : ""}</p>
              <time className={styles.muted} dateTime={trace.ts}>{new Date(trace.ts).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time></div>
            <div className={usageStyles.numbers}><strong>{money(trace.costUsd)}</strong><p>{count(trace.inputTokens)} in · {count(trace.outputTokens)} out</p><p className={styles.muted}>{count(trace.cachedTokens ?? 0)} cached · {count(trace.reasoningTokens ?? 0)} reasoning</p><p className={styles.muted}>{Math.round(trace.latencyMs)} ms{trace.errorCode ? ` · ${trace.errorCode}` : ""}</p>
              {trace.unknownModel && <p className={styles.warning}>Unknown model price</p>}{trace.usageMissing && <p className={styles.muted}>Usage not reported</p>}</div>
          </li>)}</ol>
        </section>
      </>}
    </main>
  </>;
}
