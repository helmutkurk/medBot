// Codex, 2026-11-28. Offline tests with isolated temporary storage and synthetic credentials.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import type { TestContext } from "node:test";
import { ACCESS_COOKIE, ADMIN_COOKIE, ACCESS_SECONDS, accessConfigured, cookieHeader, gateDecision, matchesCode, publicPath, signCookie, verifyCookie } from "../lib/server/hosted.ts";
import { RateLimiter, costsMoney, routeClass, routeLimits } from "../lib/server/limits.ts";
import { protectRequest } from "../lib/server/protection.ts";
import { budgetFailure, dailySpend, rememberUnstoredCost } from "../lib/server/budget.ts";
import { appendJsonLine, readJsonLines, storageDirectory, traceDirectory } from "../lib/server/storage.ts";
import { body, route } from "../lib/server/http.ts";
import { recordTrace } from "../lib/engine/trace.ts";
import { POST as login } from "../app/access/login/route.ts";
import { POST as admin } from "../app/api/feedback/admin/route.ts";
import { GET as feedback, POST as sendFeedback } from "../app/api/feedback/route.ts";
import { GET as leaderboard } from "../app/api/leaderboard/route.ts";
import { loadCase } from "../lib/case/load.ts";
import { saveGeneratedCase } from "../lib/engine/creator.ts";
import { generatedCases } from "../lib/case/generated.ts";

async function setup(t: TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "medbot-hosted-test-"));
  for (const [name, value] of Object.entries({ MEDBOT_HOSTED: "1", MEDBOT_ACCESS_CODE: "synthetic-access-code", MEDBOT_COOKIE_SECRET: "synthetic-cookie-secret-with-32-characters", MEDBOT_ADMIN_CODE: "synthetic-admin-code", MEDBOT_DAILY_USD_CAP: "1", MEDBOT_STORAGE_DIR: directory })) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  t.after(async () => { generatedCases.clear(); await rm(directory, { recursive: true, force: true }); });
  return directory;
}
const call = (url: string, cookie = "", value?: unknown, ip = "test-ip") => new Request(`https://medbot.example${url}`, {
  method: value === undefined ? "GET" : "POST", headers: { cookie, "content-type": "application/json", "x-forwarded-for": ip, origin: "https://medbot.example" },
  body: value === undefined ? undefined : JSON.stringify(value),
});
const access = async () => `${ACCESS_COOKIE}=${await signCookie("access")}`;

test("signed cookies reject tampering, expiry, wrong purpose, and rotated credentials", async t => {
  await setup(t);
  const now = Date.UTC(2026, 10, 28, 10), value = await signCookie("access", now);
  assert.ok(await verifyCookie(value, "access", now));
  assert.equal(await verifyCookie(value, "access", now + ACCESS_SECONDS * 1000), null);
  assert.equal(await verifyCookie(value, "access", now - 1000), null);
  assert.equal(await verifyCookie(`${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`, "access", now), null);
  assert.equal(await verifyCookie(value, "admin", now), null);
  assert.equal(await verifyCookie("garbage", "access", now), null);
  assert.equal(await verifyCookie("x".repeat(1000), "access", now), null);
  assert.equal(await matchesCode("incorrect", process.env.MEDBOT_ACCESS_CODE), false);
  assert.equal(await matchesCode("synthetic-access-code", process.env.MEDBOT_ACCESS_CODE), true);
  process.env.MEDBOT_ACCESS_CODE = "rotated-synthetic-code";
  assert.equal(await verifyCookie(value, "access", now), null);
  const rotated = await signCookie("access", now);
  process.env.MEDBOT_COOKIE_SECRET = "new-synthetic-cookie-secret-with-32-chars";
  assert.equal(await verifyCookie(rotated, "access", now), null);
});

