import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { RealtimeInterview } from "../components/realtime/client.ts";

// Exercise the actual data-channel handler with minimal WebRTC surfaces; no browser or network.
test("Realtime events report metadata once, preserve audio/cache counts and survive interview close", async t => {
  const channel = {
    readyState: "open", onopen: () => {}, onmessage: (_event: { data: string }) => {},
    send: (_data: string) => {}, close: () => {},
  };
  class Peer {
    createDataChannel() { return channel; }
    async createOffer() { return { sdp: "test offer" }; }
    async setLocalDescription() {}
    async setRemoteDescription() { channel.onopen(); }
    close() {}
  }
  const globals: Record<string, unknown> = {
    Audio: class { autoplay = false; pause() {} },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
    window: { RTCPeerConnection: Peer, setTimeout }, RTCPeerConnection: Peer, cancelAnimationFrame: () => {},
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
  const reports: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let rejectTrace = false;
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    if (url === "/api/session") return Response.json({ clientSecret: "PRIVATE KEY", expiresAt: Date.now() / 1000 + 600 });
    if (url === "https://api.openai.com/v1/realtime/calls") return new Response("test answer");
    assert.equal(url, "/api/trace"); assert.equal(init?.keepalive, true); assert.equal(init?.signal, undefined);
    const text = String(init?.body);
    assert.ok(!text.includes("PRIVATE"));
    reports.push(JSON.parse(text));
    if (rejectTrace) throw new Error("network");
    return Response.json({ ok: true });
  });
  const client = new RealtimeInterview({ onStatus: () => {}, onMessage: () => {}, onFact: () => {}, onLatency: () => {}, onLevel: () => {}, onError: message => { errors.push(message); }, onDisconnect: () => {} }, []);
  await client.start("case-1", "quiet");
  assert.equal(errors.length, 0);
  const emit = (value: unknown) => channel.onmessage({ data: JSON.stringify(value) });
  const done = { type: "response.done", response: { id: "response-1", status: "completed", output: "PRIVATE RESPONSE", usage: { input_tokens: 1000, output_tokens: 200, input_token_details: { text_tokens: 400, audio_tokens: 600, cached_tokens: 200, cached_tokens_details: { text_tokens: 100, audio_tokens: 100 } }, output_token_details: { text_tokens: 50, audio_tokens: 150 } } } };
  emit({ type: "response.created", response: { id: "response-1" } });
  emit(done); emit(done);
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.caseId, "case-1"); assert.equal(reports[0]?.personalityId, "quiet");
  assert.equal(reports[0]?.inputTokens, 1000); assert.equal(reports[0]?.outputTokens, 200);
  assert.equal(reports[0]?.audioInputTokens, 600); assert.equal(reports[0]?.audioOutputTokens, 150);
  assert.equal(reports[0]?.cachedTokens, 200); assert.equal(reports[0]?.cachedAudioTokens, 100);
  assert.equal(reports[0]?.status, "ok");
  emit({ type: "input_audio_buffer.committed", item_id: "item-1" });
  emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "item-1", transcript: "PRIVATE TRANSCRIPT", usage: { type: "tokens", input_tokens: 13, output_tokens: 9, input_token_details: { audio_tokens: 13, text_tokens: 0 } } });
  assert.equal(reports[1]?.kind, "transcription"); assert.equal(reports[1]?.audioInputTokens, 13);
  rejectTrace = true;
  emit({ type: "response.done", response: { id: "failed-1", status: "failed", status_details: { error: { message: "PRIVATE ERROR" } } } });
  emit({ type: "response.done", response: { id: "failed-2", status: "cancelled" } });
  client.close();
  await setImmediate();
  assert.equal(reports[2]?.status, "error"); assert.equal(reports[2]?.usageMissing, true);
  assert.equal(errors.filter(message => message.includes("usage could not be saved")).length, 1);
});
