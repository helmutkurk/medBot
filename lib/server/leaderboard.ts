import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { maxLevel, weekStart } from "../engine/gamification.ts";
import { checkNickname, nicknameKey } from "../engine/nickname.ts";
import { HttpError } from "./http.ts";
import { ephemeralStorage } from "./storage.ts";

/*
 * Opt-in weekly leaderboard. Stores exactly nickname + XP + level per week, in a git-ignored JSON file.
 * XP and level are reported by the browser and cannot be verified; this is a motivation feature for a
 * friendly cohort, not a competition with prizes. Anyone who knows a nickname can overwrite or remove it.
 */
export const maxWeeklyXp = 20_000;
export const topSize = 20;
const maxEntriesPerWeek = 5_000;
const weeksKept = 4;

export interface Entry { nickname: string; xp: number; level: number; updatedAt: string }
interface Store { version: 1; weeks: Record<string, Record<string, Entry>> }

export const storePath = () => resolve(/* turbopackIgnore: true */ process.env.LEADERBOARD_FILE || "data/leaderboard.json");

function requireLeaderboard(): void {
  if (ephemeralStorage()) throw new HttpError(503, "leaderboard_disabled", "The shared leaderboard is unavailable on this hosted demo. Your learning progress stays in this browser.");
}

function exact(data: Record<string, unknown>, keys: string[]): void {
  const extra = Object.keys(data).filter(k => !keys.includes(k));
  if (extra.length) throw new HttpError(400, "invalid_request", `Unexpected field: ${extra[0]}. Only ${keys.join(", ")} are accepted.`);
}
export function validateSubmission(data: Record<string, unknown>): { nickname: string; xp: number; level: number } {
  exact(data, ["nickname", "xp", "level"]);
  const nick = checkNickname(data.nickname);
  if (!nick.ok) throw new HttpError(400, "invalid_nickname", nick.reason);
  const { xp, level } = data;
  if (typeof xp !== "number" || !Number.isInteger(xp) || xp < 0 || xp > maxWeeklyXp) throw new HttpError(400, "invalid_request", `xp must be an integer from 0 to ${maxWeeklyXp}.`);
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > maxLevel) throw new HttpError(400, "invalid_request", `level must be an integer from 1 to ${maxLevel}.`);
  return { nickname: nick.nickname, xp, level };
}
export function validateRemoval(data: Record<string, unknown>): string {
  exact(data, ["nickname"]);
  const nick = checkNickname(data.nickname);
  if (!nick.ok) throw new HttpError(400, "invalid_nickname", nick.reason);
  return nick.nickname;
}

// Fixed-window limiter per client address; in memory is enough for one server process.
const hits = new Map<string, { start: number; count: number }>();
export const rateLimit = { limit: 10, windowMs: 60_000 };
export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "local";
}
export function checkRate(key: string, now = Date.now()): void {
  const slot = hits.get(key);
  if (!slot || now - slot.start >= rateLimit.windowMs) {
    if (hits.size > 10_000) hits.clear();
    hits.set(key, { start: now, count: 1 });
    return;
  }
  if (++slot.count > rateLimit.limit) throw new HttpError(429, "rate_limited", "Too many leaderboard updates. Try again in a minute.");
}
export const resetRateLimit = () => hits.clear();

async function read(): Promise<Store> {
  try {
    const value = JSON.parse(await readFile(/* turbopackIgnore: true */ storePath(), "utf8"));
    if (value?.version === 1 && value.weeks && typeof value.weeks === "object") return value as Store;
  } catch { /* missing or corrupt: start empty */ }
  return { version: 1, weeks: {} };
}
let queue: Promise<unknown> = Promise.resolve();
/** Serialises read-modify-write so concurrent requests cannot lose updates. */
function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}
async function write(store: Store): Promise<void> {
  const keep = Object.keys(store.weeks).sort().slice(-weeksKept);
  store.weeks = Object.fromEntries(keep.map(week => [week, store.weeks[week]!]));
  const file = storePath();
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(store), "utf8");
  await rename(temp, file);
}

export function ranked(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.xp - a.xp || a.updatedAt.localeCompare(b.updatedAt) || a.nickname.localeCompare(b.nickname));
}
export interface Board { week: string; total: number; entries: { rank: number; nickname: string; xp: number; level: number }[]; me: { rank: number; xp: number; level: number } | null }
export async function board(nickname?: string, now = new Date().toISOString()): Promise<Board> {
  requireLeaderboard();
  const week = weekStart(now);
  const all = ranked(Object.values((await read()).weeks[week] ?? {}));
  const row = (e: Entry, i: number) => ({ rank: i + 1, nickname: e.nickname, xp: e.xp, level: e.level });
  const mineIndex = nickname ? all.findIndex(e => nicknameKey(e.nickname) === nicknameKey(nickname)) : -1;
  return { week, total: all.length, entries: all.slice(0, topSize).map(row), me: mineIndex >= 0 ? { rank: mineIndex + 1, xp: all[mineIndex]!.xp, level: all[mineIndex]!.level } : null };
}
export function submit(input: { nickname: string; xp: number; level: number }, now = new Date().toISOString()): Promise<Board> {
  return exclusive(async () => {
    requireLeaderboard();
    const store = await read();
    const week = weekStart(now);
    const entries = store.weeks[week] ??= {};
    const key = nicknameKey(input.nickname);
    if (!entries[key] && Object.keys(entries).length >= maxEntriesPerWeek) throw new HttpError(503, "leaderboard_full", "The leaderboard is full this week.");
    entries[key] = { nickname: input.nickname, xp: input.xp, level: input.level, updatedAt: now };
    await write(store);
    return board(input.nickname, now);
  });
}
export function remove(nickname: string): Promise<void> {
  return exclusive(async () => {
    requireLeaderboard();
    const store = await read();
    const key = nicknameKey(nickname);
    let changed = false;
    for (const week of Object.values(store.weeks)) if (week[key]) { delete week[key]; changed = true; }
    if (changed) await write(store);
  });
}
