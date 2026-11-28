import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import { RealtimeInterview } from "../components/realtime/client.ts";
import { needsAudioFollowUp } from "../components/realtime/response.ts";
import type { ResponseProgress } from "../components/realtime/response.ts";

const progress = (overrides: Partial<ResponseProgress> = {}): ResponseProgress => ({ turn: 1, hasAudio: false, hasTool: true, interrupted: false, done: false, ...overrides });
test("only a completed, current tool-only response needs another response", () => {
  const response = { status: "completed", output: [{ type: "function_call" }] };
  assert.equal(needsAudioFollowUp(response, progress(), 1), true);
  for (const state of [progress({ hasAudio: true }), progress({ interrupted: true }), progress({ done: true }), progress({ turn: 0 })]) {
    assert.equal(needsAudioFollowUp(response, state, 1), false);
  }
  for (const status of ["cancelled", "failed", "incomplete", "in_progress"]) {
    assert.equal(needsAudioFollowUp({ ...response, status }, progress(), 1), false);
  }
  assert.equal(needsAudioFollowUp({ status: "completed", output: [] }, progress({ hasTool: false }), 1), false);
  for (const type of ["audio", "output_audio"]) {
    assert.equal(needsAudioFollowUp({ ...response, output: [...response.output, { type: "message", content: [{ type, transcript: "An answer" }] }] }, progress(), 1), false);
  }
});

async function harness(t: TestContext) {
  let client: RealtimeInterview | undefined;
  t.after(() => client?.close());
  const sent: { type: string; item?: { type: string; call_id?: string; output?: string } }[] = [];
  const reports: Record<string, unknown>[] = [];
  const facts: string[] = [];
  const latencies: number[] = [];
  const errors: string[] = [];
  const statuses: string[] = [];
  const channel = { readyState: "open", onopen: () => {}, onmessage: (_event: { data: string }) => {}, send: (data: string) => { sent.push(JSON.parse(data)); }, close() {} };
  class Peer {
    createDataChannel() { return channel; }
    async createOffer() { return { sdp: "offline-offer" }; }
    async setLocalDescription() {}
    async setRemoteDescription() { channel.onopen(); }
    close() {}
  }
  const globals = {
    Audio: class { autoplay = false; pause() {} },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
    window: { RTCPeerConnection: Peer, setTimeout }, RTCPeerConnection: Peer, cancelAnimationFrame() {},
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
  let now = 0;
  t.mock.method(performance, "now", () => now);
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    if (url === "/api/session") return Response.json({ clientSecret: "offline-key" });
    if (url === "https://api.openai.com/v1/realtime/calls") return new Response("offline-answer");
    assert.equal(url, "/api/trace");
    assert.equal(init?.keepalive, true);
    reports.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true });
  });
  client = new RealtimeInterview({ onStatus: s => { statuses.push(s); }, onMessage() {}, onFact: id => { facts.push(id); }, onLatency: ms => { latencies.push(ms); }, onLevel() {}, onError: error => { errors.push(error); }, onDisconnect() {} }, ["fact_a", "fact_b"]);
  await client.start("case-1", "quiet");
  const emit = (event: unknown, time = now) => { now = time; channel.onmessage({ data: JSON.stringify(event) }); };
  const created = (id: string) => emit({ type: "response.created", response: { id } });
  const tool = (response_id: string, call_id = "call-a", fact_id = "fact_a") => emit({ type: "response.function_call_arguments.done", response_id, call_id, name: "reveal_fact", arguments: JSON.stringify({ fact_id }) });
  const done = (id: string, status = "completed", output: unknown[] = []) => emit({ type: "response.done", response: { id, status, output, usage: { input_tokens: 10, output_tokens: 5 } } });
  return { client, emit, created, tool, done, sent, reports, facts, latencies, errors, statuses };
}

for (const audioType of ["response.output_audio.delta", "response.audio.delta", "response.output_audio_transcript.delta", "response.audio_transcript.delta", "output_audio_buffer.started"]) {
  for (const toolFirst of [false, true]) test(`${audioType}, tool ${toolFirst ? "before" : "after"} audio: acknowledge without duplicate speech`, async t => {
    const h = await harness(t);
    h.emit({ type: "input_audio_buffer.speech_stopped" }); h.created("r1");
    if (toolFirst) h.tool("r1");
    h.emit({ type: audioType, response_id: "r1", delta: "PRIVATE" }, 100);
    if (!toolFirst) h.tool("r1");
    h.tool("r1"); h.tool("r1", "call-b", "fact_b");
    h.done("r1"); h.done("r1");
    assert.deepEqual(h.facts, ["fact_a", "fact_b"]);
    assert.equal(h.sent.filter(e => e.item?.type === "function_call_output").length, 2);
    assert.equal(h.sent.filter(e => e.type === "response.create").length, 0);
    assert.deepEqual(h.errors, []);
  });
}

