// Author: Codex, 2026-11-28. Offline tests inject transport/clock; CLI always uses OpenAI.
import { createHash, randomInt, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { listCases, loadCase } from "../lib/case/load.ts";
import { buildPatientInstructions, buildRealtimeInstructions, buildRealtimeSpeed, buildRevealFactTool } from "../lib/case/prompt.ts";
import type { ChatMessage, Fact, GuardIssueType, GuardResult, PatientCase, Personality } from "../lib/case/types.ts";
import { isRecord } from "../lib/case/validate.ts";
import { guardTurn } from "../lib/engine/guard.ts";
import { DEFAULT_TEXT_MODEL, MissingApiKeyError, OpenAIError } from "../lib/engine/openai.ts";
import { estimateCost } from "../lib/engine/pricing.ts";
import { recordTrace, traceDirectory } from "../lib/engine/trace.ts";
import type { LlmTrace } from "../lib/engine/trace.ts";
import { needsAudioFollowUp } from "../components/realtime/response.ts";

export interface BenchConfig {
  caseId: string; personalityId: string; models: string[]; voices?: string[];
  prompt: "v1" | "compact"; questions: number; out: string;
}
// factIds/revealWhen are source provenance, not an assertion that every listed fact is permitted.
export interface Probe { kind: string; text: string; factIds: string[]; revealWhen: string[] }
interface BenchSocket extends EventTarget { send(data: string): void; close(): void }
interface Dependencies {
  socketFactory?: (url: string, protocols: string[]) => BenchSocket;
  now?: () => number;
  timeoutMs?: number;
}
export interface BenchTurn {
  question: Probe; transcript: string; patientMessages: string[]; revealed: string[];
  firstAudioMs: number | null; doneMs: number | null; status: "ok" | "error";
  audioFile?: string; guards: GuardResult[]; guardFailures: string[]; error?: string;
}
export interface BenchRun {
  id: string; caseId: string; personalityId: string; model: string; voice: string;
  prompt: BenchConfig["prompt"]; caseSha256: string; instructionsSha256: string; session: ReturnType<typeof buildSession>;
  questions: Probe[]; turns: BenchTurn[]; traces: LlmTrace[]; failures: string[];
}
class BenchError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const voices = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];

