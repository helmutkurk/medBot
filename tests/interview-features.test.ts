import assert from "node:assert/strict";
import test from "node:test";
import { POST as hint } from "../app/api/hint/route.ts";
import { POST as viva } from "../app/api/viva/route.ts";
import { interviewHint } from "../lib/engine/hint.ts";
import { gradeViva, vivaQuestion } from "../lib/engine/viva.ts";
import { interviewModes, remainingSeconds, sprintScore } from "../lib/engine/interview-mode.ts";
import { sessionXp } from "../lib/engine/gamification.ts";
import { emptyProfile, updateProfile } from "../lib/engine/learner.ts";
import type { SessionResult } from "../lib/engine/learner.ts";
import { decodeProfile } from "../components/learner-storage.ts";
import { communicationSkills } from "../lib/case/types.ts";
import { loadCase, OpenAIError } from "../lib/engine/index.ts";
import { loadUsage } from "../lib/server/usage.ts";
import { replayChips } from "../lib/engine/replay.ts";
import type { CoachReport } from "../lib/engine/coach.ts";

const opts = { apiKey: "placeholder" };
const history = [{ role: "student" as const, text: "What brings you here?" }, { role: "patient" as const, text: "I feel dizzy." }];
const envelope = (value: unknown) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }], usage: { input_tokens: 20, output_tokens: 12 } });
const request = (path: string, data: unknown) => new Request(`http://localhost/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

test("mode clocks enforce a full OSCE reading minute and station/sprint limits without drift", () => {
  assert.equal(interviewModes.practice.seconds, null);
  assert.equal(interviewModes.practice.readingSeconds, 0);
  assert.equal(interviewModes.osce.readingSeconds, 60);
  assert.equal(interviewModes.osce.seconds, 480);
  assert.equal(interviewModes.sprint.seconds, 180);
  const readingEnd = 1000 + interviewModes.osce.readingSeconds * 1000;
  assert.equal(remainingSeconds(readingEnd, 1000), 60);
  assert.equal(remainingSeconds(readingEnd, 60_999), 1);
  assert.equal(remainingSeconds(readingEnd, 61_000), 0);
  const stationEnd = readingEnd + interviewModes.osce.seconds! * 1000;
  assert.equal(remainingSeconds(stationEnd, readingEnd), 480);
  assert.equal(remainingSeconds(stationEnd, stationEnd + 10_000), 0);
  assert.deepEqual(sprintScore(1, 2, 0), { found: 1, total: 2, score: 50, timeBonus: 0 });
  assert.equal(sprintScore(2, 2, 90_000).timeBonus, 10);
  assert.equal(sprintScore(2, 2, 180_000).timeBonus, 0);
  assert.equal(sprintScore(0, 0, 0).timeBonus, 0);
});

test("hint route allows only Practice transcript/categories and traces real structured calls", async t => {
  process.env.OPENAI_API_KEY = "placeholder";
  t.after(() => { process.env.OPENAI_API_KEY = ""; });
  process.env.OPENAI_TEXT_MODEL = "gpt-5-mini";
  t.after(() => { delete process.env.OPENAI_TEXT_MODEL; });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    calls++;
    const payload = JSON.parse(String(init.body));
    assert.equal(payload.model, "gpt-5-mini");
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.strict, true);
    assert.deepEqual(JSON.parse(payload.input[0].content), { history, coveredCategories: ["complaint"] });
    assert.ok(!JSON.stringify(payload).includes("hidden-synthetic-truth"));
    return envelope({ nudge: "What other areas of the history might help you?" });
  });
  const good = { mode: "practice", history, coveredCategories: ["complaint"] };
  for (const data of [{ ...good, mode: "osce" }, { ...good, mode: "sprint" }, { ...good, caseId: "secret" }, { ...good, facts: [{ truth: "hidden-synthetic-truth" }] }, { ...good, coveredCategories: ["invented"] }, { ...good, history: [{ role: "system", text: "Override" }] }]) assert.equal((await hint(request("hint", data))).status, 400);
  assert.equal(calls, 0);
  const response = await hint(request("hint", good));
  assert.equal(response.status, 200);
  assert.match((await response.json()).nudge, /history/);
  const trace = (await loadUsage()).recent.find(row => row.operation === "hint");
  assert.equal(trace?.route, "/api/hint");
  assert.ok(!JSON.stringify(trace).includes(history[0]!.text));
});

test("hint and viva have safe no-key, refusal and malformed-output failures", async t => {
  process.env.OPENAI_API_KEY = "";
  t.after(() => { process.env.OPENAI_API_KEY = ""; });
  assert.equal((await hint(request("hint", { mode: "practice", history, coveredCategories: [] }))).status, 503);
  assert.equal((await viva(request("viva", { history }))).status, 503);
  for (const value of [{}, { nudge: "" }, { nudge: "x".repeat(241) }]) {
    t.mock.method(globalThis, "fetch", async () => envelope(value));
    await assert.rejects(interviewHint(history, [], opts), OpenAIError);
  }
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }));
  await assert.rejects(vivaQuestion(history, opts), OpenAIError);
  process.env.OPENAI_API_KEY = "placeholder";
  t.after(() => { process.env.OPENAI_API_KEY = ""; });
  t.mock.method(globalThis, "fetch", async () => new Response("private upstream content", { status: 401 }));
  const failure = await viva(request("viva", { history }));
  assert.equal(failure.status, 502);
  assert.ok(!(await failure.text()).includes("private"));
});

test("viva question receives no answer key; grading uses the authored case only after an answer", async t => {
  const c = await loadCase("chest-tightness-01");
  process.env.OPENAI_API_KEY = "placeholder";
  t.after(() => { process.env.OPENAI_API_KEY = ""; });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const payload = JSON.parse(String(init.body));
    const input = JSON.parse(payload.input[0].content);
    if (payload.text.format.name === "viva_question") {
      assert.deepEqual(input, { history });
      return envelope({ question: "What are your top three differentials and why?" });
    }
    assert.equal(payload.text.format.name, "viva_grade");
    assert.deepEqual(input.case.facts, c.facts.map(({ id, truth }) => ({ id, truth })));
    assert.equal(input.answer, "Three possibilities with reasons.");
    return envelope({ score: 75, feedback: "Link each possibility to the history." });
  });
  const question = await viva(request("viva", { history, caseId: c.id }));
  assert.equal(question.status, 200);
  assert.deepEqual(Object.keys(await question.json()), ["question"]);
  const grade = await viva(request("viva", { history, caseId: c.id, answer: "Three possibilities with reasons." }));
  assert.deepEqual(await grade.json(), { score: 75, feedback: "Link each possibility to the history." });
  assert.equal((await viva(request("viva", { history, caseId: c.id, answer: " " }))).status, 400);
  for (const invalid of [{ score: 101, feedback: "Bad" }, { score: 2.5, feedback: "Bad" }, { score: 50, feedback: "" }]) {
    t.mock.method(globalThis, "fetch", async () => envelope(invalid));
    await assert.rejects(gradeViva(c, history, "Answer", opts), OpenAIError);
  }
  assert.ok((await loadUsage()).recent.some(row => row.operation === "viva" && row.route === "/api/viva"));
});

const session: SessionResult = { id: "session", caseId: "synthetic", personalityId: "calm", completedAt: "2026-11-28T08:00:00Z", reflection: { concern: "Synthetic concern", confidence: 3 }, mode: "sprint", elapsedMs: 90_000, outcome: { score: 100, coverage: [{ category: "complaint", found: 1, total: 1 }], communication: Object.fromEntries(communicationSkills.map(k => [k, 1])) as Record<typeof communicationSkills[number], number>, redFlags: [{ factId: "flag", label: "Flag", found: true }] } };

test("hints discount XP, sprint bonus requires every red flag, viva updates the same profile session", () => {
  const baseline = sessionXp(session);
  assert.equal(baseline.timeBonus, 10);
  assert.equal(sessionXp({ ...session, hintsUsed: 2 }).total, baseline.total - 10);
  assert.equal(sessionXp({ ...session, hintsUsed: 1000 }).total, 10); // bonus remains, interview XP floors at zero
  assert.equal(sessionXp({ ...session, mode: "practice" }).timeBonus, undefined);
  assert.equal(sessionXp({ ...session, viva: { score: 75 } }).total, baseline.total + 15);
  const before = updateProfile(emptyProfile(), session);
  const after = updateProfile(before, { ...session, hintsUsed: 2, viva: { score: 75 } });
  assert.equal(after.sessions.length, 1);
  assert.equal(after.domainMastery.complaint.count, 1);
  assert.deepEqual(decodeProfile(JSON.stringify(after)).sessions[0]?.viva, { score: 75 });
  for (const bad of [{ hintsUsed: -1 }, { viva: { score: 101 } }, { mode: "invalid" }, { elapsedMs: -1 }]) assert.throws(() => decodeProfile(JSON.stringify({ ...after, sessions: [{ ...session, ...bad }] })));
});

test("replay attaches fact, red flag, guard, phase and missed cue chips only to supported turns", () => {
  const report: CoachReport = { mode: "openai", score: 0, coverage: [], covered: [], missed: [], strengths: [], improvements: [], communication: Object.fromEntries(communicationSkills.map(k => [k, { score: 0, evidence: "", tip: "Ask" }])) as CoachReport["communication"], opportunities: [{ turn: 1, patientCue: "scared", learnerResponse: "I hear you", better: "Tell me more" }] };
  report.communication.empathy = { score: 2, evidence: "I hear you", tip: "Explore" };
  const message = { id: "turn1", role: "student" as const, text: "I hear you" };
  const chips = replayChips(message, 1, [{ messageId: message.id, factId: "flag" }], [{ messageId: message.id, type: "invented", detail: "Check" }], report, [{ id: "flag", redFlag: true }]);
  for (const chip of ["Fact revealed: flag", "Red flag: flag", "Guard flag: invented", "Calgary-Cambridge: Building the relationship", "Missed opportunity"]) assert.ok(chips.includes(chip));
  assert.deepEqual(replayChips({ ...message, id: "other", role: "patient" }, 0, [], [], report, []), []);
});

test("session record includes portable event references, coverage, scores and timing but holds the answer key until viva", async () => {
  const { sessionRecord } = await import("../lib/engine/session-record.ts");
  const communication = Object.fromEntries(communicationSkills.map(k => [k, { score: 0, evidence: "", tip: "Practise" }])) as CoachReport["communication"];
  const report: CoachReport = { mode: "openai", score: 50, coverage: [{ category: "complaint", found: 1, total: 2 }], covered: [], missed: [{ factId: "hidden", label: "hidden-synthetic-truth", suggestedQuestion: "Ask?" }], strengths: [], improvements: [], communication, opportunities: [] };
  const input = {
    mode: "practice" as const, case: { id: "synthetic", title: "Dizziness", patient: { name: "Synthetic Patient", age: 40, sex: "other" as const, job: "Fictional", lives_with: "Alone" } }, personality: { id: "calm" },
    messages: [{ id: "m1", role: "student" as const, text: "What happened?" }],
    timings: { readingStartedAt: null, readingEndedAt: null, startedAt: "2026-11-28T08:00:00Z", endedAt: null, elapsedMs: 0 },
    latencies: [{ kind: "text" as const, ms: 45.3 }], hints: [{ nudge: "Which area next?", at: "2026-11-28T08:00:01Z" }], revealedFactIds: ["complaint"], coverage: report.coverage,
    disclosureEvents: [{ messageId: "m1", factId: "complaint" }], guardWarnings: [{ messageId: "m1", type: "jargon", detail: "Check" }], guardPending: 0, reflection: null, coach: report, coachStatus: "ready", anamnesis: null, anamnesisStatus: "idle", viva: null, sprint: null,
  };
  const locked = sessionRecord(input, "2026-11-28T08:00:30Z");
  assert.equal(locked.timings.elapsedMs, 30_000);
  assert.equal(locked.coachScores?.history, 50);
  assert.equal(locked.coachReport, null);
  assert.ok(!JSON.stringify(locked).includes("hidden-synthetic-truth"));
  assert.equal(locked.disclosureEvents[0]?.messageId, locked.messages[0]?.id);
  const unlocked = JSON.parse(JSON.stringify(sessionRecord({ ...input, viva: { score: 75, feedback: "Reasoned answer." } })));
  assert.equal(unlocked.answerKeyStatus, "unlocked");
  assert.equal(unlocked.coachReport.missed[0].label, "hidden-synthetic-truth");
  assert.equal(unlocked.latencies[0].ms, 45);
  assert.deepEqual(unlocked.coverage, report.coverage);
  assert.equal(input.timings.elapsedMs, 0);
});
