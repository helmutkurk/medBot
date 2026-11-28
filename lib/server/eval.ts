import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const metricKeys = ["factCoverage", "invented", "contradictions", "unpromptedDisclosures", "jargonHits", "outOfCharacter", "latencyP50Ms", "latencyP95Ms", "personalityAccuracy", "coachScore", "anamnesisCompleteness"] as const;
type MetricKey = typeof metricKeys[number];
export type EvalMetrics = Partial<Record<MetricKey, number>>;
export interface Proportion { x: number; n: number }
interface EvalRun { caseId: string; personalityId: string; mode: string; metrics: EvalMetrics; latencies: number[] }
export interface EvalGroup { caseId: string; personalityId: string; mode: string; n: number; metrics: EvalMetrics; clean: Proportion; recognised: Proportion }
export interface EvalEvidence {
  filename: string; timestamp: string | null; mode: string; n: number; nPerPair: number | null;
  metrics: EvalMetrics; groups: EvalGroup[];
  patientModel: string | null; textModel: string | null; turns: number | null; failed: number;
  caseCount: number; personalitiesPerCase: number | null;
  recognised: Proportion; clean: Proportion;
}
export interface WilsonInterval { p: number; low: number; high: number }
export interface VoiceEvidence {
  directory: string; directories: string[]; timestamp: string | null; model: string | null; turns: number; caseCount: number;
  firstAudioP50Ms: number; firstAudioP95Ms: number; guardedMessages: number;
  guardCounts: { invented: number; contradiction: number; unprompted: number; jargon: number; out_of_character: number };
}

