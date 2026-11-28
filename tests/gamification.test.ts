import assert from "node:assert/strict";
import test from "node:test";
import { addReview, badges, dailyReviewCards, earnedBadgeIds, effectiveQueue, emptyGame, levelInfo, rateReview, rewardFor, sessionXp, streakFor, syncBadges, totalXp, weeklyXp, xpForLevel } from "../lib/engine/gamification.ts";
import type { GameState } from "../lib/engine/gamification.ts";
import { communicationSkills } from "../lib/case/types.ts";
import { emptyProfile, updateProfile } from "../lib/engine/learner.ts";
import type { SessionResult } from "../lib/engine/learner.ts";

const local = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour).toISOString();
const comms = (value: number) => Object.fromEntries(communicationSkills.map(s => [s, value])) as Record<typeof communicationSkills[number], number>;
function session(id: string, at: string, over: Partial<SessionResult> & { found?: boolean[]; score?: number; skills?: number; confidence?: number } = {}): SessionResult {
  const flags = over.found ?? [true, true];
  return {
    id, caseId: over.caseId ?? "case-a", personalityId: over.personalityId ?? "calm", completedAt: at,
    reflection: { concern: "Synthetic concern", confidence: over.confidence ?? 3 },
    outcome: { score: over.score ?? 80, coverage: [{ category: "symptom", found: 4, total: 5 }, { category: "history", found: 1, total: 1 }], communication: comms(over.skills ?? 1), redFlags: flags.map((found, i) => ({ factId: `flag_${i}`, label: `Flag ${i}`, found })) },
  };
}
const build = (...sessions: SessionResult[]) => sessions.reduce((p, s) => updateProfile(p, s), emptyProfile());

test("session XP comes only from real results and is bounded", () => {
  const xp = sessionXp(session("a", local(1, 5), { score: 80, skills: 1, found: [true, true], confidence: 4 }));
  // base 20, coverage 5/6 of 40, flags 2 x 10 + 10 all-found bonus, six skills x 3, confidence 0.75 vs performance 0.9 is within 0.2
  assert.deepEqual(xp, { base: 20, coverage: 33, redFlags: 30, communication: 18, calibration: 15, total: 116 });
  assert.equal(sessionXp({ ...session("b", local(1, 5)), outcome: undefined }).total, 10);
  const miss = sessionXp(session("c", local(1, 5), { found: [false, false], skills: 0, confidence: 5, score: 20 }));
  assert.equal(miss.redFlags, 0);
  assert.equal(miss.calibration, 0, "overconfidence earns no calibration bonus");
  const best = sessionXp(session("d", local(1, 5), { skills: 2, found: [true, true, true, true, true, true, true] }));
  assert.ok(best.redFlags <= 50 && best.communication === 36);
});

test("levels follow a gentle monotonic curve", () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(xpForLevel(2) - 1).level, 1);
  assert.equal(levelInfo(xpForLevel(2)).level, 2);
  assert.equal(levelInfo(10 ** 7).level, 50);
  assert.equal(levelInfo(10 ** 7).ceiling, null);
  for (let level = 2; level < 50; level++) assert.ok(xpForLevel(level + 1) - xpForLevel(level) >= xpForLevel(level) - xpForLevel(level - 1), "increments never shrink");
  assert.ok(xpForLevel(2) <= 60, "first level-up needs about one interview");
  const mid = levelInfo(100);
  assert.ok(mid.progress > 0 && mid.progress < 1 && mid.floor <= 100);
});

