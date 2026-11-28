import { open } from "node:fs/promises";
import path from "node:path";
import { isRecord } from "../case/validate.ts";
import { OPERATIONS, traceDirectory, traceFields } from "../engine/trace.ts";
import type { LlmTrace } from "../engine/trace.ts";

export interface UsageTotals { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
export interface UsageSummary {
  totals: UsageTotals;
  byOperation: (UsageTotals & { operation: string })[];
  byModel: (UsageTotals & { model: string; unknownModel: boolean })[];
  recent: LlmTrace[];
  since: string | null;
}
const totals = (): UsageTotals => ({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
function add(total: UsageTotals, trace: LlmTrace): void {
  total.calls++; total.inputTokens += trace.inputTokens; total.outputTokens += trace.outputTokens; total.costUsd += trace.costUsd;
}
function validTrace(value: unknown): value is LlmTrace {
  if (!isRecord(value)) return false;
  return typeof value.ts === "string" && Number.isFinite(Date.parse(value.ts))
    && OPERATIONS.some(op => op === value.operation) && typeof value.model === "string" && value.model.length <= 100
    && (value.source === "app" || value.source === "eval") && (value.status === "ok" || value.status === "error")
    && ["inputTokens", "outputTokens", "latencyMs", "costUsd"].every(key => typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0);
}

export async function loadUsage(source?: "app" | "eval", directory = traceDirectory()): Promise<UsageSummary> {
  const result: UsageSummary = { totals: totals(), byOperation: [], byModel: [], recent: [], since: null };
  const operations = new Map<string, UsageTotals & { operation: string }>();
  const models = new Map<string, UsageTotals & { model: string; unknownModel: boolean }>();
  let file;
  try { file = await open(path.join(directory, "llm.jsonl"), "r"); }
  catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return result;
    throw error;
  }
  try {
    // Read a fixed snapshot; only newline-terminated records are committed.
    const { size } = await file.stat();
    if (!size) return result;
    const stream = file.createReadStream({ encoding: "utf8", end: size - 1, autoClose: false });
    let pending = "";
    let oversized = false;
    for await (const chunk of stream) {
      pending += chunk;
      let newline: number;
      while ((newline = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        const skip = oversized || line.length > 16_384;
        oversized = false;
        if (skip) continue;
        let trace: unknown;
        try { trace = JSON.parse(line); } catch { continue; }
        if (!validTrace(trace) || (source && trace.source !== source)) continue;
        add(result.totals, trace);
        const operation = operations.get(trace.operation) ?? { ...totals(), operation: trace.operation };
        add(operation, trace); operations.set(trace.operation, operation);
        const model = models.get(trace.model) ?? { ...totals(), model: trace.model, unknownModel: false };
        model.unknownModel ||= trace.unknownModel === true;
        add(model, trace); models.set(trace.model, model);
        if (!result.since || trace.ts < result.since) result.since = trace.ts;
        result.recent.push(traceFields(trace));
        if (result.recent.length > 50) result.recent.shift();
      }
      if (pending.length > 16_384) { pending = ""; oversized = true; }
    }
  } finally { await file.close(); }
  result.byOperation = [...operations.values()].sort((a, b) => b.costUsd - a.costUsd);
  result.byModel = [...models.values()].sort((a, b) => b.costUsd - a.costUsd);
  result.recent.reverse();
  return result;
}
