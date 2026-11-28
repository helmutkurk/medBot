export type InterviewMode = "practice" | "osce" | "sprint";
export const interviewModes: Record<InterviewMode, { label: string; seconds: number | null; readingSeconds: number; description: string }> = {
  practice: { label: "Practice", seconds: null, readingSeconds: 0, description: "Untimed, with Socratic hints. Each hint costs 5 XP." },
  osce: { label: "OSCE station", seconds: 480, readingSeconds: 60, description: "Read the stem for 60 seconds, then interview for 8 minutes. No hints." },
  sprint: { label: "Red-flag sprint", seconds: 180, readingSeconds: 0, description: "Find every red flag in 3 minutes. Finish early for a time bonus. No hints." },
};
export function remainingSeconds(deadline: number, now: number): number { return Math.max(0, Math.ceil((deadline - now) / 1000)); }
export function sprintScore(found: number, total: number, elapsedMs: number): { found: number; total: number; score: number; timeBonus: number } {
  const safeFound = Math.max(0, Math.min(total, found));
  return { found: safeFound, total, score: total > 0 ? Math.round(100 * safeFound / total) : 0,
    timeBonus: total > 0 && safeFound === total ? Math.floor(20 * Math.max(0, 180_000 - Math.max(0, elapsedMs)) / 180_000) : 0 };
}