test("daily goal and streak: one interview or three cards, one freeze per week", () => {
  const profile = build(session("1", local(3, 2)), session("2", local(3, 3)), session("3", local(3, 5)), session("4", local(3, 6)));
  // Mon 2, Tue 3, (Wed 4 missed, bridged by the weekly freeze), Thu 5, Fri 6
  const now = local(3, 6, 20);
  const streak = streakFor(profile, emptyGame(), now);
  assert.equal(streak.current, 4);
  assert.deepEqual(streak.frozenDays.length, 1);
  assert.equal(streak.freezeAvailable, false);
  assert.equal(streak.todayDone, true);
  // Two missed days in a row break it.
  const broken = build(session("1", local(3, 2)), session("2", local(3, 5)));
  assert.equal(streakFor(broken, emptyGame(), local(3, 5, 20)).current, 1);
  // A second miss in the same week cannot be frozen again.
  const twice = build(session("1", local(3, 2)), session("2", local(3, 4)), session("3", local(3, 6)));
  assert.equal(streakFor(twice, emptyGame(), local(3, 6, 20)).current, 2, "Mar 6 and Mar 4 count; Mar 5 was frozen; Mar 3 cannot be frozen too");
  // Today still open: yesterday keeps the streak alive.
  assert.equal(streakFor(profile, emptyGame(), local(3, 7, 9)).current, 4);
  // Three review cards meet the goal, two do not.
  let game: GameState = emptyGame();
  for (const i of [0, 1]) game = addReview(game, { at: local(3, 9, 9 + i), caseId: "c", factId: `f${i}`, rating: "good" });
  assert.equal(streakFor(emptyProfile(), game, local(3, 9, 20)).current, 0);
  game = addReview(game, { at: local(3, 9, 12), caseId: "c", factId: "f2", rating: "easy" });
  assert.equal(streakFor(emptyProfile(), game, local(3, 9, 20)).current, 1);
});

test("badge rules unlock only from real evidence", () => {
  const none = earnedBadgeIds(emptyProfile(), emptyGame(), local(3, 1));
  assert.deepEqual(none, []);
  const first = build(session("1", local(3, 1), { found: [false] }));
  assert.deepEqual(earnedBadgeIds(first, emptyGame(), local(3, 1)), ["first_interview"]);
  const hunter = build(session("1", local(3, 1)), session("2", local(3, 2), { caseId: "case-b" }), session("3", local(3, 3), { caseId: "case-c" }));
  assert.ok(earnedBadgeIds(hunter, emptyGame(), local(3, 3)).includes("red_flag_hunter"));
  assert.ok(!earnedBadgeIds(build(session("1", local(3, 1)), session("2", local(3, 2), { found: [true, false] })), emptyGame(), local(3, 2)).includes("red_flag_hunter"));
  assert.ok(earnedBadgeIds(build(session("1", local(3, 1), { skills: 2 })), emptyGame(), local(3, 1)).includes("cc_communicator"));
  assert.ok(!earnedBadgeIds(build(session("1", local(3, 1), { skills: 1 })), emptyGame(), local(3, 1)).includes("cc_communicator"));
  const people = build(session("1", local(3, 1), { personalityId: "calm" }), session("2", local(3, 2), { personalityId: "anxious" }));
  assert.ok(earnedBadgeIds(people, emptyGame(), local(3, 2)).includes("same_facts_different_person"));
  assert.ok(!earnedBadgeIds(build(session("1", local(3, 1)), session("2", local(3, 2), { caseId: "case-b", personalityId: "anxious" })), emptyGame(), local(3, 2)).includes("same_facts_different_person"));
  const week = build(...Array.from({ length: 7 }, (_, i) => session(`s${i}`, local(3, 2 + i))));
  assert.ok(earnedBadgeIds(week, emptyGame(), local(3, 8, 20)).includes("streak_7"));
  const calibrated = build(...[1, 2, 3].map(i => session(`s${i}`, local(3, i), { confidence: 4, score: 85 })));
  assert.ok(earnedBadgeIds(calibrated, emptyGame(), local(3, 3)).includes("calibrated"));
  assert.ok(!earnedBadgeIds(build(...[1, 2, 3].map(i => session(`s${i}`, local(3, i), { confidence: 5, score: 20, found: [false, false] }))), emptyGame(), local(3, 3)).includes("calibrated"));
  let game = emptyGame();
  for (let i = 0; i < 10; i++) game = addReview(game, { at: local(3, 1, 8 + i), caseId: "c", factId: `f${i}`, rating: "good" });
  assert.ok(earnedBadgeIds(emptyProfile(), game, local(3, 1, 23)).includes("memory_keeper"));
  assert.equal(new Set(badges.map(b => b.id)).size, badges.length);
});

test("badges are recorded once and kept", () => {
  const profile = build(session("1", local(3, 1)));
  const first = syncBadges(profile, emptyGame(), local(3, 1));
  assert.deepEqual(first.unlocked.map(b => b.id), ["first_interview"]);
  const again = syncBadges(profile, first.game, local(3, 2));
  assert.deepEqual(again.unlocked, []);
  assert.equal(again.game.badges.first_interview, local(3, 1));
});

