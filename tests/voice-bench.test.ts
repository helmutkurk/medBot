// Author: Codex, 2026-11-28.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { listCases, loadCase } from "../lib/case/load.ts";
import { buildPatientInstructions, buildRealtimeInstructions } from "../lib/case/prompt.ts";
import { auditionPage, buildSession, parseArguments, pcmToWav, questionSuite, runBenchmark, runConversation, summarize } from "../scripts/voice-bench.ts";
import type { BenchConfig } from "../scripts/voice-bench.ts";

const c = await loadCase("abdominal-pain-01");
const p = c.personalities.find(p => p.id === "anxious")!;
const config: BenchConfig = { caseId: c.id, personalityId: p.id, models: ["gpt-realtime"], prompt: "compact", questions: 1, out: "unused" };
const usage = {
  total_tokens: 120, input_tokens: 100, output_tokens: 20,
  input_token_details: { text_tokens: 100, audio_tokens: 0, cached_tokens: 40, cached_tokens_details: { text_tokens: 40, audio_tokens: 0 } },
  output_token_details: { text_tokens: 4, audio_tokens: 16 },
};
type EventData = Record<string, unknown>;
class StubWebSocket extends EventTarget {
  sent: EventData[] = [];
  closed = false;
  onSend: (event: EventData) => void;
  constructor(onSend: (event: EventData) => void, connect = true) {
    super(); this.onSend = onSend;
    if (connect) queueMicrotask(() => this.emit({ type: "session.created", session: { id: "sess_test", type: "realtime" } }));
  }
  emit(event: EventData) { if (!this.closed) this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(event) })); }
  send(data: string) { const event: EventData = JSON.parse(data); this.sent.push(event); queueMicrotask(() => this.onSend(event)); }
  close() { this.closed = true; this.dispatchEvent(new Event("close")); }
}
async function setup(t: TestContext, failGuards = false) {
  const directory = await mkdtemp(path.join(tmpdir(), "medbot-voice-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const body: Record<string, unknown> = JSON.parse(String(init.body));
    requests.push({ url, body });
    if (url.endsWith("/client_secrets")) {
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer placeholder-key");
      return Response.json({ value: "ek_placeholder", expires_at: 9999999999, session: body.session });
    }
    assert.equal(url, "https://api.openai.com/v1/responses");
    if (failGuards) return Response.json({ error: { message: "DO_NOT_PERSIST_PROVIDER_BODY" } }, { status: 400 });
    return Response.json({ id: "resp_guard", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ ok: true, mode: "openai", issues: [] }) }] }], usage: { input_tokens: 12, output_tokens: 8 } });
  });
  return { directory, requests };
}
function audioResponse(socket: StubWebSocket, id: string, setTime: (n: number) => void, offset = 0, tool?: EventData) {
  setTime(offset + 50); socket.emit({ type: "response.created", response: { id, status: "in_progress", output: [] } });
  setTime(offset + 100); socket.emit({ type: "response.output_audio_transcript.delta", response_id: id, item_id: `${id}_msg`, content_index: 0, delta: "It hurts " });
  setTime(offset + 250); socket.emit({ type: "response.output_audio.delta", response_id: id, delta: Buffer.from([1, 0]).toString("base64") });
  setTime(offset + 300); socket.emit({ type: "response.output_audio.delta", response_id: id, delta: Buffer.from([2, 0]).toString("base64") });
  if (tool) socket.emit({ type: "response.function_call_arguments.done", response_id: id, ...tool });
  socket.emit({ type: "response.output_audio_transcript.done", response_id: id, item_id: `${id}_msg`, content_index: 0, transcript: "It hurts low down on the right side of my tummy." });
  setTime(offset + 800);
  const done = { type: "response.done", response: { id, status: "completed", usage, output: [
    { id: `${id}_msg`, type: "message", role: "assistant", content: [{ type: "audio", transcript: "It hurts low down on the right side of my tummy." }] }, ...(tool ? [tool] : []),
  ] } };
  socket.emit(done); socket.emit(done); // Duplicate terminal events must not retrace or replay.
}