/** Wilson score interval, nominal two-sided 95%. Returns null for n = 0 or invalid input. */
export function wilson(x: number, n: number): WilsonInterval | null {
  if (!Number.isInteger(x) || !Number.isInteger(n) || n <= 0 || x < 0 || x > n) return null;
  const z = 1.959964, p = x / n, d = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / d;
  const half = z / d * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
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
  const counts: MetricKey[] = ["invented", "contradictions", "unpromptedDisclosures", "jargonHits", "outOfCharacter"];
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

function cleanCount(runs: EvalRun[]): Proportion {
  const auditable = runs.filter(r => (["invented", "contradictions", "unpromptedDisclosures"] as MetricKey[]).every(key => r.metrics[key] !== undefined));
  return { x: auditable.filter(r => r.metrics.invented === 0 && r.metrics.contradictions === 0 && r.metrics.unpromptedDisclosures === 0).length, n: auditable.length };
}
function recognisedCount(runs: EvalRun[]): Proportion {
  const classified = runs.filter(r => r.metrics.personalityAccuracy !== undefined);
  return { x: classified.filter(r => r.metrics.personalityAccuracy === 1).length, n: classified.length };
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
  const ordered = candidates.filter((entry): entry is { filename: string; modified: number } => entry !== null).sort((a, b) => b.filename.localeCompare(a.filename));
  // Skip files that are unreadable, still being written or contain no completed interview.
  for (const entry of ordered) {
    const evidence = await parseEval(directory, entry.filename);
    if (evidence) return evidence;
  }
  return null;
}

async function parseEval(directory: string, filename: string): Promise<EvalEvidence | null> {
  const latest = { filename };
  try {
    const raw = record(JSON.parse(await readFile(path.join(directory, latest.filename), "utf8")));
    if (!Array.isArray(raw.runs) || !raw.runs.length) return null;
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
    const groups = [...pairs.values()].map(rows => ({ caseId: rows[0].caseId, personalityId: rows[0].personalityId, mode: rows[0].mode, n: rows.length, metrics: aggregate(rows), clean: cleanCount(rows), recognised: recognisedCount(rows) }));
    const modes = new Set(runs.map(r => r.mode));
    const personalitiesByCase = new Map<string, Set<string>>();
    for (const run of runs) personalitiesByCase.set(run.caseId, (personalitiesByCase.get(run.caseId) ?? new Set()).add(run.personalityId));
    const perCase = new Set([...personalitiesByCase.values()].map(set => set.size));
    const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
    const timestamp = typeof raw.timestamp === "string" && Number.isFinite(Date.parse(raw.timestamp)) ? raw.timestamp : null;
    return {
      filename: latest.filename, timestamp, mode: modes.size > 1 ? "mixed" : runs[0]?.mode ?? runMode,
      n: runs.length || number(record(raw.aggregate).runs) || 0,
      nPerPair: number(record(raw.config).n) ?? null,
      metrics: { ...aggregate(runs), ...metrics(raw.aggregate) }, groups,
      patientModel: text(raw.patientModel), textModel: text(raw.textModel ?? raw.model),
      turns: number(record(raw.config).turns) ?? null, failed: Array.isArray(raw.failures) ? raw.failures.length : 0,
      caseCount: personalitiesByCase.size, personalitiesPerCase: perCase.size === 1 ? [...perCase][0] : null,
      recognised: recognisedCount(runs), clean: cleanCount(runs),
    };
  } catch { return null; }
}

const issueKeys = ["invented", "contradiction", "unprompted", "jargon", "out_of_character"] as const;
/** Pool production-model reports started within 30 minutes of the newest usable benchmark. */
export async function loadLatestVoice(): Promise<VoiceEvidence | null> {
  const directory = path.join(process.cwd(), "eval", "voice");
  let names: string[];
  try { names = await readdir(directory); } catch { return null; }
  const production = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";
  const reports = await Promise.all(names.map(async name => {
    try {
      const raw = record(JSON.parse(await readFile(path.join(directory, name, "results.json"), "utf8")));
      // Benchmark directory names capture creation time, unaffected by later checkpoint writes.
      const created = Date.parse(name.slice(0, 24).replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3"));
      if (!Number.isFinite(created)) return null;
      const allRuns = (Array.isArray(raw.runs) ? raw.runs : []).map(record);
      const runs = allRuns.filter(run => run.model === production);
      if (!runs.length) return null;
      const summaries = (Array.isArray(raw.summaries) ? raw.summaries : []).map(record).filter((_, i) => allRuns[i]?.model === production);
      const turns = runs.flatMap(run => (Array.isArray(run.turns) ? run.turns : []).map(record));
      const first = turns.filter(t => t.status === "ok").flatMap(t => number(t.firstAudioMs) === undefined ? [] : [t.firstAudioMs as number]);
      return { name, created, timestamp: typeof raw.timestamp === "string" ? raw.timestamp : null, runs, summaries, first };
    } catch { return null; } // Absent or still being written.
  }));
  const ordered = reports.filter(report => report !== null).sort((a, b) => b.created - a.created || b.name.localeCompare(a.name));
  const newest = ordered[0];
  if (!newest) return null;
  const session = ordered.filter(report => newest.created - report.created <= 30 * 60_000);
  const first = session.flatMap(report => report.first);
  if (!first.length) return null;
  const guardCounts = { invented: 0, contradiction: 0, unprompted: 0, jargon: 0, out_of_character: 0 };
  let guardedMessages = 0;
  for (const summary of session.flatMap(report => report.summaries)) {
    guardedMessages += number(summary.guardedMessages) ?? 0;
    const counts = record(summary.guardCounts);
    for (const key of issueKeys) guardCounts[key] += number(counts[key]) ?? 0;
  }
  const caseIds = new Set(session.flatMap(report => report.runs).flatMap(run => typeof run.caseId === "string" && run.caseId.trim() ? [run.caseId] : []));
  return {
    directory: newest.name, directories: session.map(report => report.name), timestamp: newest.timestamp, model: production, caseCount: caseIds.size,
    turns: first.length, firstAudioP50Ms: percentile(first, 0.5), firstAudioP95Ms: percentile(first, 0.95), guardedMessages, guardCounts,
  };
}
