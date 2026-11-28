import { recordTrace } from "./trace.ts";
import { setTimeout as wait } from "node:timers/promises";
import type { TraceContext } from "./trace.ts";
import { estimateCost } from "./pricing.ts";
import type { TokenUsage } from "./pricing.ts";
import type { EngineOptions } from "../case/types.ts";
import { isRecord } from "../case/validate.ts";

export const DEFAULT_TEXT_MODEL = "gpt-5-mini";
export const DEFAULT_PATIENT_MODEL = "gpt-5-mini"; // gpt-4.1-mini: 3x faster but 8 invented facts in 12 interviews (eval 2026-11-28)
export type OpenAIErrorKind = "http" | "timeout" | "aborted" | "network" | "invalid_response" | "refusal";

export class OpenAIError extends Error {
  readonly kind: OpenAIErrorKind;
  readonly status: number | undefined;
  constructor(kind: OpenAIErrorKind, message: string, status?: number) {
    super(message);
    this.name = "OpenAIError";
    this.kind = kind;
    this.status = status;
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("Set OPENAI_API_KEY in .env.local and restart the server.");
    this.name = "MissingApiKeyError";
  }
}

export function requireApiKey(opts: EngineOptions): void {
  if (!opts.apiKey?.trim()) throw new MissingApiKeyError();
}

export interface ResponseRequest {
  instructions: string;
  input: { role: "user" | "assistant"; content: string }[];
  name: string;
  schema: object;
  timeoutMs?: number;
  trace?: TraceContext;
}

export async function requestStructured(request: ResponseRequest, opts: EngineOptions): Promise<unknown> {
  requireApiKey(opts);
  const model = opts.model ?? DEFAULT_TEXT_MODEL;
  const body = JSON.stringify({
    model,
    store: false,
    // Reasoning models default to medium effort (~10 s per turn); patient dialogue needs speed.
    ...(/^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" } } : {}),
    instructions: request.instructions,
    input: request.input,
    text: { format: { type: "json_schema", name: request.name, strict: true, schema: request.schema } },
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      opts.signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(request.timeoutMs ?? 15_000);
      const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
      signal.throwIfAborted();
      const started = performance.now();
      let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
      let usageMissing = true;
      let failure: OpenAIError | undefined;
      let latencyMs: number | undefined;
      let retryDelayMs = 250;
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST", headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" }, body, signal,
        });
        if (!response.ok) {
          latencyMs = performance.now() - started;
          // Discard provider error bodies: they may echo request data or credentials.
          await response.body?.cancel().catch(() => {});
          const retryAfter = response.headers.get("retry-after");
          const seconds = retryAfter === null ? NaN : Number(retryAfter);
          retryDelayMs = Number.isFinite(seconds) ? Math.min(2_000, Math.max(0, seconds * 1_000)) : 250;
          throw new OpenAIError("http", `OpenAI request failed with HTTP ${response.status}.`, response.status);
        }
        let data: unknown;
        try { data = await response.json(); }
        catch (error) {
          if (error instanceof SyntaxError) throw new OpenAIError("invalid_response", "OpenAI returned an invalid response body.");
          throw error;
        }
        if (isRecord(data) && isRecord(data.usage)) {
          const tokens = (value: unknown): number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
          const raw = data.usage;
          usageMissing = !(typeof raw.input_tokens === "number" && typeof raw.output_tokens === "number");
          usage = {
            inputTokens: tokens(raw.input_tokens), outputTokens: tokens(raw.output_tokens),
            cachedTokens: isRecord(raw.input_tokens_details) ? tokens(raw.input_tokens_details.cached_tokens) : undefined,
            reasoningTokens: isRecord(raw.output_tokens_details) ? tokens(raw.output_tokens_details.reasoning_tokens) : undefined,
          };
        }
        if (!isRecord(data) || data.status !== "completed" || !Array.isArray(data.output)) throw new OpenAIError("invalid_response", "OpenAI returned an incomplete or malformed response.");
        const chunks: string[] = [];
        for (const item of data.output) {
          if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
          for (const content of item.content) {
            if (!isRecord(content)) continue;
            if (content.type === "refusal") throw new OpenAIError("refusal", "OpenAI declined the structured request.");
            if (content.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
          }
        }
        if (!chunks.length) throw new OpenAIError("invalid_response", "OpenAI returned no structured output.");
        try { return JSON.parse(chunks.join("")) as unknown; }
        catch { throw new OpenAIError("invalid_response", "OpenAI returned invalid JSON."); }
      } catch (error) {
        failure = opts.signal?.aborted
          ? new OpenAIError(opts.signal.reason?.name === "TimeoutError" ? "timeout" : "aborted", "OpenAI request was cancelled.")
          : timeout.aborted ? new OpenAIError("timeout", "OpenAI request exceeded its time limit.")
          : error instanceof OpenAIError ? error : new OpenAIError("network", "OpenAI request failed while reading the response.");
        const transient = failure.kind === "timeout" || failure.kind === "network"
          || (failure.kind === "http" && (failure.status === 429 || (failure.status !== undefined && failure.status >= 500 && failure.status < 600)));
        if (attempt !== 0 || opts.signal?.aborted || !transient) throw failure;
      }
      finally {
        const errorCode = failure ? failure.status ? `http_${failure.status}` : failure.kind : undefined;
        await recordTrace({
          ...opts.trace, ...request.trace,
          ts: new Date().toISOString(), operation: request.trace?.operation ?? "patient",
          source: request.trace?.source ?? opts.trace?.source ?? "app", model,
          status: failure ? "error" : "ok", errorCode, latencyMs: latencyMs ?? performance.now() - started,
          ...usage, ...estimateCost(model, usage), usageMissing,
        });
      }
      await wait(retryDelayMs, undefined, { signal: opts.signal });
    }
  } catch (error) {
    if (opts.signal?.aborted && opts.signal.reason?.name === "TimeoutError") throw new OpenAIError("timeout", "OpenAI request exceeded its time limit.");
    if (opts.signal?.aborted) throw new OpenAIError("aborted", "OpenAI request was cancelled.");
    if (error instanceof OpenAIError) throw error;
    throw new OpenAIError("network", "OpenAI request failed while reading the response.");
  }
  throw new OpenAIError("invalid_response", "OpenAI request produced no result.");
}