test("CLI validates the matrix and preserves defaults", () => {
  assert.deepEqual(parseArguments([]), { ...config, caseId: "all", personalityId: "all", questions: 6, out: "eval/voice" });
  assert.deepEqual(parseArguments(["--models", "gpt-realtime,gpt-realtime-mini", "--voices", "marin,shimmer,coral,sage", "--prompt", "v1", "--questions", "8"]).voices, ["marin", "shimmer", "coral", "sage"]);
  for (const args of [["--questions", "9"], ["--voices", ""], ["--prompt", "v2"], ["--models", "unknown"], ["--case"]]) assert.throws(() => parseArguments(args));
});

// Explicitly selected cases need an authored false premise; --case all skips unsupported cases.
const probedCases = ["chest-tightness-01", "abdominal-pain-01", "multimorbid-dizziness", "thunderclap-headache"];
test("eight fixed probes retain real fact triggers for every probed case", async () => {
  for (const summary of await listCases()) {
    if (!probedCases.includes(summary.id)) { const other = await loadCase(summary.id); assert.throws(() => questionSuite(other), /No supported fixed probes/); continue; }
    const current = await loadCase(summary.id);
    const suite = questionSuite(current);
    assert.deepEqual(suite.map(s => s.kind), ["opening", "onset", "character", "red_flag", "medications", "false_premise", "absent_info", "repetition"]);
    assert.equal(suite[1].text, suite[7].text);
    assert.ok(suite[3].factIds.some(id => current.facts.find(f => f.id === id)?.red_flag));
    assert.ok(suite[5].factIds.length);
    for (const probe of suite) assert.deepEqual(probe.revealWhen, probe.factIds.map(id => current.facts.find(f => f.id === id)!.reveal_when));
  }
});

test("--case all skips unsupported probes once per case and benchmarks supported cases", async t => {
  const { directory, requests } = await setup(t);
  const notices: string[] = [];
  t.mock.method(process.stderr, "write", (message: string) => { notices.push(message); return true; });
  const unsupported = { ...c, id: "unprobed-synthetic-case" };
  const missingFact = { ...c, facts: c.facts.filter(f => f.id !== "no_pain_urinating") };
  let socket: StubWebSocket;
  const output = await runBenchmark({ ...config, caseId: "all", out: directory }, [unsupported, c, missingFact], "placeholder-key", {
    socketFactory: () => {
      socket = new StubWebSocket(event => { if (event.type === "response.create") audioResponse(socket, "resp_supported", () => {}); });
      return socket;
    },
  });
  const result = JSON.parse(await readFile(path.join(output, "results.json"), "utf8"));
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].caseId, c.id);
  assert.equal(requests.filter(request => request.url.endsWith("/client_secrets")).length, 1);
  assert.equal(notices.filter(line => /Skipping voice benchmark case/.test(line)).length, 2);
  assert.ok(notices.some(line => line.includes(unsupported.id) && line.includes("no authored false-premise probe")));
});

test("explicit unsupported cases and an all-unsupported matrix fail before API requests", async t => {
  const { directory, requests } = await setup(t);
  const unsupported = { ...c, id: "unprobed-synthetic-case" };
  await assert.rejects(runBenchmark({ ...config, caseId: unsupported.id, out: directory }, [unsupported], "placeholder-key"), /No supported fixed probes/);
  await assert.rejects(runBenchmark({ ...config, caseId: "all", out: directory }, [unsupported], "placeholder-key"), /No case\/personality matched/);
  assert.equal(requests.length, 0);
});

