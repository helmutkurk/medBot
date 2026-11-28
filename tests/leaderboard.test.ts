import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DELETE, GET, POST } from "../app/api/leaderboard/route.ts";
import { checkNickname } from "../lib/engine/nickname.ts";
import { rateLimit, resetRateLimit } from "../lib/server/leaderboard.ts";

function call(method: string, value?: unknown, ip = "1.1.1.1", url = "http://localhost/api/leaderboard", contentType = "application/json"): Request {
  return new Request(url, { method, headers: { "Content-Type": contentType, "x-forwarded-for": ip }, body: value === undefined ? undefined : typeof value === "string" ? value : JSON.stringify(value) });
}
async function withStore(t: test.TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "medbot-board-"));
  process.env.LEADERBOARD_FILE = join(dir, "data", "leaderboard.json");
  resetRateLimit();
  t.after(async () => { delete process.env.LEADERBOARD_FILE; await rm(dir, { recursive: true, force: true }); });
  return process.env.LEADERBOARD_FILE;
}

test("nickname rules: 3-20 characters, safe alphabet, light profanity filter", () => {
  for (const ok of ["Ada", "Quiet Otter", "dr_house-42", "Zoë Müller", "a".repeat(20)]) assert.equal(checkNickname(ok).ok, true, ok);
  for (const bad of ["ab", "a".repeat(21), "<script>", "me@mail.com", "123456", "   ", "f.u.c.k", "Sh1t head", "FUUUCK you", "Nazi", 42, null]) assert.equal(checkNickname(bad).ok, false, String(bad));
  assert.deepEqual(checkNickname("  Quiet   Otter "), { ok: true, nickname: "Quiet Otter" });
  assert.equal(checkNickname("Classic").ok, true, "no false positive on innocent substrings");
});

test("POST validates strictly and stores only nickname, XP and level", async t => {
  const file = await withStore(t);
  for (const bad of [{}, { nickname: "ab", xp: 1, level: 1 }, { nickname: "Okay Name", xp: -1, level: 1 }, { nickname: "Okay Name", xp: 1.5, level: 1 }, { nickname: "Okay Name", xp: 20_001, level: 1 }, { nickname: "Okay Name", xp: 10, level: 0 }, { nickname: "Okay Name", xp: 10, level: 51 }, { nickname: "Okay Name", xp: "10", level: 1 }, { nickname: "Okay Name", xp: 10, level: 1, email: "a@b.c" }]) {
    assert.equal((await POST(call("POST", bad))).status, 400, JSON.stringify(bad));
  }
  resetRateLimit();
  assert.equal((await POST(call("POST", "{oops"))).status, 400);
  assert.equal((await POST(call("POST", { nickname: "Okay Name", xp: 1, level: 1 }, "1.1.1.1", undefined, "text/plain"))).status, 415);
  const foreign = new Request("http://localhost/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ nickname: "Okay Name", xp: 1, level: 1 }) });
  assert.equal((await POST(foreign)).status, 403);
  const ok = await POST(call("POST", { nickname: "Quiet Otter", xp: 120, level: 3 }));
  assert.equal(ok.status, 200);
  const stored = JSON.parse(await readFile(file, "utf8"));
  const [week] = Object.values(stored.weeks) as Record<string, Record<string, unknown>>[];
  assert.deepEqual(Object.keys(week!["quiet otter"]!).sort(), ["level", "nickname", "updatedAt", "xp"]);
});

test("GET returns the weekly top 20 with ranks and the caller's rank; DELETE leaves", async t => {
  await withStore(t);
  for (let i = 0; i < 25; i++) assert.equal((await POST(call("POST", { nickname: `Player ${String(i).padStart(2, "0")}`, xp: i * 10, level: 1 + (i % 5) }, `10.0.0.${i}`))).status, 200);
  const board = await (await GET(call("GET", undefined, "9.9.9.9", "http://localhost/api/leaderboard?nickname=player%2000"))).json();
  assert.equal(board.entries.length, 20);
  assert.equal(board.total, 25);
  assert.deepEqual(board.entries[0], { rank: 1, nickname: "Player 24", xp: 240, level: 5 });
  assert.deepEqual(board.me, { rank: 25, xp: 0, level: 1 }, "case-insensitive nickname match, rank beyond the top 20");
  assert.equal((await DELETE(call("DELETE", { nickname: "Player 00" }, "8.8.8.8"))).status, 200);
  const after = await (await GET(call("GET", undefined, "9.9.9.9", "http://localhost/api/leaderboard?nickname=Player%2000"))).json();
  assert.equal(after.total, 24);
  assert.equal(after.me, null);
  // Resubmitting the same nickname updates in place, not a duplicate.
  await POST(call("POST", { nickname: "Player 01", xp: 999, level: 9 }, "7.7.7.7"));
  const updated = await (await GET(call("GET"))).json();
  assert.equal(updated.total, 24);
  assert.equal(updated.entries[0].nickname, "Player 01");
});

test("writes are rate limited per client address", async t => {
  await withStore(t);
  for (let i = 0; i < rateLimit.limit; i++) assert.equal((await POST(call("POST", { nickname: "Quiet Otter", xp: i, level: 1 }, "5.5.5.5"))).status, 200);
  const limited = await POST(call("POST", { nickname: "Quiet Otter", xp: 99, level: 1 }, "5.5.5.5"));
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "rate_limited");
  assert.equal((await POST(call("POST", { nickname: "Quiet Otter", xp: 99, level: 1 }, "6.6.6.6"))).status, 200, "other clients are unaffected");
});