test("gate covers pages and all current/future APIs, with only explicit public exceptions", async t => {
  await setup(t);
  for (const url of ["/", "/privacy", "/feedback", "/usage", "/learning"]) assert.equal(await gateDecision(call(url)), "login");
  for (const url of ["/api", "/api/chat", "/api/session", "/api/hint", "/api/viva", "/api/new.json", "/api/health"]) {
    assert.equal(await gateDecision(call(url)), "unauthorized");
    assert.equal((await protectRequest(call(url)))?.status, 401);
  }
  for (const url of ["/access", "/access/login", "/_next/static/app.js", "/manifest.webmanifest", "/sw.js", "/icon.svg", "/icons/icon-192.png", "/offline.html"]) {
    assert.equal(publicPath(url), true);
    assert.equal(await gateDecision(call(url)), "allow");
  }
  const cookie = await access();
  assert.equal(await gateDecision(call("/", cookie)), "allow");
  assert.equal(await gateDecision(call("/api/hint", cookie)), "allow");
  const redirect = await protectRequest(call("/private"));
  assert.equal(redirect?.status, 307); assert.equal(redirect?.headers.get("location"), "https://medbot.example/access");
  process.env.MEDBOT_COOKIE_SECRET = "";
  assert.equal(accessConfigured(), false);
  assert.equal((await protectRequest(call("/api/session")))?.status, 503);
  process.env.MEDBOT_HOSTED = "0";
  assert.equal(await gateDecision(call("/api/session")), "allow");
});