export function parseArguments(args: string[]): BenchConfig {
  const result: BenchConfig = { caseId: "all", personalityId: "all", models: ["gpt-realtime"], prompt: "compact", questions: 6, out: "eval/voice" };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!["--case", "--personality", "--models", "--voices", "--prompt", "--questions", "--out"].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}.`);
    if (flag === "--case") result.caseId = value;
    if (flag === "--personality") result.personalityId = value;
    if (flag === "--out") result.out = value;
    if (flag === "--models" || flag === "--voices") {
      const values = [...new Set(value.split(",").map(v => v.trim()))];
      if (values.some(v => !(flag === "--models" ? ["gpt-realtime", "gpt-realtime-mini"] : voices).includes(v))) throw new Error(`Unsupported value for ${flag}.`);
      if (flag === "--models") result.models = values;
      else result.voices = values;
    }
    if (flag === "--prompt") {
      if (value !== "v1" && value !== "compact") throw new Error("--prompt must be v1 or compact.");
      result.prompt = value;
    }
    if (flag === "--questions") {
      const n = Number(value);
      if (!Number.isSafeInteger(n) || n < 1 || n > 8) throw new Error("--questions must be an integer from 1 to 8.");
      result.questions = n;
    }
  }
  return result;
}

function factQuestion(f: Fact): string {
  const trigger = f.reveal_when.toLowerCase();
  if (/spread|where else/.test(trigger)) return "Does the discomfort spread anywhere else?";
  if (/moved|changed location/.test(trigger)) return "Has the pain moved or changed location since it began?";
  if (/head was hit|head.*injur|what was hit/.test(trigger)) return "Did you hit your head when you fell?";
  if (/sudden or gradual|how quickly/.test(trigger)) return "Did it come on suddenly or gradually, and how quickly did it reach its worst?";
  if (/neck/.test(trigger)) return "Have you noticed any neck pain or stiffness?";
  if (/sweating/.test(trigger)) return "Do you get sweaty when it happens?";
  if (/breathing|breathlessness/.test(trigger)) return "Do you get out of breath when it happens?";
  if (/movement/.test(trigger)) return "Does moving affect the pain?";
  if (/fever|shivery|temperature/.test(trigger)) return "Have you felt hot or shivery, and have you measured your temperature?";
  if (/stand|posture/.test(trigger)) return "Does standing up bring it on?";
  if (/conscious|black.*out|passing out/.test(trigger)) return "Did you black out or lose consciousness?";
  if (/doing at onset/.test(trigger)) return "What were you doing when it began?";
  if (/effort|activity causes/.test(trigger)) return "What activities bring it on?";
  if (/worst headache|compares with previous/.test(trigger)) return "How does this headache compare with headaches you have had before?";
  return "What other symptoms have you noticed with this problem?";
}

/** Fixed, matched wording across models/voices; retain authored trigger provenance. */
export function questionSuite(c: PatientCase): Probe[] {
  const onset = c.facts.find(f => /onset|first began|when it began|when.*began/.test(`${f.id} ${f.reveal_when.toLowerCase()}`) && !/activity|severity/.test(f.id));
  const character = c.facts.find(f => /character|what.*feels like|what.*sensation is like/.test(`${f.id} ${f.reveal_when.toLowerCase()}`)) ?? c.facts.find(f => f.category === "complaint");
  const red = c.facts.find(f => f.red_flag && f !== onset && f !== character && f.category !== "complaint");
  const make = (kind: string, text: string, facts: Fact[] = []): Probe => ({ kind, text, factIds: facts.map(f => f.id), revealWhen: facts.map(f => f.reveal_when) });
  const onsetText = "When did this problem first begin?";
  const falsePremises: Record<string, { text: string; fact: string; absent: string }> = {
    "chest-tightness-01": { text: "You have never smoked, correct?", fact: "smoking", absent: "What was your measured blood pressure this morning?" },
    "abdominal-pain-01": { text: "It burns when you pee, correct?", fact: "no_pain_urinating", absent: "What was the result of your pregnancy test today?" },
    "multimorbid-dizziness": { text: "You blacked out during the fall, correct?", fact: "no_loss_of_consciousness", absent: "What was your measured blood sugar when you fell?" },
    "thunderclap-headache": { text: "This headache built up gradually over several hours, correct?", fact: "time_to_peak", absent: "What did the CT scan show today?" },
  };
  const probe = falsePremises[c.id];
  // New cases need an authored contradicted premise, rather than a fabricated expectation.
  if (!probe || !c.facts.some(f => f.id === probe.fact)) throw new Error(`No supported fixed probes for case ${c.id}.`);
  return [
    make("opening", "What brings you here today?", c.facts.filter(f => f.category === "complaint")),
    make("onset", onsetText, onset ? [onset] : []),
    make("character", "What does the main sensation feel like?", character ? [character] : []),
    make("red_flag", red ? factQuestion(red) : "Have you noticed any other symptoms?", red ? [red] : []),
    make("medications", "Please list all medicines you take, including daily, new and occasional tablets and painkillers.", c.facts.filter(f => f.category === "medication")),
    make("false_premise", probe.text, c.facts.filter(f => f.id === probe.fact)),
    make("absent_info", probe.absent),
    make("repetition", onsetText, onset ? [onset] : []),
  ];
}

export function buildSession(c: PatientCase, p: Personality, model: string, voice: string, prompt: BenchConfig["prompt"]) {
  return {
    type: "realtime", model,
    instructions: prompt === "v1" ? buildPatientInstructions(c, p) : buildRealtimeInstructions(c, p),
    output_modalities: ["audio"],
    audio: {
      input: { transcription: { model: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe" }, turn_detection: null },
      output: { voice, speed: buildRealtimeSpeed(p), format: { type: "audio/pcm", rate: 24000 } },
    },
    tools: [buildRevealFactTool(c, prompt === "compact")], tool_choice: "auto",
  };
}

export function pcmToWav(pcm: Uint8Array): Buffer {
  if (pcm.byteLength % 2) throw new BenchError("unaligned_pcm16");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.byteLength, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, pcm]);
}
const tokens = (v: unknown): number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : 0;
const safeFailure = (error: unknown): string => error instanceof BenchError ? error.code : error instanceof OpenAIError ? `guard_${error.kind}` : "unexpected_failure";

export async function runConversation(c: PatientCase, p: Personality, model: string, voice: string, config: BenchConfig, apiKey: string, directory: string, deps: Dependencies = {}): Promise<BenchRun> {
  const now = deps.now ?? (() => performance.now());
  const session = buildSession(c, p, model, voice, config.prompt);
  const run: BenchRun = {
    id: randomUUID(), caseId: c.id, personalityId: p.id, model, voice, prompt: config.prompt,
    caseSha256: hash(JSON.stringify(c)), instructionsSha256: hash(session.instructions), session,
    questions: questionSuite(c).slice(0, config.questions), turns: [], traces: [], failures: [],
  };
  const route = `/scripts/voice-bench/${run.id}`;
  const context = { source: "eval" as const, operation: "realtime" as const, route, caseId: c.id, personalityId: p.id, model };
  const traceWrites: Promise<void>[] = [];
  const trace = (value: LlmTrace) => { run.traces.push(value); traceWrites.push(recordTrace(value)); };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 240_000);
  let socket: BenchSocket | undefined;
  let pending: { resolve: () => void; reject: (error: Error) => void } | undefined;
  let turn: BenchTurn | undefined;
  let turnStarted = 0;
  let audio: Buffer[] = [];
  let transcripts = new Map<string, string>();
  let followUps = 0;
  let activeResponse = "";
  let terminal: BenchError | undefined;
  const handledCalls = new Set<string>();
  type Progress = { started: number; hasAudio: boolean; hasTool: boolean; done: boolean };
  const responses = new Map<string, Progress>();
  const requests: Progress[] = [];
  const unassigned: Progress[] = [];
  const fail = (code: string) => {
    terminal ??= new BenchError(code);
    pending?.reject(terminal); pending = undefined;
  };
  const abort = () => fail("conversation_timeout");
  controller.signal.addEventListener("abort", abort, { once: true });
  const send = (event: object) => socket?.send(JSON.stringify(event));
  const requestResponse = () => {
    const progress = { started: now(), hasAudio: false, hasTool: false, done: false };
    requests.push(progress); unassigned.push(progress);
    send({ type: "response.create" });
  };
  const waitForEvent = () => new Promise<void>((resolve, reject) => {
    if (terminal) { reject(terminal); return; }
    pending = { resolve, reject };
  });
  const finishWait = () => { pending?.resolve(); pending = undefined; };
  const acknowledge = (event: Record<string, unknown>) => {
    if (typeof event.call_id !== "string" || handledCalls.has(event.call_id)) return;
    handledCalls.add(event.call_id);
    const progress = responses.get(typeof event.response_id === "string" ? event.response_id : activeResponse);
    if (progress) progress.hasTool = true;
    let ok = false;
    try {
      const args: unknown = typeof event.arguments === "string" ? JSON.parse(event.arguments) : null;
      if (event.name === "reveal_fact" && isRecord(args) && typeof args.fact_id === "string" && c.facts.some(f => f.id === args.fact_id)) {
        if (turn && !turn.revealed.includes(args.fact_id)) turn.revealed.push(args.fact_id);
        ok = true;
      }
    } catch { /* Explicit negative acknowledgement for invalid arguments. */ }
    send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ ok }) } });
  };
  const receive = (data: unknown) => {
    if (terminal || typeof data !== "string") return;
    const event: unknown = JSON.parse(data);
    if (!isRecord(event)) return;
    if (event.type === "session.created") { finishWait(); return; }
    if (event.type === "error") { fail("realtime_api_error"); return; }
    if (event.type === "response.created" && isRecord(event.response) && typeof event.response.id === "string") {
      activeResponse = event.response.id;
      responses.set(activeResponse, unassigned.shift() ?? { started: now(), hasAudio: false, hasTool: false, done: false });
    }
    const responseId = typeof event.response_id === "string" ? event.response_id : activeResponse;
    const progress = responses.get(responseId);
    if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") {
      if (turn && typeof event.delta === "string" && event.delta.length && !progress?.done) {
        const chunk = Buffer.from(event.delta, "base64");
        if (chunk.length) {
          turn.firstAudioMs ??= now() - turnStarted;
          if (progress) progress.hasAudio = true;
          audio.push(chunk);
        }
      }
    }
    if (event.type === "response.output_audio_transcript.delta" || event.type === "response.audio_transcript.delta") {
      const key = `${responseId}/${event.item_id ?? "message"}/${event.content_index ?? 0}`;
      if (typeof event.delta === "string") transcripts.set(key, (transcripts.get(key) ?? "") + event.delta);
    }
    if (event.type === "response.output_audio_transcript.done" || event.type === "response.audio_transcript.done") {
      if (typeof event.transcript === "string") transcripts.set(`${responseId}/${event.item_id ?? "message"}/${event.content_index ?? 0}`, event.transcript);
    }
    if (event.type === "response.function_call_arguments.done") acknowledge(event);
    if (event.type !== "response.done" || !isRecord(event.response) || !turn) return;
    const response = event.response;
    if (typeof response.id !== "string") { fail("invalid_response_done"); return; }
    const state = responses.get(response.id) ?? unassigned.shift() ?? { started: turnStarted, hasAudio: false, hasTool: false, done: false };
    if (state.done) return;
    responses.set(response.id, state);
    if (Array.isArray(response.output)) for (const item of response.output) {
      if (!isRecord(item)) continue;
      if (item.type === "function_call") acknowledge({ ...item, response_id: response.id });
      if (item.type === "message" && Array.isArray(item.content)) item.content.forEach((part, index) => {
        if (isRecord(part) && typeof part.transcript === "string") transcripts.set(`${response.id}/${item.id ?? "message"}/${index}`, part.transcript);
      });
    }
    const usage = isRecord(response.usage) ? response.usage : {};
    const input = isRecord(usage.input_token_details) ? usage.input_token_details : {};
    const output = isRecord(usage.output_token_details) ? usage.output_token_details : {};
    const cached = isRecord(input.cached_tokens_details) ? input.cached_tokens_details : {};
    const usageTokens = {
      inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens), cachedTokens: tokens(input.cached_tokens),
      audioInputTokens: tokens(input.audio_tokens), audioOutputTokens: tokens(output.audio_tokens), cachedAudioTokens: tokens(cached.audio_tokens),
    };
    trace({ ...context, ts: new Date().toISOString(), kind: "response", status: response.status === "completed" ? "ok" : "error",
      errorCode: response.status === "completed" ? undefined : "response_not_completed", latencyMs: now() - state.started,
      ...usageTokens, ...estimateCost(model, usageTokens), usageMissing: !(typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number") });
    const followUp = needsAudioFollowUp(response, { ...state, turn: 0, interrupted: false }, 0);
    state.done = true;
    if (response.status !== "completed") { fail("response_not_completed"); return; }
    if (followUp) {
      if (++followUps > 4) { fail("tool_followup_limit"); return; }
      requestResponse();
    } else {
      turn.doneMs = now() - turnStarted;
      if (!audio.length) fail("missing_audio");
      else finishWait();
    }
  };
  try {
    const started = now();
    let secret: unknown;
    let status: "ok" | "error" = "error";
    try {
      const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 600 }, session }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new BenchError(`session_http_${response.status}`); }
      secret = await response.json();
      if (!isRecord(secret) || typeof secret.value !== "string" || typeof secret.expires_at !== "number") throw new BenchError("invalid_client_secret");
      status = "ok";
    } finally {
      const usage = { inputTokens: 0, outputTokens: 0 };
      trace({ ...context, ts: new Date().toISOString(), status, errorCode: status === "error" ? "session_failed" : undefined,
        latencyMs: now() - started, ...usage, ...estimateCost(model, usage) });
    }
    if (!isRecord(secret) || typeof secret.value !== "string") throw new BenchError("invalid_client_secret");
    controller.signal.throwIfAborted();
    socket = (deps.socketFactory ?? ((url, protocols) => new WebSocket(url, protocols)))(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, ["realtime", `openai-insecure-api-key.${secret.value}`]);
    socket.addEventListener("message", event => {
      try { if (event instanceof MessageEvent) receive(event.data); }
      catch { fail("invalid_realtime_event"); }
    });
    socket.addEventListener("error", () => fail("websocket_error"));
    socket.addEventListener("close", () => fail("websocket_closed"));
    await waitForEvent();
    for (const question of run.questions) {
      turn = { question, transcript: "", patientMessages: [], revealed: [], firstAudioMs: null, doneMs: null, status: "error", guards: [], guardFailures: [] };
      run.turns.push(turn);
      audio = []; transcripts = new Map(); followUps = 0;
      const done = waitForEvent();
      void done.catch(() => undefined);
      turnStarted = now();
      try {
        send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: question.text }] } });
        requestResponse();
        await done;
        turn.status = "ok";
      } catch (error) {
        turn.error = terminal?.code ?? safeFailure(error);
        throw error;
      } finally {
        turn.patientMessages = [...transcripts.values()].filter(text => text.trim().length > 0);
        turn.transcript = turn.patientMessages.join("\n");
        if (audio.length) {
          turn.audioFile = `${run.id}-q${run.turns.length}.wav`;
          const file = turn.audioFile;
          delete turn.audioFile;
          await writeFile(path.join(directory, file), pcmToWav(Buffer.concat(audio)), { mode: 0o600 });
          turn.audioFile = file;
        }
      }
    }
  } catch (error) {
    run.failures.push(terminal?.code ?? safeFailure(error));
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", abort);
    socket?.close();
    // Persist billable responses that never reached response.done as missing usage.
    for (const state of requests) if (!state.done) {
      const usage = { inputTokens: 0, outputTokens: 0 };
      trace({ ...context, ts: new Date().toISOString(), kind: "response", status: "error", errorCode: terminal?.code ?? "response_incomplete",
        latencyMs: now() - state.started, ...usage, ...estimateCost(model, usage), usageMissing: true });
    }
    await Promise.all(traceWrites);
  }
  const history: ChatMessage[] = [];
  for (const t of run.turns) {
    history.push({ role: "student", text: t.question.text });
    if (t.audioFile && !t.patientMessages.length) t.guardFailures.push("missing_transcript");
    for (const message of t.patientMessages) {
      try {
        t.guards.push(await guardTurn(c, history, message, { apiKey, model: process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL,
          signal: AbortSignal.timeout(30_000), trace: { source: "eval", route, caseId: c.id, personalityId: p.id } }));
      } catch (error) { t.guardFailures.push(safeFailure(error)); }
      history.push({ role: "patient", text: message });
    }
  }
  try {
    const lines = (await readFile(path.join(traceDirectory(), "llm.jsonl"), "utf8")).trim().split("\n");
    const guards: LlmTrace[] = [];
    for (const line of lines) {
      try {
        const value: unknown = JSON.parse(line);
        if (isRecord(value) && value.route === route && value.operation === "guard") guards.push(JSON.parse(line));
      } catch { /* Another process may be appending a line. */ }
    }
    run.traces.push(...guards);
    const attemptedGuards = run.turns.reduce((n, t) => n + t.patientMessages.length, 0);
    if (guards.length < attemptedGuards) run.failures.push("guard_cost_trace_unavailable");
  } catch { run.failures.push("guard_cost_trace_unavailable"); }
  return run;
}

export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.ceil(fraction * values.length) - 1];
}
const issueTypes: GuardIssueType[] = ["invented", "contradiction", "unprompted", "jargon", "out_of_character"];
export function summarize(run: BenchRun) {
  const first = run.turns.flatMap(t => t.status === "ok" && t.firstAudioMs !== null ? [t.firstAudioMs] : []);
  const done = run.turns.flatMap(t => t.status === "ok" && t.doneMs !== null ? [t.doneMs] : []);
  const issues = run.turns.flatMap(t => t.guards.flatMap(g => g.issues));
  return {
    firstAudioP50Ms: percentile(first, 0.5), firstAudioP95Ms: percentile(first, 0.95), doneP50Ms: percentile(done, 0.5),
    completedTurns: done.length, attemptedTurns: run.turns.length, plannedTurns: run.questions.length,
    guardedMessages: run.turns.reduce((n, t) => n + t.guards.length, 0),
    unguardedMessages: run.turns.reduce((n, t) => n + t.patientMessages.length - t.guards.length, 0),
    missingTranscriptTurns: run.turns.filter(t => t.audioFile && !t.patientMessages.length).length,
    guardCounts: Object.fromEntries(issueTypes.map(type => [type, issues.filter(i => i.type === type).length])),
    costUsd: run.traces.reduce((sum, t) => sum + t.costUsd, 0),
    unknownModel: run.traces.some(t => t.unknownModel), usageMissing: run.traces.some(t => t.usageMissing), failures: run.failures,
  };
}
function report(runs: BenchRun[]): string {
  const rows = ["# Voice benchmark", "", "Text request → first received audio delta; not microphone/VAD or audible headset latency. Percentiles use nearest rank over completed turns in each conversation. One conversation per cell; correlated turns and small samples are descriptive only.", "",
    "Guard counts are fallible automated detections, not independent clinical validation. No calibrated controls or human ratings were run by this harness. Inspect transcripts and missing guards. USD includes credential, realtime and guard traces; unknown pricing/missing usage can undercount.", "",
    "| Case / personality | Model / voice / prompt | Completed / planned | First audio p50 / p95 ms | Done p50 ms | Invented / contradiction / unprompted / jargon / role | Guarded / missing | Estimated USD | Failures |",
    "| --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- |"];
  const ms = (value: number | null) => value === null ? "—" : String(Math.round(value));
  for (const run of runs) {
    const s = summarize(run);
    rows.push(`| ${run.caseId} / ${run.personalityId} | ${run.model} / ${run.voice} / ${run.prompt} | ${s.completedTurns}/${s.plannedTurns} | ${ms(s.firstAudioP50Ms)} / ${ms(s.firstAudioP95Ms)} | ${ms(s.doneP50Ms)} | ${issueTypes.map(t => s.guardCounts[t]).join(" / ")} | ${s.guardedMessages} / ${s.unguardedMessages + s.missingTranscriptTurns} | ${s.costUsd.toFixed(6)}${s.unknownModel ? " (unknown model rate)" : ""}${s.usageMissing ? " (usage missing)" : ""} | ${[...s.failures, ...new Set(run.turns.flatMap(t => t.guardFailures))].join(", ") || "—"} |`);
  }
  rows.push("", "Artifacts: [raw results, transcripts, trigger provenance, settings and trace metadata](results.json) · [blind listening](index.html). All attempts are retained; failed/partial turns are excluded from latency percentiles. The default six questions omit absent-info and repetition; use --questions 8 for the full suite.", "");
  return rows.join("\n");
}
const html = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function label(index: number): string { return index < 26 ? String.fromCharCode(65 + index) : `${label(Math.floor(index / 26) - 1)}${String.fromCharCode(65 + index % 26)}`; }
export function auditionPage(runs: BenchRun[], random = (max: number) => randomInt(max)): string {
  const groups = new Map<string, { question: string; clips: { run: BenchRun; turn: BenchTurn }[] }>();
  for (const run of runs) run.turns.forEach((turn, i) => {
    if (!turn.audioFile) return;
    const key = `${run.caseId}/${i}`;
    const group = groups.get(key) ?? { question: turn.question.text, clips: [] };
    group.clips.push({ run, turn }); groups.set(key, group);
  });
  const body: string[] = [];
  for (const [key, group] of groups) {
    for (let i = group.clips.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [group.clips[i], group.clips[j]] = [group.clips[j], group.clips[i]];
    }
    body.push(`<section><h2>${html(key.split("/")[0])}: ${html(group.question)}</h2>`);
    group.clips.forEach(({ run, turn }, i) => {
      const data = Buffer.from(JSON.stringify({ model: run.model, voice: run.voice, personality: run.personalityId, prompt: run.prompt, partial: turn.status !== "ok" })).toString("base64");
      // Opaque file names and encoded key avoid exposing conditions in ordinary player labels.
      body.push(`<article><h3>${label(i)}</h3><audio controls preload="none" src="${html(turn.audioFile!)}"></audio><p class="key" hidden data-key="${data}"></p><label>Listening notes <textarea aria-label="Notes for ${label(i)}"></textarea></label></article>`);
    });
    body.push("</section>");
  }
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Blind voice audition</title><style>body{font:18px system-ui;max-width:960px;margin:2rem auto;padding:1rem;background:#f5f4ef;color:#202a31}section{margin:2rem 0}article{background:white;border:1px solid #ccc;padding:1rem;margin:.8rem 0}audio{width:100%}textarea{display:block;width:95%;min-height:4rem}button{padding:.8rem;font:inherit}.key{font-weight:bold}</style><h1>Blind voice audition</h1><p>Labels are shuffled independently for each question. Rate naturalness, emotion and clarity before revealing. Notes stay in this page and are not saved. Partial recordings may be included. Do not inspect results or source before rating.</p><button id="reveal">Reveal key</button>${body.join("\n")}<script>document.getElementById('reveal').onclick=()=>{document.querySelectorAll('.key').forEach(el=>{const k=JSON.parse(atob(el.dataset.key));el.textContent=[k.model,k.voice,k.personality,k.prompt,k.partial?'partial recording':'complete'].join(' / ');el.hidden=false});document.getElementById('reveal').disabled=true};</script></html>`;
}

