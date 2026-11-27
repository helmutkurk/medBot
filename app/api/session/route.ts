import { buildPatientInstructions, buildRevealFactTool } from "../../../lib/engine/index.ts";
import { getModels, hasOpenAIKey, openAIHeaders } from "../../../lib/server/env.ts";
import { body, HttpError, interviewFrom, json, requestSignal, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const { c, p } = await interviewFrom(data);
    if (!hasOpenAIKey()) throw new HttpError(503, "no_api_key", "Add OPENAI_API_KEY to .env.local to enable voice. Text mode is available.");
    const models = getModels();
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
    if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 502, "voice_unavailable", "Voice could not connect to OpenAI. Check model access and API quota, or use text mode.");
    const secret: unknown = await response.json();
    if (!secret || typeof secret !== "object" || !("value" in secret) || typeof secret.value !== "string" || !("expires_at" in secret) || typeof secret.expires_at !== "number") throw new HttpError(502, "invalid_provider_response", "OpenAI did not return a valid voice credential.");
    return json({ clientSecret: secret.value, expiresAt: secret.expires_at, model: models.realtime });
  });
}
