import assert from "node:assert/strict";
import test from "node:test";
import { loadCase } from "../lib/case/load.ts";
import { patientTurn } from "../lib/engine/patient.ts";
import { OpenAIError } from "../lib/engine/openai.ts";

const chest = await loadCase("chest-tightness-01");
const opts = { apiKey: "placeholder-test-key" };

function envelope(reply: string, revealed: string[]): Response {
  return Response.json({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ reply, revealed }) }] }],
    usage: { input_tokens: 20, output_tokens: 12 },
  });
}

test("patient strips the generic unknown answer only after a valid fact is revealed", async t => {
  const answer = "Sometimes it spreads into my left arm.";
  const variants = [
    chest.unknown_answer,
    "I’m NOT sure about that! I couldn’t tell you!",
    "i'm not sure about that i couldn't tell you",
    "I'M  NOT SURE ABOUT THAT.\nI COULDN'T TELL YOU.",
  ];
  let reply = "";
  let revealed = ["radiation_left_arm", "radiation_left_arm", "unknown_id"];
  t.mock.method(globalThis, "fetch", async () => envelope(reply, revealed));
  for (const unknown of variants) {
    for (const text of [`${answer} ${unknown}`, `${unknown} ${answer}`, `${answer} ${unknown} Thank you.`]) {
      reply = text;
      const turn = await patientTurn(chest, chest.personalities[0]!, [], "Does it spread?", opts);
      assert.equal(turn.reply, text.endsWith("Thank you.") ? `${answer} Thank you.` : answer);
      assert.deepEqual(turn.revealed, ["radiation_left_arm"]);
    }
    for (const ids of [[], ["unknown_id"]]) {
      revealed = ids;
      reply = unknown;
      const turn = await patientTurn(chest, chest.personalities[0]!, [], "What was your blood pressure?", opts);
      assert.equal(turn.reply, unknown.replace(/\s+/g, " "));
      assert.deepEqual(turn.revealed, []);
    }
    revealed = ["radiation_left_arm"];
  }
});

test("patient uses the selected case's unknown wording and preserves scoped uncertainty", async t => {
  const c = { ...chest, unknown_answer: "I don't know; I haven't checked that." };
  let reply = "About five minutes. I don’t KNOW — I haven’t checked that!";
  t.mock.method(globalThis, "fetch", async () => envelope(reply, ["episode_duration"]));
  assert.equal((await patientTurn(c, c.personalities[0]!, [], "How long?", opts)).reply, "About five minutes.");
  reply = "About five minutes. I'm not sure about eating — I couldn't tell you.";
  assert.equal((await patientTurn(chest, chest.personalities[0]!, [], "How long, and does food affect it?", opts)).reply, reply);
});

test("patient strips leaked reveal calls and meta delimiters without changing coverage", async t => {
  const c = await loadCase("multimorbid-dizziness");
  const answer = "I felt dizzy this morning and ended up on the kitchen floor.";
  let reply = "";
  t.mock.method(globalThis, "fetch", async () => envelope(reply, ["dizziness_fall"]));
  for (const token of [
    "reveal_fact dizziness_fall",
    "reveal_fact <dizziness_fall>",
    "`reveal_fact dizziness_fall`",
    'reveal_fact({"fact_id":"dizziness_fall"})',
    'reveal_fact {"fact_id":"dizziness_fall"}',
    'reveal_fact("dizziness_fall")',
    "<|assistant|>",
  ]) {
    for (const text of [`${token}\n${answer}`, `${answer} ${token}`]) {
      reply = text;
      const turn = await patientTurn(c, c.personalities[0]!, [], "What brings you in?", opts);
      assert.equal(turn.reply, answer, token);
      assert.deepEqual(turn.revealed, ["dizziness_fall"]);
    }
  }
});

test("leaked tool calls do not grant disclosure or suppress an unknown-only answer", async t => {
  t.mock.method(globalThis, "fetch", async () => envelope(`reveal_fact smoking\n${chest.unknown_answer}`, []));
  const turn = await patientTurn(chest, chest.personalities[0]!, [], "What was your blood pressure?", opts);
  assert.equal(turn.reply, chest.unknown_answer);
  assert.deepEqual(turn.revealed, []);
});

test("patient rejects a reply with no spoken content after cleanup", async t => {
  let reply = "reveal_fact smoking";
  t.mock.method(globalThis, "fetch", async () => envelope(reply, ["smoking"]));
  for (const text of ["reveal_fact smoking", chest.unknown_answer, "<|assistant|>"]) {
    reply = text;
    await assert.rejects(patientTurn(chest, chest.personalities[0]!, [], "Do you smoke?", opts),
      error => error instanceof OpenAIError && error.kind === "invalid_response");
  }
});
