import assert from "node:assert/strict";
import test from "node:test";
import { backfillGame, decodeGame, gameStorageKey, loadGame, persistGame, resetGame } from "../components/learner-storage.ts";
import { emptyGame } from "../lib/engine/gamification.ts";
import { emptyProfile, updateProfile } from "../lib/engine/learner.ts";

const entry = { at: "2026-03-02T10:00:00.000Z", caseId: "case-a", factId: "flag_0", rating: "good" };

test("game state decoding keeps valid data, drops malformed entries and rejects unknown versions", () => {
  const raw = JSON.stringify({ version: 1, nickname: "Quiet Otter", reviews: [entry, { ...entry, rating: "perfect" }, { ...entry, at: "never" }, "x"], badges: { first_interview: "2026-03-02T10:00:00.000Z", made_up: "2026-03-02T10:00:00.000Z", streak_7: "bad" }, extra: { patient: "Must not survive" } });
  const game = decodeGame(raw);
  assert.deepEqual(game, { version: 1, nickname: "Quiet Otter", reviews: [entry], badges: { first_interview: "2026-03-02T10:00:00.000Z" } });
  assert.ok(!("extra" in game));
  assert.equal(decodeGame(JSON.stringify({ version: 1, nickname: "x" })).nickname, null, "an invalid nickname opts the learner out");
  for (const bad of ["oops", "null", "[]", JSON.stringify({ version: 2 }), JSON.stringify({ reviews: [] })]) assert.throws(() => decodeGame(bad));
});

test("first run with existing interviews backfills badges silently; storage failures stay in memory", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window"); });
  const values = new Map<string, string>();
  let blocked = false;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (k: string) => { if (blocked) throw new Error("blocked"); return values.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (blocked) throw new Error("full"); values.set(k, v); },
    removeItem: (k: string) => { if (blocked) throw new Error("blocked"); values.delete(k); },
  } } });
  resetGame();
  const profile = updateProfile(emptyProfile(), { id: "s", caseId: "case-a", personalityId: "calm", completedAt: "2026-03-02T10:00:00.000Z", reflection: { concern: "c", confidence: 3 }, outcome: { score: 70, coverage: [{ category: "symptom", found: 1, total: 2 }], communication: { open_questions: 1, active_listening_summarising: 1, empathy: 1, ice_exploration: 1, signposting: 1, jargon_avoidance: 1 }, redFlags: [] } });
  const migrated = loadGame(profile, "2026-03-03T00:00:00.000Z");
  assert.deepEqual(migrated, { game: backfillGame(profile, emptyGame(), "2026-03-03T00:00:00.000Z"), persistent: true });
  assert.deepEqual(Object.keys(migrated.game.badges), ["first_interview"]);
  assert.equal(values.has(gameStorageKey), false, "loading alone does not write");
  assert.equal(persistGame({ ...migrated.game, nickname: "Quiet Otter" }), true);
  assert.equal(loadGame(profile).game.nickname, "Quiet Otter");
  blocked = true;
  assert.equal(persistGame({ ...migrated.game, nickname: "Other Otter" }), false);
  assert.deepEqual(loadGame(profile), { game: { ...migrated.game, nickname: "Other Otter" }, persistent: false });
  blocked = false;
  assert.equal(resetGame(), true);
  assert.equal(loadGame(profile).game.nickname, null);
});