test("login sets a secure httpOnly signed cookie; hosted writes reject cross-origin requests", async t => {
  await setup(t);
  assert.equal((await login(call("/access/login", "", { code: "wrong" }))).status, 401);
  const response = await login(call("/access/login", "", { code: "synthetic-access-code" }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")!;
  for (const flag of ["HttpOnly", "SameSite=Strict", "Secure", "Path=/", "Max-Age=43200"]) assert.ok(cookie.includes(flag));
  assert.equal(await gateDecision(call("/api/chat", cookie.split(";")[0])), "allow");
  assert.ok(cookieHeader(call("/"), ACCESS_COOKIE, "value", 1).includes("Secure"));
  const crossSite = call("/api/hint", await access(), {});
  crossSite.headers.set("origin", "https://untrusted.example");
  assert.equal((await protectRequest(crossSite))?.status, 403);
});

test("rate limiter separates route classes, clients and windows, and bounds login attempts", async t => {
  await setup(t);
  const limiter = new RateLimiter();
  for (let i = 0; i < routeLimits.realtime.limit; i++) assert.equal(limiter.check("a", "realtime", 100), 0);
  assert.equal(limiter.check("a", "realtime", 100), 600);
  assert.equal(limiter.check("b", "realtime", 100), 0);
  assert.equal(limiter.check("a", "text", 100), 0);
  assert.equal(limiter.check("a", "realtime", 600_100), 0);
  assert.equal(routeClass("/api/hint", "POST"), "text");
  assert.equal(routeClass("/api/viva", "POST"), "text");
  assert.equal(costsMoney("/api/new-route", "POST"), true);
  assert.equal(costsMoney("/api/trace", "POST"), false);
  for (let i = 0; i < routeLimits.login.limit; i++) assert.equal(await protectRequest(call("/access/login", "", {}, "login-rate-test")), null);
  assert.equal((await protectRequest(call("/access/login", "", {}, "login-rate-test")))?.status, 429);
  const cookie = await access();
  for (let i = 0; i < routeLimits.realtime.limit; i++) assert.equal(await protectRequest(call("/api/session", cookie, {}, `rotating-${i}`)), null);
  assert.equal((await protectRequest(call("/api/session", cookie, {}, "new-ip")))?.status, 429, "a signed cookie is limited even when the IP changes");
  for (let i = 0; i < routeLimits.realtime.limit; i++) assert.equal(await protectRequest(call("/api/session", await access(), {}, "same-ip")), null);
  assert.equal((await protectRequest(call("/api/session", await access(), {}, "same-ip")))?.status, 429, "new cookies do not bypass the IP bucket");
});

test("daily cap sums committed trace costs for the UTC day and blocks API calls", async t => {
  await setup(t);
  const now = new Date(), today = now.toISOString(), yesterday = new Date(now.getTime() - 86_400_000).toISOString();
  await recordTrace({ ts: today, operation: "patient", model: "gpt-5-mini", status: "ok", latencyMs: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.6, source: "app" });
  await appendJsonLine(path.join(traceDirectory(), "llm.jsonl"), { ts: yesterday, costUsd: 99 });
  await appendJsonLine(path.join(traceDirectory(), "llm.jsonl"), { ts: today, costUsd: 99, kind: "turn" });
  assert.equal(await dailySpend(now), 0.6);
  assert.equal(await budgetFailure(now), null);
  rememberUnstoredCost({ ts: today, costUsd: 0.4 });
  assert.equal(await dailySpend(now), 1);
  assert.equal((await budgetFailure(now))?.code, "daily_budget_exceeded");
  const cookie = await access();
  const response = await protectRequest(call("/api/viva", cookie, {}, "cap-test"));
  assert.equal(response?.status, 503); assert.equal((await response?.json()).error.code, "daily_budget_exceeded");
  const routeResponse = await route(async () => Response.json(await body(call("/api/hint", cookie, {}))));
  assert.equal(routeResponse.status, 503, "the route boundary checks its own instance ledger");
  assert.equal(await protectRequest(call("/api/trace", cookie, {}, "cap-trace-test")), null, "usage reporting continues after the cutoff");
  assert.equal(await budgetFailure(new Date(now.getTime() + 86_400_000)), null);
  process.env.MEDBOT_DAILY_USD_CAP = "invalid";
  assert.equal((await budgetFailure())?.code, "budget_unconfigured");
});

test("storage failures preserve feedback and cost accounting without crashing", async t => {
  const directory = await setup(t), blocked = path.join(directory, "not-a-directory");
  await writeFile(blocked, "synthetic fixture");
  const file = path.join(blocked, "feedback.jsonl");
  assert.equal(await appendJsonLine(file, { rating: 5, text: "Synthetic feedback" }), false);
  assert.deepEqual(await readJsonLines(file), [{ rating: 5, text: "Synthetic feedback" }]);
  process.env.MEDBOT_STORAGE_DIR = blocked;
  await recordTrace({ ts: new Date().toISOString(), operation: "patient", model: "gpt-5-mini", status: "ok", latencyMs: 1, inputTokens: 1, outputTokens: 1, costUsd: 2, source: "app" });
  assert.equal((await budgetFailure())?.code, "budget_unavailable", "unreadable ledgers fail closed");
  await rm(blocked);
  assert.equal(await dailySpend(), 2, "failed trace writes still count against the estimate cap");
  process.env.MEDBOT_STORAGE_DIR = "/read-only-deployment";
  assert.equal(storageDirectory(), "/tmp/medbot");
  assert.equal(traceDirectory(), "/tmp/medbot/traces");
  assert.equal((await leaderboard(call("/api/leaderboard"))).status, 503);
});

test("feedback accepts only rating/comment and requires a separate admin cookie to list", async t => {
  const directory = await setup(t), cookie = await access();
  t.mock.method(console, "info", () => undefined);
  const response = await sendFeedback(call("/api/feedback", cookie, { rating: 4, text: "Clear synthetic demo" }));
  assert.equal(response.status, 201);
  const rows = await readJsonLines(path.join(directory, "feedback.jsonl"));
  assert.equal(rows.length, 1); assert.deepEqual(Object.keys(rows[0] as object).sort(), ["id", "rating", "text", "ts"]);
  assert.equal((await feedback(call("/api/feedback", cookie))).status, 403);
  assert.equal((await admin(call("/api/feedback/admin", cookie, { code: "wrong" }))).status, 403);
  const unlock = await admin(call("/api/feedback/admin", cookie, { code: "synthetic-admin-code" }));
  const adminCookie = unlock.headers.get("set-cookie")!.split(";")[0];
  assert.ok(adminCookie.startsWith(ADMIN_COOKIE));
  const entries = await (await feedback(call("/api/feedback", `${cookie}; ${adminCookie}`))).json();
  assert.equal(entries.entries[0].text, "Clear synthetic demo");
  for (const invalid of [{ rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: 4, text: "x".repeat(2001) }, { rating: 4, email: "unwanted-field" }]) assert.equal((await sendFeedback(call("/api/feedback", cookie, invalid))).status, 400);
});

test("hosted generated cases survive unwritable storage in instance memory", async t => {
  const directory = await setup(t);
  const original = await loadCase("chest-tightness-01");
  const value = { ...original, id: "gen-hosted-storage-test" };
  const blocked = path.join(directory, "blocked");
  await writeFile(blocked, "synthetic fixture");
  process.env.MEDBOT_STORAGE_DIR = blocked;
  await saveGeneratedCase(value);
  assert.deepEqual(await loadCase(value.id), value);
  process.env.MEDBOT_STORAGE_DIR = directory;
  await saveGeneratedCase(value);
  generatedCases.clear();
  assert.deepEqual(await loadCase(value.id), value);
  assert.ok(await readFile(path.join(directory, "cases", "generated", `${value.id}.json`), "utf8"));
  const ledger = path.join(directory, "unreadable-ledger");
  await mkdir(ledger);
  await writeFile(path.join(ledger, "llm.jsonl"), "broken-json\n");
  assert.equal((await budgetFailure(new Date(), ledger))?.code, "budget_unavailable");
});
