import { levelInfo, totalXp, weeklyXp } from "../lib/engine/gamification.ts";
import type { GameState } from "../lib/engine/gamification.ts";
import type { LearnerProfile } from "../lib/engine/learner.ts";

/** Sends nickname, this week's XP and level for an opted-in learner. Failures are silent: the board is optional. */
export async function syncLeaderboard(profile: LearnerProfile, game: GameState, now = new Date().toISOString()): Promise<boolean> {
  if (!game.nickname) return false;
  try {
    const response = await fetch("/api/leaderboard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: game.nickname, xp: Math.min(weeklyXp(profile, game, now), 20_000), level: levelInfo(totalXp(profile, game)).level }),
    });
    return response.ok;
  } catch { return false; }
}
export async function leaveLeaderboard(nickname: string): Promise<boolean> {
  try {
    const response = await fetch("/api/leaderboard", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname }) });
    return response.ok;
  } catch { return false; }
}
