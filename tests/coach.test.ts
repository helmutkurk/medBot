import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../lib/case/types.ts";
import { buildConsistencyMemo, buildPatientInstructions, coachReport, getPersonality, loadCase, OpenAIError } from "../lib/engine/index.ts";

const chest = await loadCase("chest-tightness-01");
const opts = { apiKey: "placeholder" };
const feedback = { strengths: ["You asked about smoking."], improvements: ["Explore past history."], quotes: [], suggestions: [] };
function envelope(value: unknown): Response {
  return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
}

test("coach coverage and membership use valid disclosed ids while OpenAI supplies feedback", async t => {
  const question = "Do you smoke?";
  const history: ChatMessage[] = [{ role: "student", text: question }, { role: "patient", text: chest.facts.find(f => f.id === "smoking")!.lay }];
  t.mock.method(globalThis, "fetch", async () => envelope({ ...feedback,
    quotes: [{ fact_id: "smoking", quote: question }, { fact_id: "not_a_fact", quote: question }],
    suggestions: [{ fact_id: "allergies", question: "Are you allergic to anything?" }],
  }));
  const report = await coachReport(chest, history, ["smoking", "smoking", "not_a_fact"], opts);
  assert.equal(report.mode, "openai");
  assert.equal(report.covered.length + report.missed.length, chest.facts.length);
  assert.equal(report.score, Math.round(100 / chest.facts.length));
  assert.deepEqual(report.covered.map(f => f.factId), ["smoking"]);
  assert.equal(report.covered[0]?.quote, question);
  assert.equal(report.coverage.reduce((s, r) => s + r.total, 0), chest.facts.length);
  assert.equal(report.coverage.reduce((s, r) => s + r.found, 0), 1);
  assert.ok(report.missed.every(m => m.label && m.suggestedQuestion.endsWith("?")));
  assert.deepEqual(report.strengths, feedback.strengths);
  assert.deepEqual(report.improvements, feedback.improvements);
  assert.equal((await coachReport(chest, [], [], opts)).score, 0);
  const full = await coachReport(chest, history, chest.facts.map(f => f.id), opts);
  assert.equal(full.score, 100);
  assert.deepEqual(full.missed, []);
});

test("coach accepts only transcript quotes and keeps membership independent of model references", async t => {
  t.mock.method(globalThis, "fetch", async () => envelope({ ...feedback,
    quotes: [{ fact_id: "smoking", quote: "Invented student wording" }],
    suggestions: [{ fact_id: "smoking", question: "This fact is already covered?" }],
  }));
  const report = await coachReport(chest, [], ["smoking"], opts);
  assert.deepEqual(report.covered.map(f => f.factId), ["smoking"]);
  assert.equal(report.covered[0]?.quote, null);
  assert.ok(!report.missed.some(f => f.factId === "smoking"));
});

test("coach rejects malformed output and surfaces provider failures", async t => {
  for (const value of [null, {}, { ...feedback, strengths: [12] }, { ...feedback, quotes: [{}] }]) {
    t.mock.method(globalThis, "fetch", async () => envelope(value));
    await assert.rejects(coachReport(chest, [], [], opts), error => error instanceof OpenAIError && error.kind === "invalid_response");
  }
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  await assert.rejects(coachReport(chest, [], [], opts), error => error instanceof OpenAIError && error.status === 401);
});

test("prompt has voice delivery per personality and memo lists only disclosed facts", () => {
  const dow = buildPatientInstructions(chest, getPersonality(chest, "downplaying"));
  const anx = buildPatientInstructions(chest, getPersonality(chest, "anxious"));
  for (const prompt of [dow, anx]) { assert.ok(prompt.includes("VOICE DELIVERY")); assert.ok(prompt.includes("never_say")); assert.ok(prompt.includes("reveal_fact")); }
  assert.ok(dow.includes("slow and even") && anx.includes("slightly quick"));
  const memo = buildConsistencyMemo(chest, ["smoking", "smoking", "bogus"]);
  assert.ok(memo.includes(chest.facts.find(f => f.id === "smoking")!.lay));
  assert.ok(!memo.includes(chest.facts.find(f => f.id === "alcohol")!.lay));
  assert.ok(buildConsistencyMemo(chest, []).includes("Nothing medical"));
});
