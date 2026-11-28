import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildPatientInstructions, buildRevealFactTool, CaseNotFoundError, findJargon, getPersonality, listCases, loadCase, validateCase } from "../lib/engine/index.ts";

const chest = await loadCase("chest-tightness-01");

test("every case file validates, including complete patient identity and unique facts", async () => {
  const files = (await readdir("cases")).filter(f => f.endsWith(".json"));
  assert.ok(files.length >= 2);
  for (const file of files) {
    const value: unknown = JSON.parse(await readFile(path.join("cases", file), "utf8"));
    assert.deepEqual(validateCase(value), [], file);
  }
});

test("validation reports malformed fields and duplicate ids without throwing", () => {
  assert.ok(validateCase(null).length);
  assert.ok(validateCase({}).length >= 7);
  const broken = structuredClone(chest);
  broken.facts.push({ ...broken.facts[0]! });
  broken.patient.age = -1;
  broken.unknown_answer = "";
  const errors = validateCase(broken);
  assert.ok(errors.some(e => e.includes("duplicated")));
  assert.ok(errors.some(e => e.includes("age")));
  assert.ok(errors.some(e => e.includes("unknown_answer")));
  assert.ok(validateCase({ ...chest, facts: [null], personalities: [4] }).length >= 2);
});

test("case summaries are sorted, ids are independent of filenames and missing ids fail safely", async () => {
  const cases = await listCases();
  assert.deepEqual(cases.map(c => c.title), [...cases.map(c => c.title)].sort());
  assert.equal((await loadCase("chest-tightness-01")).id, chest.id);
  assert.equal(cases.find(c => c.id === chest.id)?.factCount, chest.facts.length);
  await assert.rejects(loadCase("../../outside"), CaseNotFoundError);
  assert.equal(getPersonality(chest).id, chest.personalities[0]?.id);
  assert.equal(getPersonality(chest, "anxious").voice, "ash");
  assert.throws(() => getPersonality(chest, "missing"), /Unknown personality/);
  assert.throws(() => getPersonality(chest, ""), /Unknown personality/);
});

test("the shared voice/text prompt is deterministic and includes truth, disclosure and lay constraints", () => {
  const p = getPersonality(chest);
  const prompt = buildPatientInstructions(chest, p);
  assert.equal(prompt, buildPatientInstructions(chest, p));
  for (const fact of chest.facts) {
    for (const text of [fact.id, fact.truth, fact.lay, fact.reveal_when]) assert.ok(prompt.includes(text));
  }
  for (const word of chest.never_say) assert.ok(prompt.includes(word));
  for (const rule of ["never_say", "reveal_fact", "1-3 sentences", "Never invent medical facts", "unknown_answer", "revealed", "English only"]) assert.ok(prompt.includes(rule));
  assert.ok(prompt.includes(p.style));
  assert.notEqual(prompt, buildPatientInstructions(chest, getPersonality(chest, "anxious")));
});

test("the Realtime reveal_fact tool restricts ids to the selected case", () => {
  const tool = buildRevealFactTool(chest);
  assert.equal(tool.type, "function");
  assert.equal(tool.name, "reveal_fact");
  assert.deepEqual(tool.parameters, {
    type: "object", properties: { fact_id: { type: "string", enum: chest.facts.map(f => f.id) } },
    required: ["fact_id"], additionalProperties: false,
  });
});

test("jargon matching handles case, variants and phrases without inner-word matches", () => {
  assert.deepEqual(findJargon(chest, "It feels tight in my chest."), []);
  const hits = findJargon(chest, "ANGINA and myocardial infarction with dyspnoea, coronary disease and hypertension.");
  for (const word of ["angina", "myocardial", "coronary", "hypertension", "dyspnoea"]) assert.ok(hits.includes(word), word);
  assert.equal(hits.filter(w => w === "hypertension").length, 1);
  assert.deepEqual(findJargon({ ...chest, never_say: ["a+b", "right iliac fossa"] }, "a+b and right   iliac fossa"), ["a+b", "right iliac fossa"]);
  assert.deepEqual(findJargon({ ...chest, never_say: ["angina"] }, "panginal"), []);
});

