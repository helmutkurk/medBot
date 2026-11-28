import { communicationSkills } from "../lib/case/types.ts";
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../lib/case/types.ts";
import { buildConsistencyMemo, buildPatientInstructions, coachReport, getPersonality, loadCase, OpenAIError } from "../lib/engine/index.ts";

const chest = await loadCase("chest-tightness-01");
const opts = { apiKey: "placeholder" };
const feedback = { opportunities: [], strengths: ["You asked about smoking."], improvements: ["Explore past history."], quotes: [], suggestions: [], communication: Object.fromEntries(communicationSkills.map(skill => [skill, { score: 0, evidence: "", tip: "Practise this skill explicitly." }])) };
function envelope(value: unknown): Response {
  return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
}

const byName = (handlers: Record<string, () => Response>) => async (_url: unknown, init: RequestInit) => handlers[JSON.parse(String(init.body)).text.format.name]!();

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
  for (const value of [null, {}]) {
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

test("coach requests strict Calgary-Cambridge ratings and validates exact student evidence", async t => {
  const question = "What worries you most?";
  const communication = { ...feedback.communication, ice_exploration: { score: 1, evidence: "worries you most", tip: "Also ask about ideas and expectations." } };
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.text.format.strict, true);
    assert.equal(body.store, false);
    if (body.text.format.name === "coach_coverage") return envelope(feedback);
    assert.deepEqual(body.text.format.schema.properties.communication.required, [...communicationSkills]);
    assert.deepEqual(JSON.parse(body.input[0].content).focus, ["Explore ICE"]);
    return envelope({ ...feedback, communication });
  });
  const report = await coachReport(chest, [{ role: "student", text: question }], [], opts, ["Explore ICE"]);
  assert.deepEqual(report.communication.ice_exploration, communication.ice_exploration);
  assert.equal(report.score, 0);
  for (const invalid of [undefined, {}, { ...communication, empathy: { score: 3, evidence: "", tip: "Try" } }, { ...communication, empathy: { score: 0, evidence: "", tip: "" } }]) {
    t.mock.method(globalThis, "fetch", async () => envelope({ ...feedback, communication: invalid }));
    t.mock.method(globalThis, "fetch", byName({ coach_coverage: () => envelope(feedback), coach_communication: () => envelope({ ...feedback, communication: invalid }) }));
    assert.equal((await coachReport(chest, [{ role: "student", text: question }, { role: "patient", text: "Patient-only wording" }], [], opts)).partial?.missing, "communication");
  }
  // Unverifiable or patient-side quotes are dropped rather than failing the whole report.
  for (const evidence of ["", "Invented", "Patient-only wording"]) {
    t.mock.method(globalThis, "fetch", async () => envelope({ ...feedback, communication: { ...communication, empathy: { score: 1, evidence, tip: "Try" } } }));
    const kept = await coachReport(chest, [{ role: "student", text: question }, { role: "patient", text: "Patient-only wording" }], [], opts);
    assert.equal(kept.communication.empathy.evidence, "");
  }
  t.mock.method(globalThis, "fetch", async () => envelope({ ...feedback, communication: { ...communication, ice_exploration: { score: 1, evidence: "  WORRIES   you most ", tip: "Ask" } } }));
  assert.equal((await coachReport(chest, [{ role: "student", text: question }], [], opts)).communication.ice_exploration.evidence, "WORRIES   you most");
});

