import assert from "node:assert/strict";
import test from "node:test";
import { loadCase, getPersonality, patientTurn, guardTurn } from "../lib/engine/index.ts";
import { DEFAULT_TEXT_MODEL, OpenAIError, requestStructured } from "../lib/engine/openai.ts";

function envelope(value: unknown): Response {
  return Response.json({ status: "completed", output: [{ type: "reasoning", summary: [] }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
}
const request = { instructions: "Test", input: [{ role: "user" as const, content: "Hello" }], name: "test", schema: { type: "object" } };
const opts = { apiKey: "placeholder-test-key" };

test("Responses request uses strict structured output and default or overridden model", async () => {
  const original = globalThis.fetch;
  const models: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.store, false);
    models.push(body.model);
    return envelope({ value: "ok" });
  };
  try {
    assert.deepEqual(await requestStructured(request, opts), { value: "ok" });
    await requestStructured(request, { ...opts, model: "test-model" });
    assert.deepEqual(models, [DEFAULT_TEXT_MODEL, "test-model"]);
  } finally { globalThis.fetch = original; }
});

test("429 and 5xx are retried once; authentication failures are not retried or echoed", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [429, 503]) {
      let calls = 0;
      globalThis.fetch = async () => ++calls === 1 ? new Response("private provider message", { status, headers: { "retry-after": "0" } }) : envelope({ ok: true });
      assert.deepEqual(await requestStructured(request, opts), { ok: true });
      assert.equal(calls, 2);
    }
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("private provider message", { status: 401 }); };
    await assert.rejects(requestStructured(request, opts), error => error instanceof OpenAIError && error.status === 401 && !error.message.includes("private") && !error.message.includes(opts.apiKey));
    assert.equal(calls, 1);
    calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("private", { status: 500, headers: { "retry-after": "0" } }); };
    await assert.rejects(requestStructured(request, opts), error => error instanceof OpenAIError && error.status === 500);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test("timeouts, cancellation, refusal and malformed responses have typed errors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Test timer expired")), 100);
      init?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(init.signal?.reason); }, { once: true });
    });
    await assert.rejects(requestStructured({ ...request, timeoutMs: 5 }, opts), error => error instanceof OpenAIError && error.kind === "timeout");
    await assert.rejects(requestStructured(request, { ...opts, signal: AbortSignal.abort() }), error => error instanceof OpenAIError && error.kind === "aborted");
    globalThis.fetch = async () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] });
    await assert.rejects(requestStructured(request, opts), error => error instanceof OpenAIError && error.kind === "refusal");
    globalThis.fetch = async () => Response.json({ status: "incomplete", output: [] });
    await assert.rejects(requestStructured(request, opts), error => error instanceof OpenAIError && error.kind === "invalid_response");
    globalThis.fetch = async () => { throw new Error(opts.apiKey); };
    await assert.rejects(requestStructured(request, opts), error => error instanceof OpenAIError && error.kind === "network" && !error.message.includes(opts.apiKey));
  } finally { globalThis.fetch = original; }
});

test("live patient adapter filters unknown ids, keeps history and measures the complete request", async () => {
  const c = await loadCase("chest-tightness-01");
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.input, [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hello." }, { role: "user", content: "Do you smoke?" }]);
    await new Promise(resolve => setTimeout(resolve, 5));
    return envelope({ reply: "Twenty a day.", revealed: ["smoking", "unknown_id", "smoking"] });
  };
  try {
    const turn = await patientTurn(c, getPersonality(c), [{ role: "student", text: "Hello" }, { role: "patient", text: "Hello." }], "Do you smoke?", opts);
    assert.equal(turn.mode, "openai");
    assert.deepEqual(turn.revealed, ["smoking"]);
    assert.ok(turn.latencyMs >= 4);
  } finally { globalThis.fetch = original; }
});

test("live guard merges deterministic jargon even when the judge misses it", async () => {
  const c = await loadCase("chest-tightness-01");
  const original = globalThis.fetch;
  globalThis.fetch = async () => envelope({ ok: true, issues: [], mode: "openai" });
  try {
    const guard = await guardTurn(c, [{ role: "student", text: "How are you?" }], "I have angina.", opts);
    assert.equal(guard.ok, false);
    assert.equal(guard.mode, "openai");
    assert.ok(guard.issues.some(i => i.type === "jargon"));
  } finally { globalThis.fetch = original; }
});