export async function runBenchmark(config: BenchConfig, cases: PatientCase[], apiKey: string, deps: Dependencies = {}): Promise<string> {
  const selected = cases.flatMap(c => c.personalities.filter(p => config.personalityId === "all" || p.id === config.personalityId).map(p => ({ c, p })));
  if (!selected.length) throw new Error("No case/personality matched the filters.");
  for (const { c } of selected) questionSuite(c); // Validate probes before any paid requests.
  const timestamp = new Date().toISOString();
  const directory = path.resolve(config.out, `${timestamp.replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`);
  await mkdir(directory, { recursive: true });
  let commit = "unavailable";
  let dirtyPaths = "unavailable";
  let dirtyDiffSha256 = "unavailable";
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    dirtyPaths = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
    dirtyDiffSha256 = hash(execFileSync("git", ["diff", "HEAD", "--", "scripts/voice-bench.ts", "tests/voice-bench.test.ts", "lib/case/prompt.ts", "lib/engine", "app/api/session/route.ts", "components/realtime", "package.json", ".gitignore"], { encoding: "utf8" }));
  } catch { /* Non-git exports remain runnable. */ }
  const runs: BenchRun[] = [];
  const metadata = { timestamp, commit, dirtyPaths, dirtyDiffSha256, scriptSha256: hash(await readFile(new URL(import.meta.url), "utf8")),
    textModel: process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL, config,
    auth: "Ephemeral client secret via HTTPS; realtime + openai-insecure-api-key.<ephemeral> WebSocket subprotocols",
    policy: "Fresh conversation per cell; sequential text turns; no memo/retries; default provider generation settings (no seed/temperature sent).", timeoutMs: deps.timeoutMs ?? 240_000 };
  const checkpoint = async () => {
    await writeFile(path.join(directory, "results.json"), JSON.stringify({ ...metadata, runs, summaries: runs.map(summarize) }, null, 2) + "\n", { mode: 0o600 });
    await writeFile(path.join(directory, "report.md"), report(runs), { mode: 0o600 });
    await writeFile(path.join(directory, "index.html"), auditionPage(runs), { mode: 0o600 });
  };
  await checkpoint();
  for (const { c, p } of selected) for (const model of config.models) for (const voice of config.voices ?? [p.voice]) {
    process.stderr.write(`Voice benchmark: ${c.id}/${p.id} ${model}/${voice} (${config.prompt})\n`);
    runs.push(await runConversation(c, p, model, voice, config, apiKey, directory, deps));
    await checkpoint();
  }
  return directory;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const config = parseArguments(args);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new MissingApiKeyError();
  const cases = [];
  for (const summary of await listCases()) if (config.caseId === "all" || config.caseId === summary.id) cases.push(await loadCase(summary.id));
  const directory = await runBenchmark(config, cases, apiKey);
  process.stdout.write(`Voice benchmark saved: ${directory}\n`);
  const results: unknown = JSON.parse(await readFile(path.join(directory, "results.json"), "utf8"));
  if (isRecord(results) && Array.isArray(results.runs) && results.runs.some(r => isRecord(r) && (
    (Array.isArray(r.failures) && r.failures.length > 0) || (Array.isArray(r.turns) && r.turns.some(t => isRecord(t) && Array.isArray(t.guardFailures) && t.guardFailures.length > 0))))) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { process.stderr.write("Voice benchmark failed. Check arguments, OPENAI_API_KEY and output permissions.\n"); process.exitCode = 1; });
}
