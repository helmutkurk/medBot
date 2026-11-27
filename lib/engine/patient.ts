import type { ChatMessage, EngineOptions, PatientCase, PatientTurn, Personality } from "../case/types.ts";
import { buildPatientInstructions } from "../case/prompt.ts";
import { isRecord } from "../case/validate.ts";
import { mockPatientTurn } from "./mock.ts";
import { OpenAIError, requestStructured } from "./openai.ts";

export async function patientTurn(c: PatientCase, p: Personality, history: ChatMessage[], studentText: string, opts: EngineOptions): Promise<PatientTurn> {
  const start = performance.now();
  opts.signal?.throwIfAborted();
  if (!opts.apiKey) return { ...mockPatientTurn(c, p, history, studentText), latencyMs: performance.now() - start };
  const result = await requestStructured({
    instructions: buildPatientInstructions(c, p), name: "patient_turn",
    input: [...history.map(m => ({ role: m.role === "student" ? "user" as const : "assistant" as const, content: m.text })), { role: "user", content: studentText }],
    schema: { type: "object", properties: {
      reply: { type: "string" }, revealed: { type: "array", items: { type: "string", enum: c.facts.map(f => f.id) } },
    }, required: ["reply", "revealed"], additionalProperties: false },
  }, opts);
  if (!isRecord(result) || typeof result.reply !== "string" || !result.reply.trim() || !Array.isArray(result.revealed) || result.revealed.some(id => typeof id !== "string")) throw new OpenAIError("invalid_response", "Invalid patient turn structure.");
  const known = new Set(c.facts.map(f => f.id));
  return { reply: result.reply, revealed: [...new Set(result.revealed.filter((id): id is string => typeof id === "string" && known.has(id)))], mode: "openai", latencyMs: performance.now() - start };
}
