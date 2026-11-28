import assert from "node:assert/strict";
import test from "node:test";
import { POST as chat } from "../app/api/chat/route.ts";
import { POST as guard } from "../app/api/guard/route.ts";
import { POST as coach } from "../app/api/coach/route.ts";
import { POST as anamnesis } from "../app/api/anamnesis/route.ts";
import { POST as generate } from "../app/api/cases/generate/route.ts";
import { POST as session } from "../app/api/session/route.ts";
import { POST as memo } from "../app/api/memo/route.ts";
import { GET as health } from "../app/api/health/route.ts";
import { GET as cases } from "../app/api/cases/route.ts";
import { json, route } from "../lib/server/http.ts";
import { DEFAULT_PATIENT_MODEL, DEFAULT_TEXT_MODEL, OpenAIError, MissingApiKeyError, requestStructured } from "../lib/engine/openai.ts";
import { loadUsage } from "../lib/server/usage.ts";

process.env.OPENAI_API_KEY = "";
const input = { caseId: "chest-tightness-01", personalityId: "downplaying", text: "Hello", reply: "Hello.", history: [], revealed: [], diagnosis: "Chest pain" };
function request(value = input): Request {
  return new Request("http://localhost/api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
}

test("health and cases remain available without a key; all interview endpoints return setup error", async t => {
  process.env.OPENAI_API_KEY = "";
  t.mock.method(globalThis, "fetch", async () => { throw new Error("No provider request is allowed without a key"); });
  const status = await (await health()).json();
  assert.deepEqual(Object.keys(status).sort(), ["models", "ready"]);
  assert.equal(status.ready, false);
  assert.ok(status.models.text);
  assert.ok(status.models.patient);
  assert.equal((await cases()).status, 200);
  for (const handler of [chat, guard, coach, anamnesis, generate, session, memo]) {
    const response = await handler(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: "no_api_key", message: "Set OPENAI_API_KEY in .env.local and restart the server." } });
  }
});

test("chat returns real adapter output and safe upstream errors", async t => {
  process.env.OPENAI_API_KEY = "placeholder";
  t.after(() => { process.env.OPENAI_API_KEY = ""; });
  assert.equal((await (await health()).json()).ready, true);
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ reply: "Hello.", revealed: [] }) }] }] }));
  const response = await chat(request());
  assert.equal(response.status, 200);
  const turn = await response.json();
  assert.equal(turn.mode, "openai");
  assert.equal(turn.reply, "Hello.");
  for (const [kind, status, code] of [["timeout", 504, "timeout"], ["http", 502, "upstream_error"], ["invalid_response", 502, "upstream_error"], ["network", 502, "upstream_error"], ["refusal", 502, "upstream_error"]] as const) {
    t.mock.method(globalThis, "fetch", async () => { throw new OpenAIError(kind, "private provider data", 401); });
    const failed = await chat(request());
    assert.equal(failed.status, status);
    const value = await failed.json();
    assert.equal(value.error.code, code);
    assert.ok(!JSON.stringify(value).includes("private"));
  }
});

test("chat uses the patient model independently of the guard text model, including defaults and traces", async t => {
  const originalPatient = process.env.OPENAI_PATIENT_MODEL;
  const originalText = process.env.OPENAI_TEXT_MODEL;
  process.env.OPENAI_API_KEY = "placeholder";
  t.after(() => {
    process.env.OPENAI_API_KEY = "";
    if (originalPatient === undefined) delete process.env.OPENAI_PATIENT_MODEL;
    else process.env.OPENAI_PATIENT_MODEL = originalPatient;
    if (originalText === undefined) delete process.env.OPENAI_TEXT_MODEL;
    else process.env.OPENAI_TEXT_MODEL = originalText;
  });
  const calls: { name: string; model: string }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const name = body.text.format.name;
    calls.push({ name, model: body.model });
    const value = name === "patient_turn" ? { reply: "Hello.", revealed: [] } : { ok: true, issues: [], mode: "openai" };
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  });
  for (const config of [
    { patient: undefined, text: undefined, patientModel: DEFAULT_PATIENT_MODEL, textModel: DEFAULT_TEXT_MODEL },
    { patient: "", text: "  gpt-5-nano  ", patientModel: DEFAULT_PATIENT_MODEL, textModel: "gpt-5-nano" },
    { patient: "   ", text: "  ", patientModel: DEFAULT_PATIENT_MODEL, textModel: DEFAULT_TEXT_MODEL },
    { patient: "  gpt-4.1  ", text: "  gpt-5-nano  ", patientModel: "gpt-4.1", textModel: "gpt-5-nano" },
  ]) {
    if (config.patient === undefined) delete process.env.OPENAI_PATIENT_MODEL;
    else process.env.OPENAI_PATIENT_MODEL = config.patient;
    if (config.text === undefined) delete process.env.OPENAI_TEXT_MODEL;
    else process.env.OPENAI_TEXT_MODEL = config.text;
    const status = await (await health()).json();
    assert.equal(status.models.patient, config.patientModel);
    assert.equal(status.models.text, config.textModel);
    calls.length = 0;
    const response = await chat(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, "Hello.");
    const guarded = await guard(request());
    assert.equal(guarded.status, 200);
    assert.equal((await guarded.json()).ok, true);
    assert.deepEqual(calls, [
      { name: "patient_turn", model: config.patientModel },
      { name: "guard_result", model: config.textModel },
    ]);
    const usage = await loadUsage();
    assert.ok(usage.recent.some(trace => trace.route === "/api/chat" && trace.operation === "patient" && trace.model === config.patientModel && trace.source === "app" && trace.status === "ok"));
    assert.ok(usage.recent.some(trace => trace.route === "/api/guard" && trace.operation === "guard" && trace.model === config.textModel && trace.source === "app" && trace.status === "ok"));
  }
});

test("route maps actual deadline errors, cancellation and missing credentials", async t => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Test deadline exceeded")), 100);
    init.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(init.signal?.reason); }, { once: true });
  }));
  const response = await route(async () => json(await requestStructured({ instructions: "Test", input: [], name: "test", schema: {}, timeoutMs: 5 }, { apiKey: "placeholder" })));
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "timeout");
  const missing = await route(async () => { throw new MissingApiKeyError(); });
  assert.equal(missing.status, 503);
  const cancelled = await route(async () => { throw new OpenAIError("aborted", "Cancelled"); });
  assert.equal(cancelled.status, 499);
});
