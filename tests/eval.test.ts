import { communicationSkills } from "../lib/case/types.ts";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { main, parseArguments, workerPool } from "../scripts/eval.ts";
import { loadUsage } from "../lib/server/usage.ts";

test("eval parses trimmed case lists and bounded concurrency", () => {
  assert.deepEqual(parseArguments([]), { n: 3, turns: 12, concurrency: 1 });
  assert.deepEqual(parseArguments(["--case", " chest-tightness-01, abdominal-pain-01,chest-tightness-01 ", "--concurrency", "6"]), {
    n: 3, turns: 12, concurrency: 6, caseIds: ["chest-tightness-01", "abdominal-pain-01"],
  });
  assert.deepEqual(parseArguments(["--case", "chest-tightness-01"]).caseIds, ["chest-tightness-01"]);
  for (const value of ["0", "7", "1.5", "NaN", "Infinity", "-1"]) assert.throws(() => parseArguments(["--concurrency", value]));
  for (const value of [",", "a,", ",a", "a, ,b", " "]) assert.throws(() => parseArguments(["--case", value]));
  assert.throws(() => parseArguments(["--concurrency"]));
});

test("workers bound parallel interviews and retain case/personality/run order", async () => {
  const jobs = ["a", "b"].flatMap(caseId => ["x", "y"].flatMap(personalityId => [1, 2].map(run => ({ caseId, personalityId, run }))));
  const pending = jobs.map(() => Promise.withResolvers<void>());
  const started: number[] = [];
  const finished: number[] = [];
  let active = 0;
  let peak = 0;
  const result = workerPool(jobs, 2, async job => {
    const index = jobs.indexOf(job);
    started.push(index);
    peak = Math.max(peak, ++active);
    await pending[index].promise;
    active--;
    finished.push(index);
    return job;
  });
  assert.deepEqual(started, [0, 1]);
  // Keep the first interview blocked while the other worker drains the queue.
  for (let i = 1; i < jobs.length; i++) {
    pending[i].resolve();
    await pending[i].promise;
    await Promise.resolve();
  }
  assert.deepEqual(finished, [1, 2, 3, 4, 5, 6, 7]);
  pending[0].resolve();
  assert.deepEqual(await result, jobs);
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.deepEqual(await workerPool([], 6, async job => job), []);
  await assert.rejects(workerPool([1], 7, async job => job));
});

test("parallel eval checkpoints completions before a slow first interview and orders the final report", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "medbot-eval-parallel-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await symlink(path.join(process.cwd(), "cases"), path.join(directory, "cases"), "dir");
  t.mock.method(process, "cwd", () => directory);
  const original = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, MEDBOT_TRACE_DIR: process.env.MEDBOT_TRACE_DIR };
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.OPENAI_API_KEY = "placeholder";
  process.env.MEDBOT_TRACE_DIR = path.join(directory, "traces");
  const exitCode = process.exitCode;
  t.after(() => { process.exitCode = exitCode; });
  const values: Record<string, unknown> = {
    student_question: { question: "Hello?" }, patient_turn: { reply: "Hello.", revealed: [] },
    guard_result: { ok: true, issues: [], mode: "openai" }, personality_guess: { personality_id: "anxious" },
    coach_report: { opportunities: [], strengths: [], improvements: [], quotes: [], suggestions: [], communication: Object.fromEntries(communicationSkills.map(skill => [skill, { score: 0, evidence: "", tip: "Practise this skill explicitly." }])) },
    anamnesis_report: { note: "Not documented.", documented: [] },
  };
  const slow = Promise.withResolvers<void>();
  let started = 0;
  let checkpointRows: { caseId: string; run: number }[] = [];
  const results = path.join(directory, "eval", "results");
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const name = JSON.parse(String(init.body)).text.format.name;
    if (name === "student_question") {
      const number = ++started;
      if (number === 1) await slow.promise;
      if (number === 4) {
        try {
          const partial = (await readdir(results)).find(file => file.endsWith(".partial.jsonl"))!;
          checkpointRows = (await readFile(path.join(results, partial), "utf8")).trim().split("\n").map(line => JSON.parse(line));
        } finally { slow.resolve(); }
        return new Response("private provider body", { status: 400 });
      }
    }
    assert.ok(Object.hasOwn(values, name));
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(values[name]) }] }] });
  });
  t.mock.method(console, "log", () => {});
  await main(["--case", "chest-tightness-01,abdominal-pain-01", "--personality", "anxious", "--n", "2", "--turns", "1", "--concurrency", "2"]);
  assert.deepEqual(checkpointRows.map(row => [row.caseId, row.run]), [["chest-tightness-01", 2], ["abdominal-pain-01", 1]]);
  const files = await readdir(results);
  const report = JSON.parse(await readFile(path.join(results, files.find(file => file.endsWith(".json"))!), "utf8"));
  assert.deepEqual(report.runs.map((row: { caseId: string; run: number }) => [row.caseId, row.run]), [["chest-tightness-01", 1], ["chest-tightness-01", 2], ["abdominal-pain-01", 1]]);
  assert.deepEqual(report.failures.map((row: { caseId: string; run: number }) => [row.caseId, row.run]), [["abdominal-pain-01", 2]]);
  assert.deepEqual(report.failures[0].error, { kind: "http", message: "OpenAI request failed with HTTP 400." });
  assert.equal(report.aggregate.runs, 3);
  assert.equal(report.aggregate.factCoverage, 0);
  assert.equal(report.aggregate.invented, 0);
  assert.equal(report.aggregate.personalityAccuracy, 1);
  const partial = (await readFile(path.join(results, files.find(file => file.endsWith(".jsonl"))!), "utf8")).trim().split("\n").map(line => JSON.parse(line));
  assert.equal(partial.length, 4);
  assert.deepEqual(partial.filter(row => !row.error).sort((a, b) => Number(a.caseId === "abdominal-pain-01") - Number(b.caseId === "abdominal-pain-01") || a.run - b.run), report.runs);
  assert.deepEqual(partial.filter(row => row.error), report.failures);
});

