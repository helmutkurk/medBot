import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const metricKeys = ["factCoverage", "invented", "contradictions", "unpromptedDisclosures", "jargonHits", "latencyP50Ms", "latencyP95Ms", "personalityAccuracy", "coachScore", "anamnesisCompleteness"] as const;
type MetricKey = typeof metricKeys[number];
export type EvalMetrics = Partial<Record<MetricKey, number>>;
interface EvalRun { caseId: string; personalityId: string; mode: string; metrics: EvalMetrics; latencies: number[] }
export interface EvalGroup { caseId: string; personalityId: string; mode: string; n: number; metrics: EvalMetrics }
export interface EvalEvidence {
  filename: string; timestamp: string | null; mode: string; n: number; nPerPair: number | null;
  metrics: EvalMetrics; groups: EvalGroup[];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function metrics(value: unknown): EvalMetrics {
  const source = record(value);
  const result: EvalMetrics = {};
  for (const key of metricKeys) {
    const value = number(source[key]);
    if (value !== undefined) result[key] = value;
  }
  return result;
}
function mode(value: unknown): string { return value === "openai" ? value : "unknown"; }
function label(value: unknown): string { return typeof value === "string" && value.trim() ? value : "Unknown"; }
function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
function aggregate(runs: EvalRun[]): EvalMetrics {
  const result: EvalMetrics = {};
  const counts: MetricKey[] = ["invented", "contradictions", "unpromptedDisclosures", "jargonHits"];
  for (const key of metricKeys) {
    const values = runs.map(r => r.metrics[key]).filter((value): value is number => value !== undefined);
    if (values.length === runs.length && values.length) result[key] = values.reduce((a, b) => a + b, 0) / (counts.includes(key) ? 1 : values.length);
  }
  const latencies = runs.flatMap(r => r.latencies);
  if (latencies.length) {
    result.latencyP50Ms = percentile(latencies, 0.5);
    result.latencyP95Ms = percentile(latencies, 0.95);
  } else {
    // Percentiles cannot be reconstructed by averaging per-interview percentiles.
    delete result.latencyP50Ms;
    delete result.latencyP95Ms;
  }
  return result;
}

export async function loadLatestEval(): Promise<EvalEvidence | null> {
  const directory = path.join(process.cwd(), "eval", "results");
  let entries: string[];
  try { entries = (await readdir(directory)).filter(name => name.endsWith(".json")); }
  catch { return null; }
  const candidates = await Promise.all(entries.map(async filename => {
    try { const info = await stat(path.join(directory, filename)); return info.isFile() ? { filename, modified: info.mtimeMs } : null; }
    catch { return null; }
  }));
  const latest = candidates.filter((entry): entry is { filename: string; modified: number } => entry !== null).sort((a, b) => b.modified - a.modified || b.filename.localeCompare(a.filename))[0];
  if (!latest) return null;
  try {
    const raw = record(JSON.parse(await readFile(path.join(directory, latest.filename), "utf8")));
    if (raw.mode !== "openai" || (Array.isArray(raw.runs) && raw.runs.some(row => record(row).mode !== undefined && record(row).mode !== "openai"))) return null;
    if (!Array.isArray(raw.runs) && !Object.keys(record(raw.aggregate)).length) return null;
    const runMode = mode(raw.mode);
    const runs: EvalRun[] = (Array.isArray(raw.runs) ? raw.runs : []).map(value => {
      const row = record(value);
      const values = metrics(row.metrics);
      if (typeof row.personalityCorrect === "boolean") values.personalityAccuracy = row.personalityCorrect ? 1 : 0;
      return { caseId: label(row.caseId), personalityId: label(row.personalityId), mode: row.mode === undefined ? runMode : mode(row.mode), metrics: values, latencies: (Array.isArray(row.latenciesMs) ? row.latenciesMs : []).filter((value): value is number => number(value) !== undefined) };
    });
    const pairs = new Map<string, EvalRun[]>();
    for (const run of runs) {
      const key = JSON.stringify([run.caseId, run.personalityId, run.mode]);
      pairs.set(key, [...(pairs.get(key) ?? []), run]);
    }
    const groups = [...pairs.values()].map(rows => ({ caseId: rows[0].caseId, personalityId: rows[0].personalityId, mode: rows[0].mode, n: rows.length, metrics: aggregate(rows) }));
    const modes = new Set(runs.map(r => r.mode));
    const timestamp = typeof raw.timestamp === "string" && Number.isFinite(Date.parse(raw.timestamp)) ? raw.timestamp : null;
    return {
      filename: latest.filename, timestamp, mode: modes.size > 1 ? "mixed" : runs[0]?.mode ?? runMode,
      n: runs.length || number(record(raw.aggregate).runs) || 0,
      nPerPair: number(record(raw.config).n) ?? null,
      metrics: { ...aggregate(runs), ...metrics(raw.aggregate) }, groups,
    };
  } catch { return null; }
}
