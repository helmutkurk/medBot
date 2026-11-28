import { communicationSkills } from "../lib/case/types.ts";
import { emptyProfile, updateProfile } from "../lib/engine/learner.ts";
import type { LearnerProfile, SessionResult } from "../lib/engine/learner.ts";

export const learnerStorageKey = "medbot.learner.v1";
let memory = emptyProfile();
let unsaved = false;
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
const text = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const finite = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
function session(v: unknown): v is SessionResult {
  if (!record(v) || !text(v.id) || !text(v.caseId) || !text(v.personalityId) || !text(v.completedAt) || !Number.isFinite(Date.parse(v.completedAt))
    || !record(v.reflection) || !text(v.reflection.concern, 240) || !finite(v.reflection.confidence, 5) || v.reflection.confidence < 1 || !Number.isInteger(v.reflection.confidence)) return false;
  if (v.outcome === undefined) return true;
  const o = v.outcome;
  return record(o) && finite(o.score, 100) && Array.isArray(o.coverage) && o.coverage.length <= 8 && o.coverage.every(row => record(row) && ["complaint", "symptom", "history", "medication", "allergy", "family", "social", "lifestyle"].includes(String(row.category)) && finite(row.total, 100) && row.total > 0 && finite(row.found, row.total))
    && record(o.communication) && communicationSkills.every(skill => record(o.communication) && finite(o.communication[skill], 2))
    && Array.isArray(o.redFlags) && o.redFlags.length <= 100 && o.redFlags.every(f => record(f) && text(f.factId) && text(f.label, 500) && typeof f.found === "boolean");
}
export function decodeProfile(raw: string): LearnerProfile {
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1 || !Array.isArray(value.sessions) || value.sessions.length > 2000 || !value.sessions.every(session)) throw new Error("Unsupported learner data.");
  let profile = emptyProfile();
  for (const result of value.sessions) profile = updateProfile(profile, result);
  return profile;
}
export function loadProfile(): { profile: LearnerProfile; persistent: boolean } {
  if (unsaved) return { profile: memory, persistent: false };
  try {
    const raw = window.localStorage.getItem(learnerStorageKey);
    if (raw) memory = decodeProfile(raw);
    else memory = emptyProfile();
    return { profile: memory, persistent: true };
  } catch { return { profile: memory, persistent: false }; }
}
export function persistProfile(profile: LearnerProfile): boolean {
  memory = profile;
  unsaved = true;
  try { window.localStorage.setItem(learnerStorageKey, JSON.stringify(profile)); unsaved = false; return true; }
  catch { return false; }
}
export function resetProfile(): boolean {
  memory = emptyProfile();
  unsaved = true;
  try { window.localStorage.removeItem(learnerStorageKey); unsaved = false; return true; }
  catch { return false; }
}
