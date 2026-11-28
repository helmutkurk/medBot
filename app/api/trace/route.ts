import { estimateCost } from "../../../lib/engine/pricing.ts";
import type { TokenUsage } from "../../../lib/engine/pricing.ts";
import { recordTrace, TURN_TIMING_KEYS } from "../../../lib/engine/trace.ts";
import type { RealtimeTurnTiming } from "../../../lib/engine/trace.ts";
import { getModels } from "../../../lib/server/env.ts";
import { body, HttpError, json, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const tokenKeys = ["inputTokens", "outputTokens", "cachedTokens", "audioInputTokens", "audioOutputTokens", "cachedAudioTokens"] as const;
const turnKeys = [...TURN_TIMING_KEYS, "toolCallCount", "turnId", "sessionId", "feltSampleCount", "interrupted"];
const allowed = new Set<string>(["operation", "kind", "usageMissing", "status", "latencyMs", "caseId", "personalityId", ...tokenKeys, ...turnKeys]);
function invalid(): never { throw new HttpError(400, "invalid_trace", "Invalid Realtime usage metadata."); }

export function POST(request: Request) {
  return route(async () => {
    const data = await body(request, 4096);
    if (Object.keys(data).some(key => !allowed.has(key)) || data.operation !== "realtime" || (data.status !== "ok" && data.status !== "error")) invalid();
    if (data.kind !== undefined && data.kind !== "response" && data.kind !== "transcription" && data.kind !== "turn") invalid();
    if (data.usageMissing !== undefined && typeof data.usageMissing !== "boolean") invalid();
    if (typeof data.latencyMs !== "number" || !Number.isFinite(data.latencyMs) || data.latencyMs < 0 || data.latencyMs > 86_400_000) invalid();
    const timing: Partial<RealtimeTurnTiming> = {};
    if (data.kind === "turn") {
      if (typeof data.turnId !== "string" || !/^turn_[a-zA-Z0-9_-]{1,100}$/.test(data.turnId) || typeof data.interrupted !== "boolean") invalid();
      if (typeof data.toolCallCount !== "number" || !Number.isSafeInteger(data.toolCallCount) || data.toolCallCount < 0 || data.toolCallCount > 10000) invalid();
      timing.toolCallCount = data.toolCallCount;
      if (data.sessionId !== undefined && (typeof data.sessionId !== "string" || !/^session_[a-zA-Z0-9_-]{1,100}$/.test(data.sessionId))) invalid();
      if (data.feltSampleCount !== undefined) {
        if (typeof data.feltSampleCount !== "number" || !Number.isSafeInteger(data.feltSampleCount) || data.feltSampleCount < 1 || data.feltSampleCount > 10000) invalid();
        timing.feltSampleCount = data.feltSampleCount;
      }
      for (const key of TURN_TIMING_KEYS) {
        const value = data[key];
        if (value === undefined) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (key === "micSilenceToAudibleP50Ms" || key === "micSilenceToAudibleP95Ms" ? 86_400_000 : data.latencyMs)) invalid();
        timing[key] = value;
      }
      if (tokenKeys.some(key => data[key] !== undefined && data[key] !== 0) || data.usageMissing !== undefined) invalid();
    } else if (turnKeys.some(key => data[key] !== undefined)) invalid();
    for (const key of ["caseId", "personalityId"] as const) {
      if (typeof data[key] !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(data[key])) invalid();
    }
    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    for (const key of tokenKeys) {
      const value = data[key];
      if (value === undefined && key !== "inputTokens" && key !== "outputTokens") continue;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000) invalid();
      usage[key] = value;
    }
    const { inputTokens: input, outputTokens: output, cachedTokens: cached = 0, audioInputTokens: audioIn = 0, audioOutputTokens: audioOut = 0, cachedAudioTokens: cachedAudio = 0 } = usage;
    if (cached > input || audioIn > input || audioOut > output || cachedAudio > cached || cachedAudio > audioIn || cached - cachedAudio > input - audioIn) invalid();
    const model = data.kind === "transcription" ? getModels().transcription : getModels().realtime;
    await recordTrace({
      ts: new Date().toISOString(), operation: "realtime", route: "/api/trace", model,
      status: data.status, errorCode: data.status === "error" ? "realtime_response_failed" : undefined,
      latencyMs: data.latencyMs, caseId: String(data.caseId), personalityId: String(data.personalityId), source: "app",
      ...usage, ...estimateCost(model, usage), usageMissing: data.kind === "turn" ? undefined : data.usageMissing === true,
      kind: data.kind, ...timing,
      sessionId: data.kind === "turn" && typeof data.sessionId === "string" ? data.sessionId : undefined,
      turnId: data.kind === "turn" && typeof data.turnId === "string" ? data.turnId : undefined,
      interrupted: data.kind === "turn" && typeof data.interrupted === "boolean" ? data.interrupted : undefined,
    });
    return json({ ok: true });
  });
}
