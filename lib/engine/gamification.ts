import { sprintScore } from "./interview-mode.ts";
import { communicationSkills } from "../case/types.ts";
import type { LearnerProfile, ReviewItem, SessionResult } from "./learner.ts";

/*
 * Motivation layer. Everything here is derived from the local learner profile plus a small game state
 * (review ratings, earned badges, optional leaderboard nickname). No XP is invented: it comes from
 * coach coverage, red flags found, Calgary-Cambridge ratings, reflection calibration and review practice.
 * Design choices from learning science: reward retrieval and calibration (not time on page), keep the
 * daily goal small and forgiving (one weekly streak freeze), never rank on anything but XP.
 */

export type ReviewRating = "again" | "hard" | "good" | "easy";
export const reviewRatings: readonly ReviewRating[] = ["again", "hard", "good", "easy"];
export interface ReviewLogEntry { at: string; caseId: string; factId: string; rating: ReviewRating }
export interface GameState {
  version: 1;
  /** Non-null means the learner opted in to the leaderboard under this nickname. */
  nickname: string | null;
  reviews: ReviewLogEntry[];
  /** Badge id to ISO time it was unlocked. */
  badges: Record<string, string>;
}
export const maxReviewLog = 500;
export const emptyGame = (): GameState => ({ version: 1, nickname: null, reviews: [], badges: {} });

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const time = (iso: string) => new Date(iso).getTime();

// ---- XP ----------------------------------------------------------------------------------------------

export interface XpBreakdown { base: number; coverage: number; redFlags: number; communication: number; calibration: number; viva?: number; timeBonus?: number; hintPenalty?: number; total: number }
export const reviewXp: Record<ReviewRating, number> = { again: 2, hard: 3, good: 5, easy: 6 };

/** Performance in 0-1 used for calibration: mean of coach score and red-flag retrieval (as learner.ts). */
function performance(outcome: NonNullable<SessionResult["outcome"]>): number {
  const safety = outcome.redFlags.length ? outcome.redFlags.filter(f => f.found).length / outcome.redFlags.length : outcome.score / 100;
  return (clamp(outcome.score / 100) + clamp(safety)) / 2;
}
export function sessionXp(session: SessionResult): XpBreakdown {
  const outcome = session.outcome;
  // A reflected interview without a coach report earns only the completion base.
  if (!outcome) {
    const hintPenalty = Math.min(10, Math.max(0, Math.floor(session.hintsUsed ?? 0)) * 5);
    const viva = Math.round(clamp((session.viva?.score ?? 0) / 100) * 20);
    return { base: 10, coverage: 0, redFlags: 0, communication: 0, calibration: 0, ...(hintPenalty ? { hintPenalty } : {}), ...(viva ? { viva } : {}), total: 10 + viva - hintPenalty };
  }
  const found = outcome.coverage.reduce((sum, row) => sum + row.found, 0);
  const total = outcome.coverage.reduce((sum, row) => sum + row.total, 0);
  const flagsFound = outcome.redFlags.filter(f => f.found).length;
  const allFlags = outcome.redFlags.length > 0 && flagsFound === outcome.redFlags.length;
  const confidence = clamp((session.reflection.confidence - 1) / 4);
  const parts = {
    base: 20,
    coverage: total ? Math.round(40 * found / total) : 0,
    redFlags: Math.min(40, flagsFound * 10) + (allFlags ? 10 : 0),
    communication: communicationSkills.reduce((sum, skill) => sum + Math.round(clamp(outcome.communication[skill], 0, 2) * 3), 0) ,
    calibration: Math.abs(confidence - performance(outcome)) <= .2 ? 15 : 0,
  };
  const subtotal = parts.base + parts.coverage + parts.redFlags + parts.communication + parts.calibration;
  const hintPenalty = Math.min(subtotal, Math.max(0, Math.floor(session.hintsUsed ?? 0)) * 5);
  const viva = Math.round(clamp((session.viva?.score ?? 0) / 100) * 20);
  const timeBonus = session.mode === "sprint" ? sprintScore(flagsFound, outcome.redFlags.length, session.elapsedMs ?? 180_000).timeBonus : 0;
  return { ...parts, ...(hintPenalty ? { hintPenalty } : {}), ...(viva ? { viva } : {}), ...(timeBonus ? { timeBonus } : {}), total: subtotal + viva + timeBonus - hintPenalty };
}

