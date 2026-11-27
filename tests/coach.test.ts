import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../lib/case/types.ts";
import { buildConsistencyMemo, buildPatientInstructions, coachReport, findJargon, getPersonality, loadCase, patientTurn } from "../lib/engine/index.ts";

const chest = await loadCase("chest-tightness-01");
const abdo = await loadCase("abdominal-pain-01");

async function talk(c: typeof chest, questions: string[]) {
  const p = getPersonality(c);
  const history: ChatMessage[] = [];
  const revealed: string[] = [];
  for (const q of questions) {
    const t = await patientTurn(c, p, history, q, {});
    history.push({ role: "student", text: q }, { role: "patient", text: t.reply });
    revealed.push(...t.revealed);
  }
  return { history, revealed };
}

test("coachReport mock is deterministic and computed from revealed ids", async () => {
  const { history, revealed } = await talk(chest, ["What brings you here?", "Do you smoke?", "Do you have any allergies?"]);
  const a = await coachReport(chest, history, revealed, {});
  assert.deepEqual(a, await coachReport(chest, history, revealed, {}));
  assert.equal(a.mode, "mock");
  assert.equal(a.covered.length + a.missed.length, chest.facts.length);
  assert.equal(a.score, Math.round(100 * a.covered.length / chest.facts.length));
  assert.deepEqual(a.covered.map(f => f.factId).sort(), [...new Set(revealed)].sort());
  assert.equal(a.covered.find(f => f.factId === "smoking")?.quote, "Do you smoke?");
  assert.equal(a.coverage.reduce((s, r) => s + r.total, 0), chest.facts.length);
  assert.equal(a.coverage.reduce((s, r) => s + r.found, 0), a.covered.length);
  assert.ok(a.missed.every(m => m.label && m.suggestedQuestion.endsWith("?")));
  assert.ok(a.strengths.length >= 1 && a.strengths.length <= 3 && a.improvements.length >= 1);
  const empty = await coachReport(chest, [], [], {});
  assert.equal(empty.score, 0);
  const forged = await coachReport(chest, [], ["smoking", "not_a_fact"], {});
  assert.deepEqual(forged.covered.map(f => f.factId), ["smoking"]);
  assert.equal(forged.covered[0]?.quote, null);
});

test("broad questions do not dump facts and stay non-medical", async () => {
  for (const q of ["Tell me about yourself.", "Any other problems?", "Is there anything else?", "How are you?"]) {
    const t = await patientTurn(chest, getPersonality(chest), [], q, {});
    assert.deepEqual(t.revealed, [], q);
    for (const f of chest.facts) assert.ok(!t.reply.includes(f.lay), q);
  }
  const t = await patientTurn(abdo, getPersonality(abdo), [], "Any other problems with your bowels?", {});
  assert.deepEqual(t.revealed, ["bowels"]);
});

test("repeated questions stay consistent and jargon bait stays lay", async () => {
  const { history, revealed } = await talk(chest, ["Do you smoke?", "How much alcohol do you drink?", "Do you smoke?"]);
  assert.equal(history[1]!.text, history[5]!.text);
  assert.deepEqual(revealed, ["smoking", "alcohol", "smoking"]);
  for (const bait of ["Is it angina?", "Do you have hypertension and coronary disease?", "Could it be a myocardial infarction?"]) {
    const t = await patientTurn(chest, getPersonality(chest), [], bait, {});
    assert.deepEqual(findJargon(chest, t.reply), [], bait);
    assert.deepEqual(t.revealed, [], bait);
  }
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