test("weekly XP counts this Monday-to-Sunday UTC week only", () => {
  const profile = build(session("old", "2026-03-01T12:00:00Z"), session("mon", "2026-03-02T00:30:00Z"), session("sun", "2026-03-08T23:30:00Z"), session("next", "2026-03-09T00:30:00Z"));
  const each = sessionXp(profile.sessions[0]!).total;
  const game = addReview(emptyGame(), { at: "2026-03-04T10:00:00Z", caseId: "c", factId: "f", rating: "good" });
  assert.equal(weeklyXp(profile, game, "2026-03-05T12:00:00Z"), 2 * each + 5);
  assert.equal(totalXp(profile, game), 4 * each + 5);
});

test("review ratings reschedule items and feed the queue without mutating the profile", () => {
  const miss = build(session("1", "2026-03-02T12:00:00Z", { found: [false, true] }));
  assert.deepEqual(miss.reviewQueue.map(r => [r.factId, r.stage, r.due.slice(0, 10)]), [["flag_0", 0, "2026-03-03"]]);
  const item = miss.reviewQueue[0]!;
  const at = "2026-03-03T09:00:00.000Z";
  assert.equal(rateReview(item, "again", at)!.due.slice(0, 10), "2026-03-04");
  assert.equal(rateReview(item, "hard", at)!.stage, 0);
  assert.deepEqual([rateReview(item, "good", at)!.stage, rateReview(item, "good", at)!.due.slice(0, 10)], [1, "2026-03-06"]);
  assert.equal(rateReview(item, "easy", at)!.stage, 2);
  assert.equal(rateReview({ ...item, stage: 2 }, "good", at), null);
  const game = addReview(emptyGame(), { at, caseId: "case-a", factId: "flag_0", rating: "good" });
  assert.equal(effectiveQueue(miss, game)[0]!.stage, 1);
  assert.equal(miss.reviewQueue[0]!.stage, 0);
  // A later interview that misses the same fact supersedes the earlier rating.
  const missedAgain = updateProfile(miss, session("2", "2026-03-10T12:00:00Z", { found: [false, true] }));
  assert.equal(effectiveQueue(missedAgain, game)[0]!.stage, 0);
});

test("daily review cards: up to three due items spread across cases, with model answers from the case", () => {
  const profile = build(
    session("1", "2026-03-02T12:00:00Z", { caseId: "case-a", found: [false, false] }),
    session("2", "2026-03-02T13:00:00Z", { caseId: "case-b", found: [false] }),
    session("3", "2026-03-02T14:00:00Z", { caseId: "case-c", found: [false] }),
  );
  const cases = ["case-a", "case-b", "case-c"].map(id => ({ id, title: id.toUpperCase(), facts: [0, 1].map(i => ({ id: `flag_${i}`, lay: `lay ${id} ${i}`, revealWhen: `asked about ${i}` })) }));
  const now = "2026-03-04T08:00:00Z";
  const cards = dailyReviewCards(profile, emptyGame(), cases, now);
  assert.equal(cards.length, 3);
  assert.deepEqual(new Set(cards.map(c => c.caseId)).size, 3);
  assert.equal(cards[0]!.prompt, "Which question would uncover this?");
  assert.match(cards[0]!.revealWhen, /^asked about/);
  assert.match(cards[0]!.lay, /^lay case-/);
  assert.equal(dailyReviewCards(profile, emptyGame(), cases, "2026-03-02T15:00:00Z").length, 0, "nothing is due the same day");
  assert.equal(dailyReviewCards(profile, emptyGame(), [], now).length, 0);
});

test("reward summarises XP, level, streak and new badges for one interview", () => {
  const before = emptyProfile();
  const result = session("1", local(3, 1), { skills: 2 });
  const after = updateProfile(before, result);
  const reward = rewardFor(before, after, emptyGame(), result, local(3, 1, 20));
  assert.equal(reward.xp.total, sessionXp(result).total);
  assert.equal(reward.streakBefore, 0);
  assert.equal(reward.streakAfter, 1);
  assert.equal(reward.goalJustMet, true);
  assert.ok(reward.levelAfter > reward.levelBefore);
  assert.deepEqual(reward.newBadges.map(b => b.id).sort(), ["cc_communicator", "first_interview"]);
  assert.deepEqual(Object.keys(reward.game.badges).sort(), ["cc_communicator", "first_interview"]);
});
