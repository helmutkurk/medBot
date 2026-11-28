import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { requestStructured, OpenAIError } from "../lib/engine/openai.ts";
import { recordTrace } from "../lib/engine/trace.ts";
import type { LlmTrace } from "../lib/engine/trace.ts";
import { estimateCost } from "../lib/engine/pricing.ts";
import { loadUsage } from "../lib/server/usage.ts";
import { POST } from "../app/api/trace/route.ts";
import { GET } from "../app/api/usage/route.ts";

const request = { instructions: "PRIVATE PROMPT", input: [{ role: "user" as const, content: "PRIVATE INPUT" }], name: "test", schema: { type: "object" }, trace: { operation: "patient" as const, caseId: "case-1", personalityId: "quiet", source: "eval" as const } };
const usage = { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 400 }, output_tokens_details: { reasoning_tokens: 50 } };
const envelope = () => Response.json({ status: "completed", usage, output: [{ type: "message", content: [{ type: "output_text", text: '{"reply":"PRIVATE RESPONSE"}' }] }] });
async function isolate(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const old = process.env.MEDBOT_TRACE_DIR;
  const directory = await mkdtemp(path.join(tmpdir(), "medbot-usage-test-"));
  process.env.MEDBOT_TRACE_DIR = directory;
  t.after(async () => { process.env.MEDBOT_TRACE_DIR = old; await rm(directory, { recursive: true, force: true }); });
  return directory;
}
const sample = (overrides: Partial<LlmTrace> = {}): LlmTrace => ({ ts: "2026-11-28T10:00:00.000Z", operation: "patient", model: "gpt-5-mini", status: "ok", latencyMs: 10, inputTokens: 1000, outputTokens: 200, costUsd: 0.00056, source: "app", ...overrides });
const realtime = { operation: "realtime", status: "ok", latencyMs: 150, caseId: "case-1", personalityId: "quiet", inputTokens: 1000, outputTokens: 200, cachedTokens: 200, audioInputTokens: 600, audioOutputTokens: 150, cachedAudioTokens: 100 };
const post = (value: unknown, headers: Record<string, string> = {}) => POST(new Request("http://localhost/api/trace", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(value) }));

test("structured calls record tokens, cached cost, reasoning and context without private text", async t => {
  const directory = await isolate(t);
  t.mock.method(globalThis, "fetch", async () => envelope());
  assert.deepEqual(await requestStructured(request, { apiKey: "PRIVATE KEY", trace: { route: "/api/chat" } }), { reply: "PRIVATE RESPONSE" });
  const summary = await loadUsage();
  const trace = summary.recent[0]!;
  assert.equal(trace.operation, "patient"); assert.equal(trace.source, "eval");
  assert.equal(trace.caseId, "case-1"); assert.equal(trace.personalityId, "quiet"); assert.equal(trace.route, "/api/chat");
  assert.equal(trace.status, "ok"); assert.equal(trace.inputTokens, 1000); assert.equal(trace.outputTokens, 200);
  assert.equal(trace.cachedTokens, 400); assert.equal(trace.reasoningTokens, 50);
  assert.equal(trace.costUsd, 0.00056); assert.ok(trace.latencyMs >= 0); assert.equal(trace.usageMissing, false);
  assert.ok(!((await readFile(path.join(directory, "llm.jsonl"), "utf8")).includes("PRIVATE")));
});

test("retry attempts, network failures and malformed responses are individually traced", async t => {
  await isolate(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls === 1 ? new Response("PRIVATE error", { status: 429, headers: { "retry-after": "0" } }) : envelope());
  await requestStructured(request, { apiKey: "placeholder" });
  let summary = await loadUsage();
  assert.equal(summary.totals.calls, 2); assert.equal(summary.recent[1]?.errorCode, "http_429");
  assert.equal(summary.recent[1]?.status, "error"); assert.equal(summary.recent[0]?.status, "ok");
  t.mock.method(globalThis, "fetch", async () => { throw new Error("PRIVATE KEY"); });
  await assert.rejects(requestStructured(request, { apiKey: "placeholder" }), OpenAIError);
  assert.equal((await loadUsage()).recent[0]?.errorCode, "network");
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "incomplete", usage, output: [] }));
  await assert.rejects(requestStructured(request, { apiKey: "placeholder" }), OpenAIError);
  summary = await loadUsage();
  assert.equal(summary.recent[0]?.status, "error"); assert.equal(summary.recent[0]?.inputTokens, 1000);
  assert.equal(summary.recent[0]?.costUsd, 0.00056);
});

