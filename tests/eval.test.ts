import { communicationSkills } from "../lib/case/types.ts";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { main } from "../scripts/eval.ts";
import { loadUsage } from "../lib/server/usage.ts";

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
