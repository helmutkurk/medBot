import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { anamnesisReport, generateCase, OpenAIError, listCases, loadCase, saveGeneratedCase, validateCase } from "../lib/engine/index.ts";

const chest = await loadCase("chest-tightness-01");
// The creator emits 10-15 facts; built-in cases are richer, so trim the fixture.
const generatedFixture = { ...chest, facts: chest.facts.slice(0, 15) };
function envelope(value: unknown): Response {
  return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
}

test("all built-in and generated cases validate; demo cases have distinct voices and required safety facts", async () => {
  for (const summary of await listCases()) assert.deepEqual(validateCase(await loadCase(summary.id)), []);
  for (const [id, age, flags] of [
    ["multimorbid-dizziness", 79, ["head_impact", "standing_trigger"]],
    ["thunderclap-headache", 41, ["time_to_peak", "worst_headache_comparison", "neck_stiffness"]],
  ] as const) {
    const c = await loadCase(id);
    assert.equal(c.patient.age, age);
    assert.ok(c.facts.length >= 12);
    assert.equal(new Set(c.personalities.map(p => p.voice)).size, 2);
    for (const flag of flags) assert.equal(c.facts.find(f => f.id === flag)?.red_flag, true);
  }
});

test("red_flag accepts only an optional boolean", () => {
  const f = chest.facts[0]!;
  for (const red_flag of [undefined, false, true]) assert.deepEqual(validateCase({ ...chest, facts: [{ ...f, red_flag }] }), []);
  for (const red_flag of ["true", 1, null]) assert.ok(validateCase({ ...chest, facts: [{ ...f, red_flag }] }).some(e => e.includes("red_flag")));
});

test("anamnesis keeps deterministic membership, sections and red flags with OpenAI wording", async t => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const rows = JSON.parse(body.instructions.slice(body.instructions.indexOf("\n") + 1));
    const documented = rows.flatMap((row: { documented: { factId: string; text: string }[] }) => row.documented);
    assert.ok(!JSON.stringify(body.text.format.schema).includes('"enum":[]'));
    return envelope({ note: documented.length ? "Documented interview findings." : "Not documented.", documented });
  });
  const opts = { apiKey: "placeholder" };
  const report = await anamnesisReport(chest, [], ["smoking", "smoking", "not_a_fact"], opts);
  assert.equal(report.mode, "openai");
  assert.equal(report.completeness, Math.round(100 / chest.facts.length));
  assert.deepEqual(report.sections.flatMap(s => s.documented.map(f => f.factId)), ["smoking"]);
  assert.deepEqual(report.sections.find(s => s.section === "social_history")?.documented.map(f => f.factId), ["smoking"]);
  assert.equal(report.sections.reduce((n, s) => n + s.missing.length, 0), chest.facts.length - 1);
  assert.ok(report.redFlagsMissed.some(f => f.factId === "radiation_left_arm"));
  assert.equal(report.sections.flatMap(s => s.missing).find(f => f.factId === "radiation_left_arm")?.redFlag, true);
  assert.deepEqual(report.fhirLike, {
    resourceType: "Composition", title: "Synthetic patient anamnesis", subject: { display: chest.patient.name },
    section: report.sections.map(s => ({ title: s.title, code: { text: s.section }, text: s.documented.map(f => f.text).join(" ") || "Not documented." })),
  });
  const full = await anamnesisReport(chest, [], chest.facts.map(f => f.id), opts);
  assert.equal(full.completeness, 100);
  assert.deepEqual(full.redFlagsMissed, []);
  const empty = await anamnesisReport(chest, [], [], opts);
  assert.equal(empty.completeness, 0);
  assert.deepEqual(empty.sections.flatMap(s => s.documented), []);
  assert.equal(empty.note, "Not documented.");

});