test("session keeps app settings with manual turns and explicit PCM24 output", () => {
  const session = buildSession(c, p, "gpt-realtime-mini", "sage", "compact");
  assert.equal(session.instructions, buildRealtimeInstructions(c, p));
  assert.equal(session.audio.input.turn_detection, null);
  assert.deepEqual(session.audio.output, { voice: "sage", speed: 1.03, format: { type: "audio/pcm", rate: 24000 } });
  assert.deepEqual(session.output_modalities, ["audio"]);
  assert.equal(session.tools[0].name, "reveal_fact");
  assert.equal(buildSession(c, p, "gpt-realtime", "marin", "v1").instructions, buildPatientInstructions(c, p));
});

test("WAV header describes mono little-endian PCM16 at 24 kHz", () => {
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128]);
  const wav = pcmToWav(pcm);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.toString("ascii", 8, 16), "WAVEfmt ");
  assert.equal(wav.readUInt32LE(16), 16);
  assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000); assert.equal(wav.readUInt32LE(28), 48000);
  assert.equal(wav.readUInt16LE(32), 2); assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString("ascii", 36, 40), "data");
  assert.equal(wav.readUInt32LE(40), pcm.length); assert.deepEqual(wav.subarray(44), pcm);
  assert.throws(() => pcmToWav(Buffer.alloc(1)), /unaligned_pcm16/);
});

test("latency starts at the text request; audio precedes tool ack without another response", async t => {
  const { directory, requests } = await setup(t);
  let clock = 0;
  let socket: StubWebSocket;
  const tool = { type: "function_call", call_id: "call_1", name: "reveal_fact", arguments: JSON.stringify({ fact_id: "abdominal_site" }) };
  const run = await runConversation(c, p, "gpt-realtime", "marin", config, "placeholder-key", directory, {
    now: () => clock,
    socketFactory: (url, protocols) => {
      assert.equal(url, "wss://api.openai.com/v1/realtime?model=gpt-realtime");
      assert.deepEqual(protocols, ["realtime", "openai-insecure-api-key.ek_placeholder"]);
      socket = new StubWebSocket(event => { if (event.type === "response.create") audioResponse(socket, "resp_1", n => { clock = n; }, 0, tool); });
      return socket;
    },
  });
  assert.equal(run.turns[0].firstAudioMs, 250);
  assert.equal(run.turns[0].doneMs, 800);
  assert.equal(run.turns[0].patientMessages.length, 1);
  assert.deepEqual(run.turns[0].revealed, ["abdominal_site"]);
  assert.equal(socket!.sent.filter(e => e.type === "response.create").length, 1);
  const acks = socket!.sent.filter(e => isToolOutput(e));
  assert.equal(acks.length, 1); assert.equal(JSON.parse(String(acks[0].item.output)).ok, true);
  assert.deepEqual((await readFile(path.join(directory, run.turns[0].audioFile!))).subarray(44), Buffer.from([1, 0, 2, 0]));
  assert.equal(requests.length, 2);
  assert.equal(run.traces.filter(t => t.kind === "response").length, 1);
  assert.equal(run.traces.filter(t => t.operation === "guard").length, 1);
  assert.ok(run.traces.every(t => t.source === "eval"));
  assert.equal(run.traces.find(t => t.kind === "response")?.audioOutputTokens, 16);
  assert.equal(run.traces.find(t => t.kind === "response")?.latencyMs, 800);
  assert.equal(summarize(run).firstAudioP95Ms, 250);
  assert.ok(summarize(run).costUsd > 0);
  const saved = JSON.stringify(run);
  assert.ok(!saved.includes("placeholder-key") && !saved.includes("ek_placeholder"));
});
function isToolOutput(event: EventData): event is EventData & { item: { output: string } } {
  return event.type === "conversation.item.create" && typeof event.item === "object" && event.item !== null && "type" in event.item && event.item.type === "function_call_output";
}

