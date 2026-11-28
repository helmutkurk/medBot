// Codex, 2026-11-28. Estimated UTC-day spend, shared across clients within an instance.
import { open } from "node:fs/promises";
import path from "node:path";
import { hosted } from "./hosted.ts";
import { traceDirectory } from "./storage.ts";

interface CostRecord { ts: string; costUsd: number; kind?: string }
const unsaved = new Map<string, { day: string; cost: number }>();

export function rememberUnstoredCost(trace: CostRecord, directory = traceDirectory()): void {
  if (trace.kind === "turn" || !Number.isFinite(trace.costUsd) || trace.costUsd < 0) return;
  const day = trace.ts.slice(0, 10), previous = unsaved.get(directory);
  unsaved.set(directory, { day, cost: (previous?.day === day ? previous.cost : 0) + trace.costUsd });
}

export async function dailySpend(now = new Date(), directory = traceDirectory()): Promise<number> {
  const day = now.toISOString().slice(0, 10);
  let total = unsaved.get(directory)?.day === day ? unsaved.get(directory)!.cost : 0;
  let file;
  try { file = await open(/* turbopackIgnore: true */ path.join(directory, "llm.jsonl"), "r"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return total;
    throw error;
  }
  try {
    const { size } = await file.stat();
    if (!size) return total;
    let pending = "";
    for await (const chunk of file.createReadStream({ encoding: "utf8", end: size - 1, autoClose: false })) {
      pending += chunk;
      let end: number;
      while ((end = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        let trace: unknown;
        try { trace = JSON.parse(line); } catch { throw new Error("Unreadable budget record."); }
        if (trace && typeof trace === "object" && "ts" in trace && typeof trace.ts === "string" && trace.ts.startsWith(day)) {
          if ("kind" in trace && trace.kind === "turn") continue;
          if (!("costUsd" in trace) || typeof trace.costUsd !== "number" || !Number.isFinite(trace.costUsd) || trace.costUsd < 0) throw new Error("Invalid budget record.");
          total += trace.costUsd;
        }
      }
      if (pending.length > 16_384) throw new Error("Invalid budget record.");
    }
  } finally { await file.close(); }
  return total;
}

export interface PolicyFailure { status: number; code: string; message: string }
export async function budgetFailure(now = new Date(), directory = traceDirectory()): Promise<PolicyFailure | null> {
  if (!hosted()) return null;
  const cap = Number(process.env.MEDBOT_DAILY_USD_CAP);
  if (!Number.isFinite(cap) || cap <= 0) return { status: 503, code: "budget_unconfigured", message: "The daily demo budget is not configured. Please contact the host." };
  try {
    if (await dailySpend(now, directory) >= cap) return { status: 503, code: "daily_budget_exceeded", message: "The daily demo budget has been reached. Please try again tomorrow or contact the host." };
    return null;
  } catch { return { status: 503, code: "budget_unavailable", message: "The demo budget cannot be checked. Please contact the host." }; }
}
