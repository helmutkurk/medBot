import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadLatestEval, loadLatestVoice, wilson } from "../lib/server/eval.ts";

test("wilson reproduces the worked example and edge cases", () => {
  const ci = wilson(32, 40)!;
  assert.equal(ci.p, 0.8);
  assert.equal((ci.low * 100).toFixed(1), "65.2");
  assert.equal((ci.high * 100).toFixed(1), "89.5");
  const zero = wilson(0, 40)!;
  assert.equal(zero.low, 0);
  assert.equal((zero.high * 100).toFixed(1), "8.8");
  assert.equal(wilson(0, 0), null);
  assert.equal(wilson(5, 4), null);
  assert.equal(wilson(40, 40)!.high, 1);
});

const run = (caseId: string, personalityId: string, over: Record<string, number> = {}, correct = true) => ({
  caseId, personalityId, mode: "openai", personalityCorrect: correct, latenciesMs: [100, 200],
  metrics: { factCoverage: 0.5, invented: 0, contradictions: 0, unpromptedDisclosures: 0, jargonHits: 0, outOfCharacter: 0, coachScore: 70, anamnesisCompleteness: 60, ...over },
});

test("loader skips partial/in-progress files and reports proportions, voice tolerates absence", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "medbot-evidence-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.mock.method(process, "cwd", () => directory);
  assert.equal(await loadLatestEval(), null);
  assert.equal(await loadLatestVoice(), null);
  const results = path.join(directory, "eval", "results");
  await mkdir(results, { recursive: true });
  const complete = { timestamp: "2026-11-28T01:00:00.000Z", mode: "openai", patientModel: "p", textModel: "t", config: { n: 2, turns: 12 }, failures: [],
    runs: [run("a", "x"), run("a", "x", { invented: 1 }, false), run("a", "y"), run("b", "y", { unpromptedDisclosures: 2 })], aggregate: { runs: 4 } };
  await writeFile(path.join(results, "2026-11-28T01-00-00.000Z.json"), JSON.stringify(complete));
  await writeFile(path.join(results, "2026-11-28T02-00-00.000Z.partial.jsonl"), JSON.stringify(run("c", "z")) + "\n");
  await writeFile(path.join(results, "2026-11-28T03-00-00.000Z.json"), "{ \"runs\": [");
  const evidence = (await loadLatestEval())!;
  assert.equal(evidence.filename, "2026-11-28T01-00-00.000Z.json");
  assert.equal(evidence.n, 4);
  assert.deepEqual(evidence.recognised, { x: 3, n: 4 });
  assert.deepEqual(evidence.clean, { x: 2, n: 4 });
  assert.equal(evidence.caseCount, 2);
  assert.equal(evidence.personalitiesPerCase, null);
  assert.equal(evidence.patientModel, "p");
  assert.equal(evidence.turns, 12);
  assert.equal(evidence.metrics.invented, 1);
  assert.deepEqual(evidence.groups.find(g => g.caseId === "a" && g.personalityId === "x")?.clean, { x: 1, n: 2 });

  const voice = path.join(directory, "eval", "voice", "2026-11-28T01-54-41.965Z-abcd1234");
  await mkdir(voice, { recursive: true });
  await mkdir(path.join(directory, "eval", "voice", "2026-11-29T00-00-00.000Z-incomplete"), { recursive: true });
  await writeFile(path.join(voice, "results.json"), JSON.stringify({ timestamp: "2026-11-28T01:54:41.965Z",
    runs: [{ model: "gpt-realtime", turns: [{ status: "ok", firstAudioMs: 400 }, { status: "ok", firstAudioMs: 600 }, { status: "error", firstAudioMs: 9000 }] }],
    summaries: [{ guardedMessages: 2, guardCounts: { invented: 0, contradiction: 1, unprompted: 0, jargon: 0, out_of_character: 0 } }] }));
  const v = (await loadLatestVoice())!;
  assert.equal(v.turns, 2);
  assert.equal(v.firstAudioP50Ms, 400);
  assert.equal(v.firstAudioP95Ms, 600);
  assert.equal(v.guardCounts.contradiction, 1);
  assert.equal(v.model, "gpt-realtime");
});