test("tool-only response gets one follow-up after deduplicated acknowledgements", async t => {
  const { directory } = await setup(t);
  let clock = 0;
  let count = 0;
  let socket: StubWebSocket;
  const run = await runConversation(c, p, "gpt-realtime", "marin", config, "placeholder-key", directory, {
    now: () => clock,
    socketFactory: () => {
      socket = new StubWebSocket(event => {
        if (event.type !== "response.create") return;
        if (++count === 2) { audioResponse(socket, "resp_audio", n => { clock = n; }, 100); return; }
        socket.emit({ type: "response.created", response: { id: "resp_tool", status: "in_progress", output: [] } });
        const tool = { type: "function_call", name: "reveal_fact", call_id: "call_bad", arguments: '{"fact_id":"invented_id"}' };
        clock = 100;
        // Only final output carries the tool: fallback acknowledgement is required.
        socket.emit({ type: "response.done", response: { id: "resp_tool", status: "completed", output: [tool], usage } });
      });
      return socket;
    },
  });
  assert.equal(count, 2);
  assert.equal(run.turns[0].firstAudioMs, 350); assert.equal(run.turns[0].doneMs, 900);
  assert.equal(run.traces.filter(t => t.kind === "response").length, 2);
  const sent = socket!.sent;
  const ack = sent.findIndex(isToolOutput);
  assert.equal(JSON.parse(String(sent[ack].item && (sent[ack].item as { output: string }).output)).ok, false);
  assert.equal(sent[ack + 1].type, "response.create");
  assert.deepEqual(run.turns[0].revealed, []);
  assert.deepEqual(run.failures, []);
});

test("conversation timeout preserves partial audio and guards the partial transcript", async t => {
  const { directory } = await setup(t);
  let socket: StubWebSocket;
  const run = await runConversation(c, p, "gpt-realtime", "marin", config, "placeholder-key", directory, {
    timeoutMs: 30,
    socketFactory: () => {
      socket = new StubWebSocket(event => {
        if (event.type !== "response.create") return;
        socket.emit({ type: "response.created", response: { id: "resp_partial", status: "in_progress", output: [] } });
        socket.emit({ type: "response.output_audio.delta", response_id: "resp_partial", delta: "AAA=" });
        socket.emit({ type: "response.output_audio_transcript.delta", response_id: "resp_partial", item_id: "msg", content_index: 0, delta: "It hurts." });
      });
      return socket;
    },
  });
  assert.deepEqual(run.failures, ["conversation_timeout"]);
  assert.equal(run.turns[0].status, "error"); assert.equal(run.turns[0].transcript, "It hurts.");
  assert.equal(run.turns[0].guards.length, 1); assert.ok(run.turns[0].audioFile);
  assert.equal(summarize(run).firstAudioP50Ms, null);
  assert.ok(run.traces.some(t => t.status === "error" && t.usageMissing)); assert.equal(socket!.closed, true);
});

test("all attempted cells survive a credential failure and produce blind audition artifacts", async t => {
  const { directory } = await setup(t);
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/client_secrets")) {
      if (++requests === 1) return new Response("DO_NOT_PERSIST_PROVIDER_BODY", { status: 403 });
      return Response.json({ value: "ek_placeholder", expires_at: 9999999999 });
    }
    const body = JSON.parse(String(init.body));
    assert.equal(body.text.format.name, "guard_result");
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"ok":true,"issues":[],"mode":"openai"}' }] }], usage: { input_tokens: 10, output_tokens: 5 } });
  });
  let clock = 0;
  let socket: StubWebSocket;
  const output = await runBenchmark({ ...config, voices: ["marin", "shimmer", "coral"], out: directory }, [c], "placeholder-key", {
    now: () => clock,
    socketFactory: () => {
      socket = new StubWebSocket(event => { if (event.type === "response.create") audioResponse(socket, `resp_${requests}`, n => { clock = n; }, clock); });
      return socket;
    },
  });
  const result = JSON.parse(await readFile(path.join(output, "results.json"), "utf8"));
  assert.equal(result.runs.length, 3); assert.deepEqual(result.runs[0].failures, ["session_http_403"]);
  assert.equal(result.summaries[1].completedTurns, 1);
  assert.equal(result.runs[2].turns[0].guards.length, 1);
  assert.ok(!JSON.stringify(result).includes("DO_NOT_PERSIST_PROVIDER_BODY"));
  const report = await readFile(path.join(output, "report.md"), "utf8");
  assert.match(report, /session_http_403/); assert.match(report, /not microphone\/VAD/);
  const page = auditionPage(result.runs, () => 0);
  assert.match(page, /<h3>A<\/h3>/); assert.match(page, /<h3>B<\/h3>/);
  assert.match(page, /hidden data-key=/); assert.match(page, /Reveal key/);
  assert.ok(!page.includes("shimmer") && !page.includes("coral"));
  assert.ok(!page.includes("http://") && !page.includes("https://"));
  assert.match(await readFile(path.join(output, "index.html"), "utf8"), /<audio controls/);
});

