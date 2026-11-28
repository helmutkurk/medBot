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
import { OpenAIError, MissingApiKeyError, requestStructured } from "../lib/engine/openai.ts";

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