test("anamnesis rewrites only documented facts and rejects invalid membership or provider failure", async t => {
  const opts = { apiKey: "placeholder" };
  t.mock.method(globalThis, "fetch", async () => envelope({ note: "Smoking: 20 cigarettes daily for 30 years.", documented: [{ factId: "smoking", text: "Smokes 20 cigarettes daily for 30 years." }] }));
  const report = await anamnesisReport(chest, [], ["smoking"], opts);
  assert.equal(report.sections.flatMap(s => s.documented)[0]?.text, "Smokes 20 cigarettes daily for 30 years.");
  for (const documented of [[], [{ factId: "radiation_left_arm", text: "Undisclosed." }], [{ factId: "smoking", text: "A" }, { factId: "smoking", text: "B" }]]) {
    t.mock.method(globalThis, "fetch", async () => envelope({ note: "Bad", documented }));
    await assert.rejects(anamnesisReport(chest, [], ["smoking"], opts), error => error instanceof OpenAIError && error.kind === "invalid_response");
  }
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  await assert.rejects(anamnesisReport(chest, [], ["smoking"], opts), error => error instanceof OpenAIError && error.status === 401);
});

test("generated cases validate and save/load without changing title sorting", async t => {
  const input = { diagnosis: "Example / diagnosis", age: 63, sex: "female" as const, setting: "Outpatient clinic" };
  t.mock.method(globalThis, "fetch", async () => envelope({ ...generatedFixture, patient: { ...chest.patient, age: input.age, sex: input.sex } }));
  const generated = await generateCase(input, { apiKey: "placeholder" });
  assert.equal(generated.mode, "openai");
  const c = generated.case;
  assert.deepEqual(validateCase(c), []);
  assert.match(c.id, /^gen-example-diagnosis-[a-f0-9]+$/);
  assert.match(c.note, /AI-generated synthetic/);
  assert.equal(c.patient.age, 63);
  assert.equal(c.patient.sex, "female");
  const dir = await mkdtemp(path.join(tmpdir(), "medbot-cases-"));
  try {
    await writeFile(path.join(dir, "base.json"), JSON.stringify(chest));
    assert.equal((await listCases(dir)).length, 1);
    await saveGeneratedCase(c, dir);
    await saveGeneratedCase(c, dir);
    assert.deepEqual(await loadCase(c.id, dir), c);
    const summaries = await listCases(dir);
    assert.equal(summaries.length, 2);
    assert.deepEqual(summaries.map(s => s.title), summaries.map(s => s.title).sort());
    await assert.rejects(saveGeneratedCase({ ...c, title: "Changed" }, dir), /different generated case/);
    await assert.rejects(saveGeneratedCase({ ...c, id: "gen-../../escape" }, dir), /safe lowercase/);
    await writeFile(path.join(dir, "duplicate.json"), JSON.stringify(c));
    await assert.rejects(listCases(dir), /Duplicate patient case/);
  } finally { await rm(dir, { recursive: true, force: true }); }
  await assert.rejects(generateCase({ diagnosis: "" }, { apiKey: "placeholder" }), /Diagnosis/);
  await assert.rejects(generateCase({ diagnosis: "test", age: -1 }, { apiKey: "placeholder" }), /Age/);
});

test("live creator validates, retries once, uses structured output and normalises provenance", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.store, false);
    if (++calls === 1) return envelope({ ...generatedFixture, facts: [] });
    assert.match(body.input[0].content, /non-empty array/);
    return envelope(generatedFixture);
  });
  const result = await generateCase({ diagnosis: "Chest pain" }, { apiKey: "placeholder" });
  assert.equal(calls, 2);
  assert.equal(result.mode, "openai");
  assert.match(result.case.note, /AI-generated synthetic/);
  assert.match(result.case.id, /^gen-chest-pain-/);
  assert.deepEqual(validateCase(result.case), []);
  t.mock.method(globalThis, "fetch", async () => envelope({}));
  await assert.rejects(generateCase({ diagnosis: "Test" }, { apiKey: "placeholder" }), /after two attempts/);
});
