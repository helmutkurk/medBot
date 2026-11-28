// Shared by the leaderboard form and the leaderboard route so both apply the same rules.
const blocked = ["fuck", "shit", "bitch", "cunt", "asshole", "nazi", "hitler", "nigg", "fick", "scheisse", "wichser", "mierda", "admin", "medbot"];
const leet: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

export const nicknameHint = "3–20 letters, digits, spaces, _ or -. Use a made-up name, not your real name.";

function squash(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[013457@$]/g, c => leet[c] ?? "").replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}

/** Returns the cleaned nickname, or a reason it is not allowed. A light filter, not moderation. */
export function checkNickname(value: unknown): { ok: true; nickname: string } | { ok: false; reason: string } {
  if (typeof value !== "string") return { ok: false, reason: "Choose a nickname." };
  const nickname = value.trim().replace(/\s+/g, " ");
  if (nickname.length < 3 || nickname.length > 20) return { ok: false, reason: "Use 3 to 20 characters." };
  if (!/^[\p{L}\p{N}_ -]+$/u.test(nickname)) return { ok: false, reason: "Use only letters, digits, spaces, _ and -." };
  if (!/\p{L}/u.test(nickname)) return { ok: false, reason: "Include at least one letter." };
  const flat = squash(nickname);
  if (blocked.some(word => flat.includes(squash(word)))) return { ok: false, reason: "Please choose a different nickname." };
  return { ok: true, nickname };
}
export const nicknameKey = (nickname: string) => nickname.trim().replace(/\s+/g, " ").toLowerCase();
