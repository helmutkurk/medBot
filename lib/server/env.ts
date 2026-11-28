import type { EngineOptions } from "../case/types.ts";
import { DEFAULT_TEXT_MODEL, DEFAULT_PATIENT_MODEL, MissingApiKeyError } from "../engine/index.ts";

// This module is imported only by server components and API routes.
export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getModels() {
  return {
    realtime: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
    text: process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL,
    patient: process.env.OPENAI_PATIENT_MODEL?.trim() || DEFAULT_PATIENT_MODEL,
    // Coach grades the student (quotes are verified deterministically); a non-reasoning model keeps feedback fast.
    coach: process.env.OPENAI_COACH_MODEL?.trim() || "gpt-4.1-mini",
    transcription: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe",
  };
}

export function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new MissingApiKeyError();
  return key;
}

export function engineOptions(signal: AbortSignal, route?: string): EngineOptions {
  return { apiKey: requireOpenAIKey(), model: getModels().text, signal, trace: { route } };
}

export function openAIHeaders(): HeadersInit {
  return { Authorization: `Bearer ${requireOpenAIKey()}`, "Content-Type": "application/json" };
}

/** Provider VAD presets; invalid/empty settings use the fast semantic default. */
export function getTurnDetection() {
  const preset = process.env.OPENAI_TURN_DETECTION?.trim();
  const common = { create_response: true, interrupt_response: true };
  return preset === "server_400"
    ? { type: "server_vad", threshold: 0.5, prefix_padding_ms: 200, silence_duration_ms: 400, ...common }
    : { type: "semantic_vad", eagerness: preset === "semantic_medium" ? "medium" : "high", ...common };
}
