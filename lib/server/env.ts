import type { EngineOptions } from "../case/types.ts";
import { DEFAULT_TEXT_MODEL } from "../engine/index.ts";

// This module is imported only by server components and API routes.
export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getModels() {
  return {
    realtime: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
    text: process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL,
    transcription: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe",
  };
}

export function engineOptions(signal: AbortSignal): EngineOptions {
  return { apiKey: process.env.OPENAI_API_KEY?.trim() || undefined, model: getModels().text, signal };
}

export function openAIHeaders(): HeadersInit {
  return { Authorization: `Bearer ${process.env.OPENAI_API_KEY?.trim() || ""}`, "Content-Type": "application/json" };
}