export const maxLevel = 50;
/** Total XP needed to reach a level: 0, 50, 141, 260, 400, ... a gentle power curve. */
export const xpForLevel = (level: number) => level <= 1 ? 0 : Math.round(50 * (Math.min(level, maxLevel + 1) - 1) ** 1.5);
export interface LevelInfo { level: number; xp: number; floor: number; ceiling: number | null; progress: number }
export function levelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < maxLevel && safe >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const ceiling = level >= maxLevel ? null : xpForLevel(level + 1);
  return { level, xp: safe, floor, ceiling, progress: ceiling === null ? 1 : (safe - floor) / (ceiling - floor) };
}
export const totalXp = (profile: LearnerProfile, game: GameState) =>
  profile.sessions.reduce((sum, s) => sum + sessionXp(s).total, 0) + game.reviews.reduce((sum, r) => sum + reviewXp[r.rating], 0);

/** Weeks start on Monday 00:00 UTC, matching the leaderboard server. */
export function weekStart(now: string): string {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}
export function weeklyXp(profile: LearnerProfile, game: GameState, now: string): number {
  const from = time(`${weekStart(now)}T00:00:00Z`);
  const until = from + 7 * 86_400_000;
  const inWeek = (iso: string) => time(iso) >= from && time(iso) < until;
  return profile.sessions.filter(s => inWeek(s.completedAt)).reduce((sum, s) => sum + sessionXp(s).total, 0)
    + game.reviews.filter(r => inWeek(r.at)).reduce((sum, r) => sum + reviewXp[r.rating], 0);
}

// ---- Days, daily goal, streak -------------------------------------------------------------------------

/** Local calendar day (YYYY-MM-DD) of an ISO instant: a learner's day ends at their midnight. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const mondayOf = (key: string) => addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));

export const dailyGoal = { interviews: 1, reviews: 3 } as const;
export interface DailyGoal { interviews: number; reviews: number; met: boolean }
function countsByDay(profile: LearnerProfile, game: GameState) {
  const interviews = new Map<string, number>();
  const reviews = new Map<string, number>();
  for (const s of profile.sessions) interviews.set(dayKey(s.completedAt), (interviews.get(dayKey(s.completedAt)) ?? 0) + 1);
  for (const r of game.reviews) reviews.set(dayKey(r.at), (reviews.get(dayKey(r.at)) ?? 0) + 1);
  return { interviews, reviews };
}
function metDays(profile: LearnerProfile, game: GameState): Set<string> {
  const { interviews, reviews } = countsByDay(profile, game);
  const met = new Set<string>();
  for (const [day, n] of interviews) if (n >= dailyGoal.interviews) met.add(day);
  for (const [day, n] of reviews) if (n >= dailyGoal.reviews) met.add(day);
  return met;
}
export function dailyGoalFor(profile: LearnerProfile, game: GameState, now: string): DailyGoal {
  const { interviews, reviews } = countsByDay(profile, game);
  const day = dayKey(now);
  const i = interviews.get(day) ?? 0, r = reviews.get(day) ?? 0;
  return { interviews: i, reviews: r, met: i >= dailyGoal.interviews || r >= dailyGoal.reviews };
}

/** Run of goal-met days ending at `end`. One missed day per calendar week is bridged by a freeze. */
function runEndingAt(met: Set<string>, end: string): { count: number; frozen: string[] } {
  let count = 0, day = end;
  const frozen: string[] = [];
  const usedWeeks = new Set<string>();
  for (;;) {
    if (met.has(day)) { count++; day = addDays(day, -1); continue; }
    const week = mondayOf(day);
    if (!usedWeeks.has(week) && met.has(addDays(day, -1))) { usedWeeks.add(week); frozen.push(day); day = addDays(day, -1); continue; }
    return { count, frozen };
  }
}
export interface StreakInfo { current: number; longest: number; todayDone: boolean; freezeAvailable: boolean; frozenDays: string[] }
export function streakFor(profile: LearnerProfile, game: GameState, now: string): StreakInfo {
  const met = metDays(profile, game);
  const today = dayKey(now);
  const todayDone = met.has(today);
  // Today is still open until midnight: a not-yet-met today never breaks the streak.
  const run = runEndingAt(met, todayDone ? today : addDays(today, -1));
  const longest = [...met].reduce((best, day) => Math.max(best, runEndingAt(met, day).count), 0);
  const thisWeek = mondayOf(today);
  return { current: run.count, longest: Math.max(longest, run.count), todayDone, freezeAvailable: !run.frozen.some(d => mondayOf(d) === thisWeek), frozenDays: run.frozen };
}