test("Realtime endpoint validates metadata strictly and computes audio/cache costs on server", async t => {
  await isolate(t);
  const previous = process.env.OPENAI_REALTIME_MODEL;
  process.env.OPENAI_REALTIME_MODEL = "gpt-realtime";
  t.after(async () => { if (previous === undefined) delete process.env.OPENAI_REALTIME_MODEL; else process.env.OPENAI_REALTIME_MODEL = previous; });
  assert.equal((await post(realtime)).status, 200);
  const trace = (await loadUsage()).recent[0]!;
  // 300 fresh text + 500 fresh audio + 200 cached + 50 text output + 150 audio output.
  assert.equal(trace.costUsd, (300 * 4 + 500 * 32 + 200 * 0.4 + 50 * 16 + 150 * 64) / 1e6);
  assert.equal(trace.audioInputTokens, 600); assert.equal(trace.cachedAudioTokens, 100);
  for (const change of [
    { operation: "patient" }, { status: "completed" }, { inputTokens: -1 }, { outputTokens: 1.5 }, { latencyMs: null },
    { inputTokens: "1000" }, { costUsd: 0 }, { prompt: "PRIVATE" }, { model: "gpt-5" }, { source: "eval" },
    { caseId: "../bad" }, { personalityId: "" }, { cachedTokens: 1001 }, { cachedAudioTokens: 201 }, { audioOutputTokens: 201 }, { kind: "unknown" },
  ]) assert.equal((await post({ ...realtime, ...change })).status, 400, JSON.stringify(change));
  assert.equal((await post({ ...realtime, caseId: undefined })).status, 400);
  assert.equal((await post({ ...realtime, extra: "x".repeat(5000) })).status, 413);
  assert.equal((await post(realtime, { origin: "http://another-site" })).status, 403);
  assert.equal((await post(realtime, { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await loadUsage()).totals.calls, 1);
});

test("aggregation ignores malformed and partial lines, filters source and keeps last 50", async t => {
  const directory = await isolate(t);
  assert.deepEqual((await loadUsage()).totals, { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
  const rows = [sample(), sample({ operation: "guard", source: "eval", costUsd: 0.001, inputTokens: 2000 }), sample({ model: "unknown", unknownModel: true, status: "error", costUsd: 0, outputTokens: 0 })];
  for (const row of rows) await recordTrace(row);
  await appendFile(path.join(directory, "llm.jsonl"), 'bad json\n{}\n{"ts":"bad"}\n' + 'x'.repeat(70_000) + '\n' + JSON.stringify(sample({ costUsd: 99 })));
  let summary = await loadUsage();
  assert.equal(summary.totals.calls, 3); assert.equal(summary.totals.inputTokens, 4000); assert.equal(summary.totals.outputTokens, 400);
  assert.ok(Math.abs(summary.totals.costUsd - 0.00156) < 1e-12);
  assert.equal(summary.byOperation.find(row => row.operation === "patient")?.calls, 2);
  assert.equal(summary.byModel.find(row => row.model === "unknown")?.unknownModel, true);
  assert.equal(summary.since, rows[0]!.ts);
  assert.equal((await loadUsage("eval")).totals.calls, 1);
  const response = await GET(new Request("http://localhost/api/usage?source=eval"));
  assert.equal(response.status, 200); assert.equal((await response.json()).totals.costUsd, 0.001);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await GET(new Request("http://localhost/api/usage?source=other"))).status, 400);
  await writeFile(path.join(directory, "llm.jsonl"), "");
  await Promise.all(Array.from({ length: 65 }, (_, i) => recordTrace(sample({ latencyMs: i }))));
  summary = await loadUsage();
  assert.equal(summary.totals.calls, 65); assert.equal(summary.recent.length, 50);
});

test("pricing handles each text model, dated snapshots and unknown models", () => {
  for (const [model, cost] of [["gpt-5-mini", 0.00056], ["gpt-5-nano", 0.000112], ["gpt-5", 0.0028], ["gpt-4.1-mini", 0.0006]] as const) {
    const estimate = estimateCost(model, { inputTokens: 1000, outputTokens: 200, cachedTokens: 400, reasoningTokens: 50 });
    assert.ok(Math.abs(estimate.costUsd - cost) < 1e-12, model); assert.equal(estimate.unknownModel, false);
  }
  assert.equal(estimateCost("gpt-realtime", { inputTokens: 1e6, outputTokens: 0, audioInputTokens: 1e6 }).costUsd, 32);
  assert.equal(estimateCost("gpt-4o-mini-transcribe", { inputTokens: 1e6, outputTokens: 0, audioInputTokens: 1e6 }).costUsd, 1.25);
  assert.equal(estimateCost("gpt-5-mini-2025-08-07", { inputTokens: 1e6, outputTokens: 0 }).costUsd, 0.25);
  assert.deepEqual(estimateCost("unknown", { inputTokens: 1000, outputTokens: 200 }), { costUsd: 0, unknownModel: true });
});

test("trace write failures never throw and warn only once without raw error details", async t => {
  const directory = await isolate(t);
  const target = path.join(directory, "file");
  await writeFile(target, "");
  process.env.MEDBOT_TRACE_DIR = target;
  const warnings: unknown[][] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => { warnings.push(args); });
  await recordTrace(sample()); await recordTrace(sample());
  assert.equal(warnings.length, 1); assert.ok(!JSON.stringify(warnings).includes(target));
});
