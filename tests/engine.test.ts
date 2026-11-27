import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { ChatMessage } from "../lib/case/types.ts";
import { buildPatientInstructions, buildRevealFactTool, CaseNotFoundError, findJargon, getPersonality, guardTurn, listCases, loadCase, patientTurn, validateCase } from "../lib/engine/index.ts";

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

test("mock matches a requested fact, never discloses on hello, and preserves unknowns", async () => {
  const p = getPersonality(chest);
  const greeting = await patientTurn(chest, p, [], "hello", {});
  assert.deepEqual(greeting.revealed, []);
  assert.equal(greeting.mode, "mock");
  const response = await patientTurn(chest, p, [], "Do you smoke?", {});
  assert.deepEqual(response.revealed, ["smoking"]);
  assert.ok(response.reply.toLowerCase().includes(chest.facts.find(f => f.id === "smoking")!.lay.toLowerCase()));
  assert.ok(response.latencyMs >= 0);
  const repeated = await patientTurn(chest, p, [], "Do you smoke?", {});
  assert.equal(response.reply, repeated.reply);
  assert.deepEqual(response.revealed, repeated.revealed);
  const unknown = await patientTurn(chest, p, [], "What was your last blood test result?", {});
  assert.deepEqual(unknown.revealed, []);
  assert.ok(unknown.reply.toLowerCase().includes(chest.unknown_answer.toLowerCase()));
});

test("mock opening, follow-up and medication specificity honor disclosure conditions", async () => {
  const p = getPersonality(chest);
  const opening = await patientTurn(chest, p, [], "What brings you here?", {});
  assert.equal(opening.reply, p.opening_line);
  const history: ChatMessage[] = [{ role: "student", text: "What brings you here?" }, { role: "patient", text: opening.reply }];
  const followup = await patientTurn(chest, p, history, "What do you mean by nothing?", {});
  assert.deepEqual(followup.revealed, ["chest_tightness"]);
  assert.deepEqual((await patientTurn(chest, p, [], "Do you take any medication?", {})).revealed, []);
  assert.deepEqual((await patientTurn(chest, p, [], "Do you take tablets daily for blood pressure?", {})).revealed, ["bp_medication"]);
  assert.deepEqual((await patientTurn(chest, p, [], "What is your family history?", {})).revealed, ["family_history"]);
});

test("jargon matching handles case, variants and phrases without inner-word matches", () => {
  assert.deepEqual(findJargon(chest, "It feels tight in my chest."), []);
  const hits = findJargon(chest, "ANGINA and myocardial infarction with dyspnoea, coronary disease and hypertension.");
  for (const word of ["angina", "myocardial", "coronary", "hypertension", "dyspnoea"]) assert.ok(hits.includes(word), word);
  assert.equal(hits.filter(w => w === "hypertension").length, 1);
  assert.deepEqual(findJargon({ ...chest, never_say: ["a+b", "right iliac fossa"] }, "a+b and right   iliac fossa"), ["a+b", "right iliac fossa"]);
  assert.deepEqual(findJargon({ ...chest, never_say: ["angina"] }, "panginal"), []);
});

test("mock guard flags jargon, exact unprompted disclosures and broken role", async () => {
  const history: ChatMessage[] = [{ role: "student", text: "Hello." }];
  const jargon = await guardTurn(chest, history, "I have angina.", {});
  assert.equal(jargon.mode, "mock");
  assert.equal(jargon.ok, false);
  assert.ok(jargon.issues.some(i => i.type === "jargon"));
  const unasked = await guardTurn(chest, history, "No allergies that I know of.", {});
  assert.ok(unasked.issues.some(i => i.type === "unprompted"));
  assert.ok((await guardTurn(chest, history, "As an AI, I can help.", {})).issues.some(i => i.type === "out_of_character"));
  assert.deepEqual((await guardTurn(chest, history, "Hello.", {})).issues, []);
});

test("a requested fact passes the mock guard and cancelled turns stop", async () => {
  const question = "Do you smoke?";
  const response = await patientTurn(chest, getPersonality(chest), [], question, {});
  const guard = await guardTurn(chest, [{ role: "student", text: question }], response.reply, {});
  assert.equal(guard.ok, true);
  const signal = AbortSignal.abort();
  await assert.rejects(patientTurn(chest, getPersonality(chest), [], question, { signal }));
  await assert.rejects(guardTurn(chest, [], "Hello.", { signal }));
});