// ---- Review cards (spaced retrieval) -------------------------------------------------------------------

const intervals = [1, 3, 7] as const;
const hardIntervals = [1, 2, 4] as const;
const after = (iso: string, days: number) => new Date(time(iso) + days * 86_400_000).toISOString();
const itemKey = (i: { caseId: string; factId: string }) => `${i.caseId}/${i.factId}`;

/** Applies one self-rating to a queue item; null means the item graduated (three successful steps). */
export function rateReview(item: ReviewItem, rating: ReviewRating, at: string): ReviewItem | null {
  if (rating === "again") return { ...item, stage: 0, due: after(at, intervals[0]) };
  if (rating === "hard") return { ...item, due: after(at, hardIntervals[Math.min(item.stage, 2)]!) };
  const stage = item.stage + (rating === "easy" ? 2 : 1);
  return stage >= 3 ? null : { ...item, stage, due: after(at, intervals[stage]!) };
}
/**
 * The scheduler's queue with review ratings applied on top. The profile rebuilds its queue from sessions,
 * so ratings live in the game log; a rating older than a later interview on the same fact is superseded.
 */
export function effectiveQueue(profile: LearnerProfile, game: GameState): ReviewItem[] {
  const queue = new Map(profile.reviewQueue.map(item => [itemKey(item), { ...item }]));
  for (const entry of [...game.reviews].sort((a, b) => a.at.localeCompare(b.at))) {
    const item = queue.get(itemKey(entry));
    if (!item) continue;
    if (profile.sessions.some(s => s.caseId === entry.caseId && s.completedAt > entry.at && s.outcome?.redFlags.some(f => f.factId === entry.factId))) continue;
    const next = rateReview(item, entry.rating, entry.at);
    if (next) queue.set(itemKey(entry), next); else queue.delete(itemKey(entry));
  }
  return [...queue.values()].sort((a, b) => a.due.localeCompare(b.due) || itemKey(a).localeCompare(itemKey(b)));
}

export interface ReviewSource { id: string; title: string; facts: { id: string; lay: string; revealWhen?: string }[] }
export interface ReviewCard { caseId: string; factId: string; caseTitle: string; label: string; prompt: string; revealWhen: string; lay: string; stage: number }
export const reviewSetSize = 3;
/** Up to three due red-flag cards, most overdue first, spread across cases when possible. */
export function dailyReviewCards(profile: LearnerProfile, game: GameState, cases: ReviewSource[], now: string, size = reviewSetSize): ReviewCard[] {
  const due = effectiveQueue(profile, game).filter(item => time(item.due) <= time(now));
  const picked: ReviewItem[] = [];
  for (const spread of [true, false]) {
    for (const item of due) {
      if (picked.length >= size || picked.includes(item)) continue;
      if (spread && picked.some(p => p.caseId === item.caseId)) continue;
      picked.push(item);
    }
  }
  const cards: ReviewCard[] = [];
  for (const item of picked) {
    const source = cases.find(c => c.id === item.caseId);
    const fact = source?.facts.find(f => f.id === item.factId);
    if (!source || !fact) continue;
    cards.push({
      caseId: item.caseId, factId: item.factId, caseTitle: source.title, label: item.label, stage: item.stage,
      prompt: "Which question would uncover this?",
      revealWhen: fact.revealWhen ?? "Ask directly and specifically about this safety topic.",
      lay: fact.lay,
    });
  }
  return cards;
}
export function addReview(game: GameState, entry: ReviewLogEntry): GameState {
  return { ...game, reviews: [...game.reviews, entry].sort((a, b) => a.at.localeCompare(b.at)).slice(-maxReviewLog) };
}

// ---- Badges --------------------------------------------------------------------------------------------