for (const failureCount of [0, 1, 2]) {
  test(`eval preserves model routing and checkpoints with ${failureCount} failed interviews`, async t => {
    const directory = await mkdtemp(path.join(tmpdir(), "medbot-eval-test-"));
    const originalExitCode = process.exitCode;
    process.exitCode = 0;
    const original = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_PATIENT_MODEL: process.env.OPENAI_PATIENT_MODEL,
      OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
      MEDBOT_TRACE_DIR: process.env.MEDBOT_TRACE_DIR,
    };
    t.after(async () => {
      process.exitCode = originalExitCode;
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await rm(directory, { recursive: true, force: true });
    });
    await symlink(path.join(process.cwd(), "cases"), path.join(directory, "cases"), "dir");
    t.mock.method(process, "cwd", () => directory);
    process.env.OPENAI_API_KEY = "placeholder";
    process.env.OPENAI_PATIENT_MODEL = "  gpt-4.1-mini  ";
    process.env.OPENAI_TEXT_MODEL = "  gpt-5-nano  ";
    process.env.MEDBOT_TRACE_DIR = path.join(directory, "traces");
    const calls: { name: string; model: string }[] = [];
    const values: Record<string, unknown> = {
      student_question: { question: "Hello?" },
      patient_turn: { reply: "Hello.", revealed: [] },
      guard_result: { ok: failureCount !== 1, issues: failureCount === 1 ? [{ type: "invented", detail: "Unsupported detail." }] : [], mode: "openai" },
      personality_guess: { personality_id: "downplaying" },
      coach_report: { opportunities: [], strengths: [], improvements: [], quotes: [], suggestions: [], communication: Object.fromEntries(communicationSkills.map(skill => [skill, { score: 0, evidence: "", tip: "Practise this skill explicitly." }])) },
      anamnesis_report: { note: "Not documented.", documented: [] },
    };
    const results = path.join(directory, "eval", "results");
    let interviewNumber = 0;
    t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const name = body.text.format.name;
      assert.ok(Object.hasOwn(values, name));
      calls.push({ name, model: body.model });
      if (name === "student_question") {
        const partialFile = (await readdir(results)).find(file => file.endsWith(".partial.jsonl"));
        assert.ok(partialFile);
        const contents = await readFile(path.join(results, partialFile), "utf8");
        assert.equal(contents.trim().split("\n").filter(Boolean).length, interviewNumber);
        interviewNumber++;
      }
      if (name === "coach_report" && interviewNumber <= failureCount) {
        return new Response("private provider body placeholder", { status: 400 });
      }
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(values[name]) }] }] });
    });
    const output: string[] = [];
    t.mock.method(console, "log", (line: string) => { output.push(line); });
    const n = failureCount === 0 ? 1 : 2;
    await main(["--n", String(n), "--turns", "1", "--case", "chest-tightness-01", "--personality", "downplaying", "--md", "summary.md"]);
    const expectedCalls = Array.from({ length: n }, (_, i) => Object.keys(values)
      .filter(name => i >= failureCount || name !== "anamnesis_report")
      .map(name => ({ name, model: name === "patient_turn" ? "gpt-4.1-mini" : "gpt-5-nano" }))).flat();
    assert.deepEqual(calls, expectedCalls);
    const files = await readdir(results);
    assert.equal(files.length, 2);
    const result = JSON.parse(await readFile(path.join(results, files.find(file => file.endsWith(".json"))!), "utf8"));
    const checkpoint = await readFile(path.join(results, files.find(file => file.endsWith(".jsonl"))!), "utf8");
    assert.ok(!checkpoint.includes("private provider"));
    assert.ok(!checkpoint.includes("placeholder"));
    const records = checkpoint.trim().split("\n").map(line => JSON.parse(line));
    assert.equal(records.length, n);
    const failures = Array.from({ length: failureCount }, (_, i) => ({
      caseId: "chest-tightness-01", personalityId: "downplaying", run: i + 1,
      error: { kind: "http", message: "OpenAI request failed with HTTP 400." },
    }));
    assert.deepEqual(result.failures, failures);
    assert.deepEqual(records, [...result.failures, ...result.runs]);
    assert.equal(result.runs.length, n - failureCount);
    assert.equal(result.aggregate.runs, n - failureCount);
    assert.equal(result.aggregate.factCoverage, 0);
    assert.equal(result.aggregate.invented, failureCount === 1 ? 1 : 0);
    assert.equal(result.aggregate.personalityAccuracy, n > failureCount ? 1 : 0);
    assert.equal(process.exitCode, n === failureCount ? 1 : 0);
    assert.equal(result.patientModel, "gpt-4.1-mini");
    assert.equal(result.textModel, "gpt-5-nano");
    assert.equal(result.model, "gpt-5-nano");
    const header = `Mode: openai · patient model gpt-4.1-mini · text model gpt-5-nano · failures ${failureCount}`;
    assert.equal(output[0], header);
    assert.ok((await readFile(path.join(directory, "summary.md"), "utf8")).startsWith(`${header}\n\n`));
    const usage = await loadUsage("eval");
    assert.equal(usage.recent.length, expectedCalls.length);
    for (const trace of usage.recent) {
      assert.equal(trace.model, trace.operation === "patient" ? "gpt-4.1-mini" : "gpt-5-nano");
      assert.equal(trace.status, trace.errorCode ? "error" : "ok");
    }
  });
}
