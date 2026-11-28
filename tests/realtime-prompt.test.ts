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
      for (const rule of ["reveal_when", "broad opening", "specific medicine", "Never invent medical facts", "uncertainty never means a negative finding", "English only", "including repetitions", "Do not wait for a tool result", "contractions", "self-correction", "empathy", "no-reassurance"]) assert.ok(instructions.includes(rule), rule);
      assert.ok(!instructions.includes("Wait for the tool result"));
      assert.ok(!instructions.includes("Return JSON"));
      assert.ok(instructions.length < buildPatientInstructions(c, p).length);
      assert.ok([0.98, 1.03, undefined].includes(buildRealtimeSpeed(p)));
    }
  }
});

test("session and six-turn memo keep the nonblocking voice prompt and high semantic VAD", async t => {
  process.env.OPENAI_API_KEY = "placeholder";
  const previousVAD = process.env.OPENAI_TURN_DETECTION;
  delete process.env.OPENAI_TURN_DETECTION;
  t.after(() => { if (previousVAD === undefined) delete process.env.OPENAI_TURN_DETECTION; else process.env.OPENAI_TURN_DETECTION = previousVAD; });
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


test("Realtime v2 has one delivery dial, no acted breathing, and preserves the text path", async () => {
  const c = await loadCase("abdominal-pain-01");
  const anxious = buildRealtimeInstructions(c, c.personalities.find(p => p.id === "anxious")!);
  const reserved = buildRealtimeInstructions(c, c.personalities.find(p => p.id === "reserved")!);
  for (const instructions of [anxious, reserved]) {
    for (const heading of ["Role & Objective", "Personality & Tone", "Pacing", "Variety", "Sample phrases", "Rules"]) assert.ok(instructions.includes(`# ${heading}`));
    assert.ok(instructions.includes("No performed breathing noises"));
    assert.ok(instructions.includes("never stacked disfluencies"));
    assert.ok(instructions.includes("override physical performance cues"));
    for (const fact of c.facts) {
      assert.ok(instructions.includes(JSON.stringify(fact)));
      assert.ok(instructions.includes(fact.reveal_when));
    }
  }
  assert.ok(anxious.includes("Concern: express worry in words"));
  assert.ok(anxious.includes("Slightly faster than ordinary conversation"));
  assert.ok(reserved.includes("Reserve: polite, contained answers"));
  assert.ok(!reserved.includes("Concern: express worry in words"));
  assert.ok(buildPatientInstructions(c, c.personalities[0]!).includes("TEXT: Return JSON"));
});

test("session sends each configured VAD preset, defaulting safely to semantic high", async t => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previous = process.env.OPENAI_TURN_DETECTION;
  process.env.OPENAI_API_KEY = "placeholder";
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previous === undefined) delete process.env.OPENAI_TURN_DETECTION; else process.env.OPENAI_TURN_DETECTION = previous;
  });
  const c = await loadCase("chest-tightness-01");
  let detected: unknown;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    detected = JSON.parse(String(init?.body)).session.audio.input.turn_detection;
    return Response.json({ value: "ephemeral-placeholder", expires_at: 1234567 });
  });
  for (const preset of ["semantic_high", "semantic_medium", "server_400", "invalid", ""]) {
    process.env.OPENAI_TURN_DETECTION = preset;
    const response = await session(new Request("http://localhost/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: c.id, personalityId: c.personalities[0]!.id }) }));
    assert.equal(response.status, 200);
    const common = { create_response: true, interrupt_response: true };
    assert.deepEqual(detected, preset === "server_400" ? { type: "server_vad", threshold: 0.5, prefix_padding_ms: 200, silence_duration_ms: 400, ...common }
      : { type: "semantic_vad", eagerness: preset === "semantic_medium" ? "medium" : "high", ...common });
  }
});
