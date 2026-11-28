import type { CaseSummary, ChatMessage, CommunicationRatings, FactCategory, Personality } from "../case/types.ts";
import type { CoachReport } from "./coach.ts";
import type { AnamnesisReport } from "./anamnesis.ts";
import type { InterviewMode } from "./interview-mode.ts";
import type { DisclosureEvent, GuardEvent } from "./replay.ts";
import type { Reflection } from "./learner.ts";
import type { VivaResult } from "./viva.ts";

export interface SessionTimings { readingStartedAt: string | null; readingEndedAt: string | null; startedAt: string | null; endedAt: string | null; elapsedMs: number }
export const emptyTimings = (): SessionTimings => ({ readingStartedAt: null, readingEndedAt: null, startedAt: null, endedAt: null, elapsedMs: 0 });
interface SessionRecordInput {
  mode: InterviewMode;
  case: Pick<CaseSummary, "id" | "title" | "patient">;
  personality: Pick<Personality, "id"> & Partial<Pick<Personality, "label" | "voice">>;
  messages: (ChatMessage & { id: string })[];
  timings: SessionTimings;
  latencies: { kind: "voice" | "text"; ms: number }[];
  hints: { nudge: string; at: string }[];
  revealedFactIds: string[];
  coverage: { category: FactCategory; found: number; total: number }[];
  disclosureEvents: DisclosureEvent[];
  guardWarnings: GuardEvent[];
  guardPending: number;
  reflection: Reflection | null;
  coach: CoachReport | null;
  coachStatus: string;
  anamnesis: AnamnesisReport | null;
  anamnesisStatus: string;
  viva: VivaResult | null;
  sprint: { found: number; total: number; score: number; timeBonus: number } | null;
}

/** Browser download data only. Never includes hidden case facts or an answer key before viva submission. */
export function sessionRecord(input: SessionRecordInput, exportedAt = new Date().toISOString()) {
  const { coach, anamnesis, ...session } = input;
  const elapsedMs = input.timings.startedAt && !input.timings.endedAt ? Math.max(0, Date.parse(exportedAt) - Date.parse(input.timings.startedAt)) : input.timings.elapsedMs;
  const scores = coach ? Object.fromEntries(Object.entries(coach.communication).map(([skill, rating]) => [skill, rating.score])) as Record<keyof CommunicationRatings, number> : null;
  return {
    ...session, exportedAt, app: "medBot", version: 2, engineMode: "openai",
    timings: { ...input.timings, elapsedMs },
    latencies: input.latencies.map(timing => ({ ...timing, ms: Math.round(timing.ms) })),
    coachScores: coach ? { history: coach.score, communication: scores } : null,
    answerKeyStatus: input.viva ? "unlocked" : "locked_until_viva_answer",
    coachReport: input.viva ? coach : null,
    anamnesis: input.viva ? anamnesis : null,
  };
}
