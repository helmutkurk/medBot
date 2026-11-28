import { estimateCost } from "../../../lib/engine/pricing.ts";
import type { TokenUsage } from "../../../lib/engine/pricing.ts";
import { recordTrace } from "../../../lib/engine/trace.ts";
import { getModels } from "../../../lib/server/env.ts";
import { body, HttpError, json, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const tokenKeys = ["inputTokens", "outputTokens", "cachedTokens", "audioInputTokens", "audioOutputTokens", "cachedAudioTokens"] as const;
const allowed = new Set<string>(["operation", "kind", "usageMissing", "status", "latencyMs", "caseId", "personalityId", ...tokenKeys]);
function invalid(): never { throw new HttpError(400, "invalid_trace", "Invalid Realtime usage metadata."); }

export function POST(request: Request) {
  return route(async () => {
    const data = await body(request, 4096);
    if (Object.keys(data).some(key => !allowed.has(key)) || data.operation !== "realtime" || (data.status !== "ok" && data.status !== "error")) invalid();
    if (data.kind !== undefined && data.kind !== "response" && data.kind !== "transcription") invalid();
    if (data.usageMissing !== undefined && typeof data.usageMissing !== "boolean") invalid();
    if (typeof data.latencyMs !== "number" || !Number.isFinite(data.latencyMs) || data.latencyMs < 0 || data.latencyMs > 86_400_000) invalid();
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
      ...usage, ...estimateCost(model, usage), usageMissing: data.usageMissing === true,
    });
    return json({ ok: true });
  });
}