test("voice evidence pools the latest 30-minute session, production model only, with unique cases", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "medbot-voice-evidence-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.mock.method(process, "cwd", () => directory);
  const originalModel = process.env.OPENAI_REALTIME_MODEL;
  delete process.env.OPENAI_REALTIME_MODEL;
  t.after(() => {
    if (originalModel === undefined) delete process.env.OPENAI_REALTIME_MODEL;
    else process.env.OPENAI_REALTIME_MODEL = originalModel;
  });
  const voiceRun = (caseId: string, model: string, times: number[]) => ({ caseId, model, turns: [...times.map(firstAudioMs => ({ status: "ok", firstAudioMs })), { status: "error", firstAudioMs: 99999 }] });
  const summary = (guardedMessages: number, contradiction: number, invented = 0) => ({ guardedMessages, guardCounts: { invented, contradiction, unprompted: 0, jargon: 0, out_of_character: 0 } });
  async function report(timestamp: string, runs: unknown[], summaries: unknown[]) {
    const name = `${timestamp.replaceAll(":", "-")}-test`;
    const target = path.join(directory, "eval", "voice", name);
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "results.json"), JSON.stringify({ timestamp, runs, summaries }));
    return name;
  }
  // Include the exact boundary; do not chain a third report via its nearer neighbour.
  await report("2026-11-28T11:29:59.999Z", [voiceRun("old", "gpt-realtime", [9999])], [summary(100, 100)]);
  const boundary = await report("2026-11-28T11:30:00.000Z", [voiceRun("a", "gpt-realtime", [100, 200, 300])], [summary(3, 1)]);
  const middle = await report("2026-11-28T11:45:00.000Z", [voiceRun("b", "gpt-realtime-mini", [8888]), voiceRun("b", "gpt-realtime", [400])], [summary(100, 100), summary(1, 2)]);
  const newest = await report("2026-11-28T12:00:00.000Z", [voiceRun("a", "gpt-realtime", [1000]), voiceRun("c", "gpt-realtime", [2000]), voiceRun("unknown", "", [7777])], [summary(1, 0, 1), summary(1, 0), summary(100, 100), summary(100, 100)]);
  await report("2026-11-28T14:00:00.000Z", [voiceRun("mini-only", "gpt-realtime-mini", [6666])], [summary(1, 1)]);
  await report("2026-11-28T15:00:00.000Z", [], []);
  const malformed = path.join(directory, "eval", "voice", "2026-11-28T16-00-00.000Z-partial");
  await mkdir(malformed, { recursive: true });
  await writeFile(path.join(malformed, "results.json"), "{");
  const evidence = (await loadLatestVoice())!;
  assert.equal(evidence.directory, newest);
  assert.deepEqual(evidence.directories, [newest, middle, boundary]);
  assert.equal(evidence.timestamp, "2026-11-28T12:00:00.000Z");
  assert.equal(evidence.model, "gpt-realtime");
  assert.equal(evidence.caseCount, 3);
  assert.equal(evidence.turns, 6);
  assert.equal(evidence.firstAudioP50Ms, 300);
  assert.equal(evidence.firstAudioP95Ms, 2000);
  assert.equal(evidence.guardedMessages, 6);
  assert.deepEqual(evidence.guardCounts, { invented: 1, contradiction: 3, unprompted: 0, jargon: 0, out_of_character: 0 });

  process.env.OPENAI_REALTIME_MODEL = " gpt-realtime-mini ";
  const mini = (await loadLatestVoice())!;
  assert.equal(mini.caseCount, 1);
  assert.equal(mini.turns, 1);
  assert.equal(mini.firstAudioP50Ms, 6666);
  assert.equal(mini.model, "gpt-realtime-mini");
});

test("voice evidence returns null without valid production audio", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "medbot-voice-empty-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.mock.method(process, "cwd", () => directory);
  const target = path.join(directory, "eval", "voice", "2026-11-28T12-00-00.000Z-test");
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "results.json"), JSON.stringify({ runs: [{ model: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime", caseId: "a", turns: [{ status: "error", firstAudioMs: 1 }, { status: "ok", firstAudioMs: null }] }] }));
  assert.equal(await loadLatestVoice(), null);
});