test("missed opportunities require adjacent patient/student quotes at the claimed turn", async t => {
  const history: ChatMessage[] = [
    { role: "patient", text: "I am frightened this will happen again." },
    { role: "student", text: "Do you smoke?" },
    { role: "patient", text: "No." },
    { role: "student", text: "Any medicines?" },
  ];
  const valid = { turn: 1, patientCue: "frightened", learnerResponse: "Do you smoke?", better: "That sounds frightening. What worries you most?" };
  t.mock.method(globalThis, "fetch", async () => envelope({ ...feedback, opportunities: [valid,
    { ...valid, turn: 3 }, // the quoted cue is not the preceding patient turn
    { ...valid, turn: 0 }, // a patient cannot be the learner response
  ] }));
  const report = await coachReport(chest, history, [], opts);
  assert.deepEqual(report.opportunities, [valid]);
  for (const invalid of [{ ...valid, patientCue: "invented" }, { ...valid, learnerResponse: "invented" }, { ...valid, patientCue: "" }, { ...valid, turn: 1.5 }, { ...valid, turn: -1 }]) {
    t.mock.method(globalThis, "fetch", async () => envelope({ ...feedback, opportunities: [invalid] }));
    assert.deepEqual((await coachReport(chest, history, [], opts)).opportunities, []);
  }
});

test("coach sends two parallel, size-limited requests and merges them", async t => {
  const names: string[] = [];
  const first = (chest.facts.find(f => f.red_flag) ?? chest.facts[0]!).id;
  const mock = t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    names.push(body.text.format.name);
    assert.match(body.instructions, /at most 20 words/);
    if (body.text.format.name === "coach_coverage") {
      assert.ok(!("communication" in body.text.format.schema.properties));
      // Only red flags plus at most five other gaps are sent as suggestion targets.
      const sent = JSON.parse(body.instructions.slice(body.instructions.indexOf("{"))) as { gaps: { id: string }[] };
      const redFlags = chest.facts.filter(f => f.red_flag).length;
      assert.ok(sent.gaps.length <= redFlags + 5);
      return envelope({ quotes: [], suggestions: [{ fact_id: first, question: Array.from({ length: 50 }, () => "word").join(" ") + "?" }] });
    }
    assert.ok(!("quotes" in body.text.format.schema.properties));
    assert.equal(body.text.format.schema.properties.opportunities.maxItems, 3);
    return envelope({ ...feedback, strengths: [Array.from({ length: 80 }, () => "long").join(" ")] });
  });
  const report = await coachReport(chest, [], [], opts);
  assert.equal(mock.mock.callCount(), 2);
  assert.deepEqual(names.sort(), ["coach_communication", "coach_coverage"]);
  assert.equal(report.partial, undefined);
  assert.equal(report.missed.find(f => f.factId === first)?.suggestedQuestion.split(" ").length, 30);
  assert.equal(report.strengths[0]?.split(" ").length, 30);
  assert.deepEqual(report.improvements, feedback.improvements);
});

test("coach returns the surviving part with a partial flag when one request fails", async t => {
  t.mock.method(globalThis, "fetch", byName({ coach_coverage: () => new Response(null, { status: 400 }), coach_communication: () => envelope(feedback) }));
  const noCoverage = await coachReport(chest, [], ["smoking"], opts);
  assert.equal(noCoverage.partial?.missing, "coverage");
  assert.deepEqual(noCoverage.covered.map(f => f.factId), ["smoking"]);
  assert.ok(noCoverage.missed.every(m => m.suggestedQuestion.endsWith("?")));
  assert.deepEqual(noCoverage.strengths, feedback.strengths);

  t.mock.method(globalThis, "fetch", byName({ coach_coverage: () => envelope(feedback), coach_communication: () => envelope({ nope: true }) }));
  const noComm = await coachReport(chest, [], ["smoking"], opts);
  assert.equal(noComm.partial?.missing, "communication");
  assert.equal(noComm.score, Math.round(100 / chest.facts.length));
  assert.deepEqual(noComm.strengths, []);
  assert.deepEqual(noComm.opportunities, []);
  assert.equal(Object.keys(noComm.communication).length, communicationSkills.length);

  t.mock.method(globalThis, "fetch", byName({ coach_coverage: () => new Response(null, { status: 400 }), coach_communication: () => new Response(null, { status: 400 }) }));
  await assert.rejects(coachReport(chest, [], [], opts), error => error instanceof OpenAIError && error.status === 400);
});
