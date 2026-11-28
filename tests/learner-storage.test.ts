import assert from "node:assert/strict";
import test from "node:test";
import { decodeProfile, learnerStorageKey, loadProfile, persistProfile, resetProfile } from "../components/learner-storage.ts";
import { emptyProfile, updateProfile } from "../lib/engine/learner.ts";

const profile = updateProfile(emptyProfile(), { id: "session", caseId: "synthetic", personalityId: "cooperative", completedAt: "2026-01-01T12:00:00Z", reflection: { concern: "Synthetic clinical concern", confidence: 3 } });

test("versioned learner storage round-trips summaries and rebuilds derived state", () => {
  const poisoned = { ...profile, domainMastery: {}, reviewQueue: [{ patientName: "Must not be used" }] };
  assert.deepEqual(decodeProfile(JSON.stringify(poisoned)), profile);
  for (const raw of ["oops", "null", "{}", JSON.stringify({ version: 2, sessions: [] }), JSON.stringify({ version: 1, sessions: [{ ...profile.sessions[0], reflection: { concern: "", confidence: 6 } }] }), JSON.stringify({ version: 1, sessions: [{ ...profile.sessions[0], outcome: { coverage: [] } }] })]) assert.throws(() => decodeProfile(raw));
});

test("storage failure is safe and keeps a memory profile; reset removes only the versioned key", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window"); });
  const values = new Map<string, string>();
  let unavailable = false;
  let writesBlocked = false;
  const storage = {
    getItem(key: string) { if (unavailable) throw new Error("Blocked"); return values.get(key) ?? null; },
    setItem(key: string, value: string) { if (unavailable || writesBlocked) throw new Error("Full"); values.set(key, value); },
    removeItem(key: string) { if (unavailable) throw new Error("Blocked"); values.delete(key); },
  };
  Object.defineProperty(globalThis, "window", { value: { localStorage: storage }, configurable: true });
  resetProfile();
  assert.equal(persistProfile(profile), true);
  assert.ok(values.has(learnerStorageKey));
  assert.deepEqual(loadProfile(), { profile, persistent: true });
  writesBlocked = true;
  const newer = updateProfile(profile, { ...profile.sessions[0]!, id: "second" });
  assert.equal(persistProfile(newer), false);
  // A quota failure must not reload an older but still readable stored profile.
  assert.deepEqual(loadProfile(), { profile: newer, persistent: false });
  writesBlocked = false;
  unavailable = true;
  assert.equal(persistProfile(profile), false);
  assert.deepEqual(loadProfile(), { profile, persistent: false });
  assert.equal(resetProfile(), false);
  assert.deepEqual(loadProfile().profile, emptyProfile());
  unavailable = false;
  values.set("unrelated", "keep");
  assert.equal(resetProfile(), true);
  assert.equal(values.has(learnerStorageKey), false);
  assert.equal(values.get("unrelated"), "keep");
  values.set(learnerStorageKey, "corrupt");
  assert.equal(loadProfile().persistent, false);
});
