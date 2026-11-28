import type { CaseSummary, FactCategory } from "../lib/case/types.ts";

export interface InterviewCase extends CaseSummary {
  redFlagCount: number;
  facts: { id: string; category: FactCategory; lay: string; redFlag: boolean; revealWhen?: string }[];
}

export interface Health {
  ready: boolean;
  models: { realtime: string; text: string; transcription: string };
}
