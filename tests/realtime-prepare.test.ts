import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import { RealtimePreparation } from "../components/realtime/prepare.ts";
import { TurnEnergy } from "../components/realtime/energy.ts";

function setup(t: TestContext) {
  let now = 1_000_000;
  let credentials = 0;
  let microphones = 0;
  let peers = 0;
  let stops = 0;
  let closes = 0;
  const track = { enabled: true, stop() { stops++; } };
  let permission: Promise<{ getTracks: () => typeof track[] }> | undefined;
  const globals = {
    navigator: { mediaDevices: { getUserMedia: () => { microphones++; return permission ?? Promise.resolve({ getTracks: () => [track] }); } } },
    window: { RTCPeerConnection: true },
    RTCPeerConnection: class {
      constructor() { peers++; }
      addTrack() {}
      createDataChannel() { return { close() {} }; }
      async createOffer() { return { type: "offer", sdp: "offline-offer" }; }
      async setLocalDescription() {}
      close() { closes++; }
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    assert.equal(url, "/api/session"); // Pre-warm never opens a provider call.
    assert.deepEqual(JSON.parse(String(init?.body)), { caseId: "case-1", personalityId: "quiet" });
    credentials++;
    return Response.json({ clientSecret: `ephemeral-${credentials}`, expiresAt: now / 1000 + 600 });
  });
  const prepared = new RealtimePreparation("case-1", "quiet");
  t.after(() => prepared.close());
  return { prepared, track, counts: () => ({ credentials, microphones, peers, stops, closes }), advance: (ms: number) => { now += ms; }, defer: (p: NonNullable<typeof permission>) => { permission = p; } };
}

test("selection prefetch is deduplicated and never requests microphone permission", async t => {
  const h = setup(t);
  await Promise.all([h.prepared.prefetch(), h.prepared.prefetch()]);
  assert.deepEqual(h.counts(), { credentials: 1, microphones: 0, peers: 0, stops: 0, closes: 0 });
  await Promise.all([h.prepared.prepare(), h.prepared.prepare()]);
  assert.equal(h.track.enabled, false);
  const taken = await h.prepared.take();
  assert.equal(taken.clientSecret, "ephemeral-1");
  assert.equal(taken.offer.sdp, "offline-offer");
  assert.equal(h.counts().microphones, 1);
  h.prepared.close(); // Ownership transferred; closing prefetch cannot kill the call.
  assert.equal(h.counts().stops, 0);
  taken.stream.getTracks().forEach(track => track.stop()); taken.peer.close();
});

test("Start refreshes a near-expiry credential and releases idle local media", async t => {
  const h = setup(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await h.prepared.prefetch();
  await h.prepared.prepare();
  t.mock.timers.tick(60_000);
  assert.equal(h.counts().stops, 1);
  h.advance(575_000);
  const taken = await h.prepared.take();
  assert.equal(taken.clientSecret, "ephemeral-2");
  assert.equal(h.counts().microphones, 2);
  taken.stream.getTracks().forEach(track => track.stop()); taken.peer.close();
});

test("selection cancellation stops a microphone arriving after permission resolves", async t => {
  const h = setup(t);
  let allow!: (value: { getTracks: () => typeof h.track[] }) => void;
  h.defer(new Promise(resolve => { allow = resolve; }));
  const preparing = h.prepared.prepare();
  h.prepared.close();
  allow({ getTracks: () => [h.track] });
  await assert.rejects(preparing, { name: "AbortError" });
  assert.equal(h.counts().stops, 1);
  await assert.rejects(h.prepared.prefetch(), { name: "AbortError" });
  assert.equal(h.counts().credentials, 0);
});

test("permission denial can retry on the next gesture without leaking a peer", async t => {
  const h = setup(t);
  h.defer(Promise.reject(new DOMException("denied", "NotAllowedError")));
  await assert.rejects(h.prepared.prepare(), { name: "NotAllowedError" });
  assert.equal(h.counts().closes, 1);
  h.defer(Promise.resolve({ getTracks: () => [h.track] }));
  await h.prepared.prepare();
  assert.equal(h.counts().microphones, 2);
});

test("energy detection rejects noise clicks and uses the last voiced mic frame after hangover", () => {
  const energy = new TurnEnergy();
  assert.deepEqual(energy.sample(0, 0, 0), { silenceAt: null, audibleAt: null });
  energy.sample(100, 0.03, 0);
  assert.equal(energy.sample(200, 0, 0).silenceAt, null);
  assert.equal(energy.sample(220, 0, 0).silenceAt, 100);
  energy.sample(300, 0, 0.03); // A single click is not a patient onset.
  assert.equal(energy.sample(310, 0, 0).audibleAt, null);
  energy.sample(400, 0, 0.03);
  assert.equal(energy.sample(430, 0, 0.03).audibleAt, 400);
  assert.equal(energy.sample(450, 0, 0.03).audibleAt, null);
  assert.equal(energy.sample(500, 0.03, 0).silenceAt, null);
});
