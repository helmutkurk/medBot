import assert from "node:assert/strict";
import test from "node:test";
import { main } from "../scripts/eval.ts";
import { anamnesisReport, coachReport, generateCase, getPersonality, guardTurn, loadCase, MissingApiKeyError, OpenAIError, patientTurn } from "../lib/engine/index.ts";
import { requestStructured } from "../lib/engine/openai.ts";

const c = await loadCase("chest-tightness-01");
const p = getPersonality(c);

test("every engine entry point requires a key before any provider request", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  for (const opts of [{}, { apiKey: "   " }]) {
    for (const action of [
      () => patientTurn(c, p, [], "Hello", opts),
      () => guardTurn(c, [], "Hello", opts),
      () => coachReport(c, [], [], opts),
      () => anamnesisReport(c, [], [], opts),
      () => generateCase({ diagnosis: "Chest pain" }, opts),
      () => requestStructured({ instructions: "Test", input: [], name: "test", schema: {} }, opts),
    ]) await assert.rejects(action(), MissingApiKeyError);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("all engines surface provider failure instead of producing content", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("private provider error", { status: 401 }));
  const opts = { apiKey: "placeholder" };
  for (const action of [
    () => patientTurn(c, p, [], "Hello", opts),
    () => guardTurn(c, [], "Hello", opts),
    () => coachReport(c, [], [], opts),
    () => anamnesisReport(c, [], [], opts),
    () => generateCase({ diagnosis: "Chest pain" }, opts),
  ]) await assert.rejects(action(), error => error instanceof OpenAIError && error.status === 401 && !error.message.includes("private"));
});

test("evaluation requires a key before starting an interview", async () => {
  process.env.OPENAI_API_KEY = "";
  await assert.rejects(main(), MissingApiKeyError);
});
