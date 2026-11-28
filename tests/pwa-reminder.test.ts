import assert from "node:assert/strict";
import test from "node:test";
import { decodeReminder, defaultReminder, reminderDue } from "../components/pwa-reminder.ts";
import { dailyGoalFor, dayKey, emptyGame } from "../lib/engine/gamification.ts";
import { emptyProfile, updateProfile } from "../lib/engine/learner.ts";

test("reminders require explicit opt-in and valid local preferences", () => {
  for (const raw of [null, "null", "broken", "[]", '{"version":2,"enabled":true,"time":"18:00"}', '{"version":1,"enabled":true,"time":"24:00"}', '{"version":1,"enabled":"yes","time":"18:00"}']) {
    assert.deepEqual(decodeReminder(raw), defaultReminder);
  }
  assert.deepEqual(decodeReminder('{"version":1,"enabled":true,"time":"07:30","lastNotified":"2026-11-27","extra":"discard"}'), { version: 1, enabled: true, time: "07:30", lastNotified: "2026-11-27" });
  assert.equal(reminderDue(defaultReminder, new Date(2026, 10, 28, 19), false), false);
});

test("an open or reopened app sends at the local time, at most once that day", () => {
  const settings = { ...defaultReminder, enabled: true };
  assert.equal(reminderDue(settings, new Date(2026, 10, 28, 17, 59), false), false);
  assert.equal(reminderDue(settings, new Date(2026, 10, 28, 18), false), true);
  const late = new Date(2026, 10, 28, 23, 59);
  assert.equal(reminderDue(settings, late, false), true, "catch up when reopened after the scheduled time");
  const sent = { ...settings, lastNotified: dayKey(late.toISOString()) };
  assert.equal(reminderDue(sent, late, false), false);
  assert.equal(reminderDue({ ...sent, enabled: false }, late, false), false);
  assert.equal(reminderDue({ ...sent, time: "17:00" }, late, false), false, "changing the time does not send twice");
  assert.equal(reminderDue(sent, new Date(2026, 10, 29, 0), false), false);
  assert.equal(reminderDue(sent, new Date(2026, 10, 29, 18), false), true);
  assert.equal(reminderDue(settings, new Date("invalid"), false), false);
});

test("meeting the real daily goal via an interview or three reviews suppresses reminders", () => {
  const now = new Date(2026, 10, 28, 19);
  const at = now.toISOString();
  const settings = { ...defaultReminder, enabled: true };
  const profile = updateProfile(emptyProfile(), { id: "one", caseId: "synthetic", personalityId: "calm", completedAt: at, reflection: { confidence: 3, concern: "Explore concerns" } });
  assert.equal(reminderDue(settings, now, dailyGoalFor(profile, emptyGame(), at).met), false);
  const game = emptyGame();
  game.reviews = [1, 2, 3].map(n => ({ at, caseId: "synthetic", factId: `flag-${n}`, rating: "good" }));
  assert.equal(reminderDue(settings, now, dailyGoalFor(emptyProfile(), game, at).met), false);
  game.reviews.pop();
  assert.equal(reminderDue(settings, now, dailyGoalFor(emptyProfile(), game, at).met), true);
});
