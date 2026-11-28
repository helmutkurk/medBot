import assert from "node:assert/strict";
import test from "node:test";
import { communicationSkills } from "../lib/case/types.ts";
import type { CaseSummary } from "../lib/case/types.ts";
import { adaptationsActive, difficultyFor, domains, emptyProfile, recommendNext, updateProfile } from "../lib/engine/learner.ts";
import type { SessionResult } from "../lib/engine/learner.ts";

function result(id = "1", day = "2026-01-01", found = false, score = 20): SessionResult {
  return { id, caseId: "a", personalityId: "cooperative", completedAt: `${day}T12:00:00.000Z`, reflection: { concern: "A synthetic concern", confidence: 5 }, outcome: { score, coverage: [{ category: "history", found: score / 10, total: 10 }], communication: Object.fromEntries(communicationSkills.map(s => [s, score / 50])) as Record<typeof communicationSkills[number], number>, redFlags: [{ factId: "safety", label: "Safety question", found }] } };
}
const a: CaseSummary & { facts: { category: "history" }[] } = { id: "a", title: "Case A", patient: { name: "Synthetic A", age: 30, sex: "other", job: "Teacher", lives_with: "Family" }, factCount: 10, facts: [{ category: "history" }], personalities: [{ id: "reserved", label: "Reserved", voice: "ash" }, { id: "cooperative", label: "Cooperative", voice: "coral" }] };
const b = { ...a, id: "b", title: "Case B" };

test("learner stores reflection before feedback, updates EMA and calibration without mutating or double counting", () => {
  const empty = emptyProfile();
  const first = result();
  const pending = updateProfile(empty, { ...first, outcome: undefined });
  assert.equal(pending.sessions.length, 1);
  assert.equal(pending.calibration.count, 0);
  const profile = updateProfile(pending, first);
  assert.equal(empty.sessions.length, 0);
  assert.equal(profile.domainMastery.history.value, .2);
  assert.equal(profile.domainMastery.ice.value, .2);
  assert.equal(profile.domainMastery.empathy.count, 1);
  assert.equal(profile.calibration.meanAbsoluteError, .9);
  assert.equal(profile.calibration.meanBias, .9);
  assert.equal(profile.calibration.highConfidenceMisses, 1);
  assert.deepEqual(updateProfile(profile, first), profile);
  const next = updateProfile(profile, result("2", "2026-01-02", true, 100));
  assert.equal(next.domainMastery.history.count, 2);
  assert.equal(next.domainMastery.history.value, .65 * .2 + .35);
  assert.equal(next.calibration.count, 2);
  assert.equal(next.calibration.meanAbsoluteError, .45);
});

test("missed red flags follow 1, 3 and 7 day spacing then graduate after due retrieval", () => {
  let p = updateProfile(emptyProfile(), result());
  assert.equal(p.reviewQueue[0]?.due, "2026-01-02T12:00:00.000Z");
  const early = updateProfile(p, result("early", "2026-01-01", true));
  assert.deepEqual(early.reviewQueue, p.reviewQueue);
  p = updateProfile(p, result("2", "2026-01-02", true));
  assert.equal(p.reviewQueue[0]?.stage, 1);
  assert.equal(p.reviewQueue[0]?.due, "2026-01-05T12:00:00.000Z");
  p = updateProfile(p, result("3", "2026-01-05", true));
  assert.equal(p.reviewQueue[0]?.due, "2026-01-12T12:00:00.000Z");
  assert.equal(p.reviewQueue[0]?.stage, 2);
  p = updateProfile(p, result("4", "2026-01-12", true));
  assert.deepEqual(p.reviewQueue, []);
});

test("a missed review resets spacing; review facts are scoped to the case", () => {
  let p = updateProfile(emptyProfile(), result());
  p = updateProfile(p, result("2", "2026-01-02", true));
  p = updateProfile(p, { ...result("other", "2026-01-05", true), caseId: "b" });
  assert.equal(p.reviewQueue[0]?.stage, 1);
  p = updateProfile(p, result("3", "2026-01-06", false));
  assert.equal(p.reviewQueue[0]?.stage, 0);
  assert.equal(p.reviewQueue[0]?.due, "2026-01-07T12:00:00.000Z");
});

test("recommendations interleave even when the last case has due reviews, then prioritise due cases", () => {
  let p = updateProfile(emptyProfile(), result());
  const first = recommendNext(p, [a, b], "2026-01-03T00:00:00Z")!;
  assert.equal(first.caseId, "b");
  assert.ok(first.reasons.some(r => r.includes("interleave")));
  assert.ok(first.reasons.some(r => r.includes("remain queued")));
  p = updateProfile(p, { ...result("2", "2026-01-02", true), caseId: "b" });
  const next = recommendNext(p, [a, b], "2026-01-03T00:00:00Z")!;
  assert.equal(next.caseId, "a");
  assert.ok(next.reasons.some(r => r.includes("reviews due")));
  assert.equal(next.goals.length, 2);
  assert.equal(recommendNext(p, [], "2026-01-03"), null);
  assert.equal(recommendNext(p, [b])?.caseId, "b");
  assert.deepEqual(recommendNext(p, [a, b]), recommendNext(p, [a, b]));
});

test("weak category practice guides case selection when no reviews are due", () => {
  const p = emptyProfile();
  for (const d of domains) p.domainMastery[d] = { value: 1, count: 1 };
  p.domainMastery.history = { value: 0, count: 1 };
  const other = { ...b, facts: [{ category: "social" as const }] };
  assert.equal(recommendNext(p, [other, a])?.caseId, "a");
});

test("difficulty ladder requires sustained mastery and safety; scaffolds fade for stronger learners", () => {
  let p = emptyProfile();
  assert.equal(recommendNext(p, [a])?.personalityId, "cooperative");
  for (let n = 1; n <= 2; n++) p = updateProfile(p, result(String(n), `2026-01-0${n}`, true, 100));
  assert.equal(difficultyFor(p), "supported");
  p = updateProfile(p, result("3", "2026-01-03", true, 100));
  assert.equal(difficultyFor(p), "challenge");
  assert.equal(recommendNext(p, [a])?.personalityId, "reserved");
  assert.ok(recommendNext(p, [a])?.goals.every(g => g.includes("independently")));
  p.domainMastery.history.value = .75;
  for (const d of domains) if (p.domainMastery[d].count) p.domainMastery[d].value = .75;
  assert.equal(difficultyFor(p), "stretch");
  p.domainMastery.red_flags.value = .4;
  assert.equal(difficultyFor(p), "supported");
});

test("adaptations explain goals, interleaving, spacing, difficulty, calibration and stable patients", () => {
  const text = adaptationsActive(emptyProfile()).join(" ");
  for (const term of ["coach focus", "interleave", "1, 3 and 7", "cooperative", "confidence", "stay fixed"]) assert.ok(text.includes(term), term);
  assert.ok(adaptationsActive(emptyProfile()).every(line => line.length > 40));
});
