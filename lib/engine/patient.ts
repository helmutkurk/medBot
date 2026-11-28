import type { ChatMessage, EngineOptions, PatientCase, PatientTurn, Personality } from "../case/types.ts";
import { buildPatientInstructions } from "../case/prompt.ts";
import { isRecord } from "../case/validate.ts";
import { OpenAIError, requestStructured, requireApiKey } from "./openai.ts";

function cleanReply(reply: string, unknownAnswer: string, hasRevealedFacts: boolean): string {
  let text = reply
    .replace(/<\|[^<>]*\|>/g, "")
    .replace(/`?\breveal_fact\s*\(\s*(?:\{[^{}]*\}|["']?[a-z][a-z0-9_]*["']?)\s*\)`?/gi, "")
    .replace(/`?\breveal_fact\b[ \t]*(?::[ \t]*)?(?:\{[^{}]*\}|<[a-z][a-z0-9_]*>|[a-z][a-z0-9_]*)`?/gi, "");
  if (hasRevealedFacts) {
    const words = unknownAnswer.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (words.length) {
      // Ignore case, punctuation, apostrophe style and whitespace, without matching inside words.
      const pattern = words.join("[^\\p{L}\\p{N}]*");
      text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])[.!?…]*`, "giu"), "");
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

export async function patientTurn(c: PatientCase, p: Personality, history: ChatMessage[], studentText: string, opts: EngineOptions): Promise<PatientTurn> {
  const start = performance.now();
  requireApiKey(opts);
  const result = await requestStructured({
    trace: { operation: "patient", caseId: c.id, personalityId: p.id },
    instructions: buildPatientInstructions(c, p), name: "patient_turn",
    input: [...history.map(m => ({ role: m.role === "student" ? "user" as const : "assistant" as const, content: m.text })), { role: "user", content: studentText }],
    schema: { type: "object", properties: {
      reply: { type: "string" }, revealed: { type: "array", items: { type: "string", enum: c.facts.map(f => f.id) } },
    }, required: ["reply", "revealed"], additionalProperties: false },
  }, opts);
  if (!isRecord(result) || typeof result.reply !== "string" || !result.reply.trim() || !Array.isArray(result.revealed) || result.revealed.some(id => typeof id !== "string")) throw new OpenAIError("invalid_response", "Invalid patient turn structure.");
  const known = new Set(c.facts.map(f => f.id));
  const revealed = [...new Set(result.revealed.filter((id): id is string => typeof id === "string" && known.has(id)))];
  const reply = cleanReply(result.reply, c.unknown_answer, revealed.length > 0);
  if (!reply) throw new OpenAIError("invalid_response", "Patient reply contains no spoken answer.");
  return { reply, revealed, mode: "openai", latencyMs: performance.now() - start };
}