test("tool-only responses continue once; full response output recovers missed tool/audio events", async t => {
  const h = await harness(t);
  h.emit({ type: "input_audio_buffer.speech_stopped" }, 10); h.created("r1");
  const call = { type: "function_call", call_id: "call-a", name: "reveal_fact", arguments: '{"fact_id":"fact_a"}' };
  h.done("r1", "completed", [call]); h.done("r1", "completed", [call]);
  assert.equal(h.sent.filter(e => e.type === "response.create").length, 1);
  assert.deepEqual(h.facts, ["fact_a"]);
  h.created("r2");
  h.emit({ type: "response.output_audio_transcript.delta", response_id: "r2", delta: "PRIVATE" }, 160);
  h.emit({ type: "output_audio_buffer.started", response_id: "r2" }, 210);
  h.done("r2", "completed", [{ ...call, call_id: "call-b" }, { type: "message", content: [{ type: "audio", transcript: "PRIVATE" }] }]);
  h.emit({ type: "output_audio_buffer.stopped", response_id: "r2" }, 500);
  assert.equal(h.sent.filter(e => e.type === "response.create").length, 1);
  assert.deepEqual(h.latencies, [200]);
  const timing = h.reports.find(r => r.kind === "turn");
  assert.equal(timing?.speechToFirstAudioBufferMs, 200);
  assert.equal(timing?.speechToFirstTranscriptDeltaMs, 150);
  assert.equal(timing?.speechToFirstAudioDeltaMs, undefined);
  assert.ok(!JSON.stringify(h.reports).includes("PRIVATE"));
});

test("audio content in done prevents a follow-up even before WebRTC buffer-start", async t => {
  const h = await harness(t);
  h.created("r1"); h.tool("r1");
  h.done("r1", "completed", [{ type: "message", content: [{ type: "audio", transcript: "answer" }] }]);
  assert.equal(h.sent.filter(e => e.type === "response.create").length, 0);
});

test("cancellation/failure and a late old response cannot restart an interrupted turn", async t => {
  const h = await harness(t);
  for (const status of ["cancelled", "failed", "incomplete"]) {
    h.created(status); h.tool(status, status); h.done(status, status);
  }
  h.emit({ type: "input_audio_buffer.speech_stopped" }, 100); h.created("old"); h.tool("old", "old-call");
  h.emit({ type: "input_audio_buffer.speech_started" }, 200);
  h.emit({ type: "input_audio_buffer.speech_stopped" }, 300); h.created("new");
  h.done("old");
  h.emit({ type: "response.output_audio.delta", response_id: "old", delta: "old" }, 350);
  assert.deepEqual(h.latencies, []);
  h.emit({ type: "response.output_audio.delta", response_id: "new", delta: "new" }, 400);
  h.emit({ type: "output_audio_buffer.stopped", response_id: "old" }, 410);
  assert.equal(h.statuses.at(-1), "Patient speaking");
  h.emit({ type: "response.output_audio_transcript.delta", response_id: "new", delta: "new" }, 450);
  h.client.close();
  assert.equal(h.sent.filter(e => e.type === "response.create").length, 0);
  assert.deepEqual(h.latencies, [100]);
  const turns = h.reports.filter(r => r.kind === "turn");
  assert.equal(turns[0]?.interrupted, true);
  assert.equal(turns[1]?.speechToFirstAudioDeltaMs, 100);
  assert.equal(turns[1]?.speechToFirstTranscriptDeltaMs, 150);
});

test("invalid tool calls get one failure acknowledgement and a tool-only fallback", async t => {
  const h = await harness(t);
  h.created("r1"); h.tool("r1", "bad", "not-a-fact"); h.tool("r1", "bad", "not-a-fact"); h.done("r1");
  assert.deepEqual(h.facts, []);
  assert.equal(h.sent.filter(e => e.item?.output === '{"ok":false}').length, 1);
  assert.equal(h.sent.filter(e => e.type === "response.create").length, 1);
});
