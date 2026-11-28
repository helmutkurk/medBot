import { dayKey } from "../lib/engine/gamification.ts";

export const reminderStorageKey = "medbot.reminder.v1";
export interface ReminderSettings { version: 1; enabled: boolean; time: string; lastNotified: string | null }
export const defaultReminder: ReminderSettings = { version: 1, enabled: false, time: "18:00", lastNotified: null };
const validTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function decodeReminder(raw: string | null): ReminderSettings {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
      || !("enabled" in value) || typeof value.enabled !== "boolean" || !("time" in value) || !validTime(value.time)) return { ...defaultReminder };
    const last = "lastNotified" in value && typeof value.lastNotified === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.lastNotified) ? value.lastNotified : null;
    return { version: 1, enabled: value.enabled, time: value.time, lastNotified: last };
  } catch { return { ...defaultReminder }; }
}

/** Local calendar time matches the streak's local-day boundary, including DST changes. */
export function reminderDue(settings: ReminderSettings, now: Date, goalMet: boolean): boolean {
  if (!settings.enabled || goalMet || !Number.isFinite(now.getTime()) || !validTime(settings.time)) return false;
  const [hours = 0, minutes = 0] = settings.time.split(":").map(Number);
  return settings.lastNotified !== dayKey(now.toISOString()) && now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}