test("guard errors remain missing observations, without provider body leakage", async t => {
  const { directory } = await setup(t, true);
  let socket: StubWebSocket;
  const run = await runConversation(c, p, "gpt-realtime-mini", "marin", config, "placeholder-key", directory, {
    socketFactory: () => {
      socket = new StubWebSocket(event => { if (event.type === "response.create") audioResponse(socket, "resp_guard_failure", () => {}); });
      return socket;
    },
  });
  assert.deepEqual(run.turns[0].guardFailures, ["guard_http"]);
  assert.equal(summarize(run).unguardedMessages, 1);
  assert.equal(summarize(run).unknownModel, true);
  assert.ok(!JSON.stringify(run).includes("DO_NOT_PERSIST_PROVIDER_BODY"));
});

test("eight-turn conversations keep matched questions, fresh timings and preceding guard history", async t => {
  const { directory, requests } = await setup(t);
  let clock = 0;
  let count = 0;
  let socket: StubWebSocket;
  const run = await runConversation(c, p, "gpt-realtime", "marin", { ...config, questions: 8 }, "placeholder-key", directory, {
    now: () => clock,
    socketFactory: () => {
      socket = new StubWebSocket(event => {
        if (event.type === "response.create") audioResponse(socket, `resp_turn_${++count}`, n => { clock = n; }, clock);
      });
      return socket;
    },
  });
  assert.equal(run.turns.length, 8);
  assert.ok(run.turns.every(t => t.firstAudioMs === 250 && t.doneMs === 800 && t.guards.length === 1));
  assert.equal(new Set(run.turns.map(t => t.audioFile)).size, 8);
  assert.equal(summarize(run).guardedMessages, 8);
  const guards = requests.filter(r => r.url.endsWith("/responses"));
  guards.forEach((request, i) => {
    const body = request.body;
    assert.ok(Array.isArray(body.input));
    const payload = JSON.parse(body.input[0].content);
    assert.equal(payload.history.length, i * 2 + 1);
    assert.equal(payload.history.at(-1).role, "student");
    assert.equal(payload.history.at(-1).text, run.turns[i].question.text);
  });
});

test("audio without a transcript is explicitly missing guard evidence", async t => {
  const { directory } = await setup(t);
  let socket: StubWebSocket;
  const run = await runConversation(c, p, "gpt-realtime", "marin", config, "placeholder-key", directory, {
    socketFactory: () => {
      socket = new StubWebSocket(event => {
        if (event.type !== "response.create") return;
        socket.emit({ type: "response.created", response: { id: "resp_no_transcript", status: "in_progress", output: [] } });
        socket.emit({ type: "response.output_audio.delta", response_id: "resp_no_transcript", delta: "AAA=" });
        socket.emit({ type: "response.done", response: { id: "resp_no_transcript", status: "completed", output: [{ id: "msg", type: "message", content: [{ type: "audio" }] }], usage } });
      });
      return socket;
    },
  });
  assert.deepEqual(run.turns[0].guardFailures, ["missing_transcript"]);
  assert.equal(summarize(run).guardedMessages, 0);
  assert.equal(summarize(run).missingTranscriptTurns, 1);
});