export interface Badge { id: string; title: string; description: string; icon: "stethoscope" | "flag" | "speech" | "people" | "flame" | "target" | "cards" }
export const badges: Badge[] = [
  { id: "first_interview", title: "First interview", description: "Finish an interview and get your coach report.", icon: "stethoscope" },
  { id: "red_flag_hunter", title: "Red-flag hunter", description: "Find every red flag in three different interviews.", icon: "flag" },
  { id: "cc_communicator", title: "Calgary-Cambridge communicator", description: "Show all six communication skills, with at least three rated 2/2, in one interview.", icon: "speech" },
  { id: "same_facts_different_person", title: "Same facts, different person", description: "Interview the same case with two different patient personalities.", icon: "people" },
  { id: "streak_7", title: "7-day streak", description: "Meet the daily goal seven days in a row.", icon: "flame" },
  { id: "calibrated", title: "Calibrated", description: "Keep your confidence within 20 points of your performance in three interviews.", icon: "target" },
  { id: "memory_keeper", title: "Memory keeper", description: "Complete ten red-flag review cards.", icon: "cards" },
];
export const badgeById = (id: string) => badges.find(b => b.id === id);

export function earnedBadgeIds(profile: LearnerProfile, game: GameState, now: string): string[] {
  const scored = profile.sessions.filter(s => s.outcome);
  const outcome = (s: SessionResult) => s.outcome!;
  const personalitiesByCase = new Map<string, Set<string>>();
  for (const s of scored) personalitiesByCase.set(s.caseId, (personalitiesByCase.get(s.caseId) ?? new Set()).add(s.personalityId));
  const rules: Record<string, boolean> = {
    first_interview: scored.length >= 1,
    red_flag_hunter: scored.filter(s => outcome(s).redFlags.length > 0 && outcome(s).redFlags.every(f => f.found)).length >= 3,
    cc_communicator: scored.some(s => communicationSkills.every(k => outcome(s).communication[k] >= 1) && communicationSkills.filter(k => outcome(s).communication[k] >= 2).length >= 3),
    same_facts_different_person: [...personalitiesByCase.values()].some(set => set.size >= 2),
    streak_7: streakFor(profile, game, now).longest >= 7,
    calibrated: scored.filter(s => Math.abs(clamp((s.reflection.confidence - 1) / 4) - performance(outcome(s))) <= .2).length >= 3,
    memory_keeper: game.reviews.length >= 10,
  };
  return badges.filter(b => rules[b.id]).map(b => b.id);
}
/** Records newly earned badges. Earned badges are never removed, even if the underlying data later changes. */
export function syncBadges(profile: LearnerProfile, game: GameState, now: string): { game: GameState; unlocked: Badge[] } {
  const unlocked = earnedBadgeIds(profile, game, now).filter(id => !game.badges[id]).map(id => badgeById(id)!);
  if (!unlocked.length) return { game, unlocked };
  return { game: { ...game, badges: { ...game.badges, ...Object.fromEntries(unlocked.map(b => [b.id, now])) } }, unlocked };
}

// ---- Summary and rewards -------------------------------------------------------------------------------

export interface GameSummary { xp: number; level: LevelInfo; weeklyXp: number; goal: DailyGoal; streak: StreakInfo; badgeIds: string[] }
export function summarize(profile: LearnerProfile, game: GameState, now: string): GameSummary {
  const synced = syncBadges(profile, game, now).game;
  return { xp: totalXp(profile, game), level: levelInfo(totalXp(profile, game)), weeklyXp: weeklyXp(profile, game, now), goal: dailyGoalFor(profile, game, now), streak: streakFor(profile, game, now), badgeIds: Object.keys(synced.badges) };
}
export interface Reward { xp: XpBreakdown; levelBefore: number; levelAfter: number; streakBefore: number; streakAfter: number; goalJustMet: boolean; newBadges: Badge[]; game: GameState }
/** What one finished interview earned. `before` and `after` are the profile without and with `result`. */
export function rewardFor(before: LearnerProfile, after: LearnerProfile, game: GameState, result: SessionResult, now: string): Reward {
  const synced = syncBadges(after, game, now);
  return {
    xp: sessionXp(result),
    levelBefore: levelInfo(totalXp(before, game)).level, levelAfter: levelInfo(totalXp(after, game)).level,
    streakBefore: streakFor(before, game, now).current, streakAfter: streakFor(after, game, now).current,
    goalJustMet: !dailyGoalFor(before, game, now).met && dailyGoalFor(after, game, now).met,
    newBadges: synced.unlocked, game: synced.game,
  };
}
