import type { CaseSummary, FactCategory } from "../lib/case/types.ts";

export interface InterviewCase extends CaseSummary {
  facts: { id: string; category: FactCategory; lay: string }[];
}

export interface Health {
  voice: boolean;
  text: "mock" | "openai";
  models: { realtime: string; text: string; transcription: string };
}
