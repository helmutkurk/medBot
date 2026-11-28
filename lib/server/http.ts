import type { ChatMessage } from "../case/types.ts";
import { CaseNotFoundError, getPersonality, loadCase, MissingApiKeyError, OpenAIError } from "../engine/index.ts";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function route(action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof MissingApiKeyError) return json({ error: { code: "no_api_key", message: error.message } }, 503);
    if (error instanceof OpenAIError) {
      if (error.kind === "timeout") return json({ error: { code: "timeout", message: "OpenAI timed out. Please try again." } }, 504);
      if (error.kind === "aborted") return json({ error: { code: "cancelled", message: "The request was cancelled." } }, 499);
      return json({ error: { code: "upstream_error", message: "OpenAI could not complete the request. Check API access and quota, then try again." } }, 502);
    }
    if (error instanceof CaseNotFoundError) return json({ error: { code: "case_not_found", message: "The requested patient case was not found." } }, 404);
    if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return json({ error: { code: "timeout", message: "The request timed out. Please try again." } }, 504);
    }
    // Never forward provider errors: they may contain request content or credentials.
    return json({ error: { code: "request_failed", message: "The request could not be completed. Please try again." } }, 502);
  }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "invalid_request", "Expected a JSON object.");
  return value as Record<string, unknown>;
}

export async function body(request: Request, maxBytes = 128_000): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "invalid_origin", "Requests must come from this application.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "invalid_content_type", "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "invalid_request", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "body_too_large", "The request body is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, "invalid_json", "The request body must be valid JSON."); }
  return object(value);
}

export function string(value: unknown, name: string, max = 8_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new HttpError(400, "invalid_request", `${name} must be a nonempty string of at most ${max} characters.`);
  return value.trim();
}

export function history(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length > 200) throw new HttpError(400, "invalid_request", "history must contain at most 200 messages.");
  return value.map((entry: unknown) => {
    const message = object(entry);
    if (message.role !== "student" && message.role !== "patient") throw new HttpError(400, "invalid_request", "Message role must be student or patient.");
    return { role: message.role, text: string(message.text, "Message text") };
  });
}

export function ids(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, "invalid_request", `${name} must be an array of at most 100 ids.`);
  return value.map(entry => {
    const id = string(entry, name, 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new HttpError(400, "invalid_request", `${name} contains an invalid id.`);
    return id;
  });
}

export async function caseFrom(value: unknown) {
  const id = string(value, "caseId", 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new HttpError(400, "invalid_request", "Invalid caseId.");
  return loadCase(id);
}

export async function interviewFrom(data: Record<string, unknown>) {
  const c = await caseFrom(data.caseId);
  const id = data.personalityId === undefined ? undefined : string(data.personalityId, "personalityId", 100);
  if (id && !c.personalities.some(p => p.id === id)) throw new HttpError(400, "unknown_personality", "The requested personality does not exist for this case.");
  return { c, p: getPersonality(c, id) };
}

export function requestSignal(request: Request): AbortSignal {
  return AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
}
