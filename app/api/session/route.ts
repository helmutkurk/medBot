import { estimateCost } from "../../../lib/engine/pricing.ts";
import { recordTrace } from "../../../lib/engine/trace.ts";
import { buildPatientInstructions, buildRevealFactTool } from "../../../lib/engine/index.ts";
import { getModels, openAIHeaders, requireOpenAIKey } from "../../../lib/server/env.ts";
import { body, HttpError, interviewFrom, json, requestSignal, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const { c, p } = await interviewFrom(data);
    requireOpenAIKey();
    const models = getModels();
    const started = performance.now();
    let status: "ok" | "error" = "error";
    try {
      const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST", headers: openAIHeaders(), signal: requestSignal(request), cache: "no-store",
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 600 },
          session: {
            type: "realtime", model: models.realtime,
            instructions: buildPatientInstructions(c, p),
            audio: {
              input: { transcription: { model: models.transcription }, turn_detection: { type: "semantic_vad" } },
              output: { voice: p.voice },
            },
            tools: [buildRevealFactTool(c)], tool_choice: "auto",
          },
        }),
      });
      if (!response.ok) throw new HttpError(502, "voice_unavailable", "Voice could not connect to OpenAI. Check model access and API quota, or use text mode.");
      const secret: unknown = await response.json();
      if (!secret || typeof secret !== "object" || !("value" in secret) || typeof secret.value !== "string" || !("expires_at" in secret) || typeof secret.expires_at !== "number") throw new HttpError(502, "invalid_provider_response", "OpenAI did not return a valid voice credential.");
      status = "ok";
      return json({ clientSecret: secret.value, expiresAt: secret.expires_at, model: models.realtime });
    } finally {
      const usage = { inputTokens: 0, outputTokens: 0 };
      await recordTrace({
        ts: new Date().toISOString(), operation: "realtime", route: "/api/session", model: models.realtime,
        status, errorCode: status === "error" ? "session_failed" : undefined,
        latencyMs: performance.now() - started, ...usage, ...estimateCost(models.realtime, usage),
        caseId: c.id, personalityId: p.id, source: "app",
      });
    }
  });
}
