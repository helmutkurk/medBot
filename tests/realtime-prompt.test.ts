import assert from "node:assert/strict";
import test from "node:test";
import { listCases, loadCase } from "../lib/case/load.ts";
import { buildPatientInstructions, buildRealtimeInstructions, buildRealtimeSpeed, buildRevealFactTool } from "../lib/case/prompt.ts";
import { POST as session } from "../app/api/session/route.ts";
import { POST as memo } from "../app/api/memo/route.ts";

test("compact voice instructions preserve all case facts, reveal rules and personality data", async () => {
  for (const summary of await listCases()) {
    const c = await loadCase(summary.id);
    for (const p of c.personalities) {
      const instructions = buildRealtimeInstructions(c, p);
      for (const value of [c.patient, c.facts, p, c.never_say, c.unknown_answer]) assert.ok(instructions.includes(JSON.stringify(value)), `${c.id}/${p.id}`);
      assert.ok(instructions.includes(c.background));
      for (const rule of ["reveal_when", "broad opening", "specific medicine", "Never invent medical facts", "uncertainty never means a negative finding", "English only", "including repetitions", "Do not wait for a tool result", "contractions", "self-correction", "empathy", "sharp breath", "no-reassurance"]) assert.ok(instructions.includes(rule), rule);
      assert.ok(!instructions.includes("Wait for the tool result"));
      assert.ok(!instructions.includes("Return JSON"));
      assert.ok(instructions.length < buildPatientInstructions(c, p).length);
      assert.ok([0.98, 1.03, undefined].includes(buildRealtimeSpeed(p)));
    }
  }
});

test("session and six-turn memo keep the nonblocking voice prompt and high semantic VAD", async t => {
  process.env.OPENAI_API_KEY = "placeholder";
  t.after(() => { process.env.OPENAI_API_KEY = ""; });
  const c = await loadCase("chest-tightness-01"); const p = c.personalities[0]!;
  const instructions = buildRealtimeInstructions(c, p);
  const request = (revealed: string[] = []) => new Request("http://localhost/api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: c.id, personalityId: p.id, revealed }) });
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    assert.equal(url, "https://api.openai.com/v1/realtime/client_secrets");
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.session.instructions, instructions);
    assert.deepEqual(payload.session.output_modalities, ["audio"]);
    assert.deepEqual(payload.session.audio.output, { voice: p.voice, speed: 0.98 });
    assert.deepEqual(payload.session.audio.input.turn_detection, { type: "semantic_vad", eagerness: "high", create_response: true, interrupt_response: true });
    assert.deepEqual(payload.session.tools, [buildRevealFactTool(c, true)]);
    return Response.json({ value: "ephemeral-placeholder", expires_at: 1234567 });
  });
  const response = await session(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).clientSecret, "ephemeral-placeholder");
  const memoResponse = await memo(request([c.facts[0]!.id]));
  assert.equal(memoResponse.status, 200);
  const refreshed = (await memoResponse.json()).instructions;
  assert.ok(refreshed.startsWith(instructions));
  assert.ok(refreshed.includes("CONSISTENCY MEMO"));
  assert.ok(!refreshed.includes("Wait for the tool result"));
});
