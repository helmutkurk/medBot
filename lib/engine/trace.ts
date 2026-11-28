import path from "node:path";
import type { TokenUsage } from "./pricing.ts";
import { appendJsonLine, traceDirectory } from "../server/storage.ts";
import { rememberUnstoredCost } from "../server/budget.ts";
export { traceDirectory } from "../server/storage.ts";

export const OPERATIONS = ["patient", "guard", "coach", "anamnesis", "creator", "student", "judge", "realtime", "hint", "viva"] as const;
export interface TraceContext {
  operation: typeof OPERATIONS[number];
  route?: string;
  caseId?: string;
  personalityId?: string;
  source?: "app" | "eval";
}
export const TURN_TIMING_KEYS = ["micSilenceToAudibleMs", "micSilenceToAudibleP50Ms", "micSilenceToAudibleP95Ms", "speechToFirstAudioDeltaMs", "speechToFirstAudioBufferMs", "speechToFirstTranscriptDeltaMs", "speechToFirstToolCallMs", "toolAckMs"] as const;
export interface RealtimeTurnTiming {
  micSilenceToAudibleMs?: number;
  micSilenceToAudibleP50Ms?: number;
  micSilenceToAudibleP95Ms?: number;
  feltSampleCount?: number;
  speechToFirstAudioDeltaMs?: number;
  speechToFirstAudioBufferMs?: number;
  speechToFirstTranscriptDeltaMs?: number;
  speechToFirstToolCallMs?: number;
  toolAckMs: number;
  toolCallCount: number;
}
export interface LlmTrace extends TokenUsage, Partial<RealtimeTurnTiming> {
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
  kind?: "response" | "transcription" | "turn";
  turnId?: string;
  sessionId?: string;
  interrupted?: boolean;
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
    kind: t.kind, turnId: t.turnId, sessionId: t.sessionId, interrupted: t.interrupted,
    micSilenceToAudibleMs: t.micSilenceToAudibleMs, feltSampleCount: t.feltSampleCount,
    micSilenceToAudibleP50Ms: t.micSilenceToAudibleP50Ms, micSilenceToAudibleP95Ms: t.micSilenceToAudibleP95Ms,
    speechToFirstAudioDeltaMs: t.speechToFirstAudioDeltaMs, speechToFirstAudioBufferMs: t.speechToFirstAudioBufferMs,
    speechToFirstTranscriptDeltaMs: t.speechToFirstTranscriptDeltaMs, speechToFirstToolCallMs: t.speechToFirstToolCallMs,
    toolAckMs: t.toolAckMs, toolCallCount: t.toolCallCount,
  };
}
export async function recordTrace(t: LlmTrace): Promise<void> {
  const directory = traceDirectory();
  const saved = await appendJsonLine(path.join(directory, "llm.jsonl"), traceFields(t));
  if (!saved) rememberUnstoredCost(t, directory);
}
