import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { TokenUsage } from "./pricing.ts";

export const OPERATIONS = ["patient", "guard", "coach", "anamnesis", "creator", "student", "judge", "realtime"] as const;
export interface TraceContext {
  operation: typeof OPERATIONS[number];
  route?: string;
  caseId?: string;
  personalityId?: string;
  source?: "app" | "eval";
}
export interface LlmTrace extends TokenUsage {
  ts: string;
  operation: TraceContext["operation"];
  route?: string;
  model: string;
  status: "ok" | "error";
  errorCode?: string;
  latencyMs: number;
  costUsd: number;
  caseId?: string;
  personalityId?: string;
  source: "app" | "eval";
  unknownModel?: boolean;
  usageMissing?: boolean;
}

export function traceDirectory(): string {
  return process.env.MEDBOT_TRACE_DIR || path.join(process.cwd(), "traces");
}

// Project explicitly, so accidental extra properties cannot persist conversation text.
export function traceFields(t: LlmTrace): LlmTrace {
  return {
    ts: t.ts, operation: t.operation, route: t.route, model: t.model, status: t.status,
    errorCode: t.errorCode, latencyMs: t.latencyMs, inputTokens: t.inputTokens, outputTokens: t.outputTokens,
    reasoningTokens: t.reasoningTokens, cachedTokens: t.cachedTokens, costUsd: t.costUsd,
    caseId: t.caseId, personalityId: t.personalityId, source: t.source,
    audioInputTokens: t.audioInputTokens, audioOutputTokens: t.audioOutputTokens, cachedAudioTokens: t.cachedAudioTokens,
    unknownModel: t.unknownModel, usageMissing: t.usageMissing,
  };
}
let warned = false;
export async function recordTrace(t: LlmTrace): Promise<void> {
  try {
    const directory = traceDirectory();
    const line = JSON.stringify(traceFields(t)) + "\n";
    await mkdir(directory, { recursive: true });
    await appendFile(path.join(directory, "llm.jsonl"), line, { mode: 0o600 });
  } catch {
    if (!warned) {
      warned = true;
      console.warn("LLM usage trace could not be saved; usage totals may be incomplete.");
    }
  }
}
