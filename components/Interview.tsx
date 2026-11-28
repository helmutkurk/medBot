"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { ChatMessage, GuardResult, PatientTurn } from "../lib/case/types.ts";
import type { Health, InterviewCase } from "./types.ts";
import { AnamnesisPanel } from "./AnamnesisPanel.tsx";
import type { AnamnesisState } from "./AnamnesisPanel.tsx";
import { CaseCreator } from "./CaseCreator.tsx";
import { downloadJson } from "./download.ts";
import { CoachPanel } from "./CoachPanel.tsx";
import type { CoachState } from "./CoachPanel.tsx";
import { RealtimeInterview } from "./realtime/client.ts";
import type { VoiceStatus } from "./realtime/client.ts";
import type { AnamnesisReport, CoachReport } from "../lib/engine/index.ts";
import styles from "./Interview.module.css";

interface Message extends ChatMessage { id: string }
interface Timing { ms: number; kind: "voice" | "text" }
type Warning = { type: string; detail: string };

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function duration(value: number | null | undefined): string {
  return value == null ? "—" : value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}

async function post<T>(path: string, data: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.any([signal, AbortSignal.timeout(50_000)]) });
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error?.message || "The request failed. Please try again.");
  return value as T;
}

export function Interview({ cases, health }: { cases: InterviewCase[]; health: Health }) {
  if (!health.ready) return <>
    <header className={styles.header}><div className={styles.headerInner}><a className={styles.wordmark} href="/">medBot</a><nav aria-label="Main"><a href="/eval" className={styles.evidenceLink}>Eval</a><a href="/usage" className={styles.evidenceLink}>Usage</a></nav></div></header>
    <main className={styles.main}>
      <section className={`${styles.card} ${styles.setupCard}`} aria-labelledby="setup-title">
        <span className={styles.eyebrow}>Get started</span>
        <h1 id="setup-title">Connect to OpenAI</h1>
        <p>Add your API key to start interviewing patients.</p>
        <ol>
          <li>Copy <code>.env.example</code> to <code>.env.local</code>:<pre>cp .env.example .env.local</pre></li>
          <li>Add <code>OPENAI_API_KEY</code> to <code>.env.local</code>.</li>
          <li>Restart <code>npm run dev</code>, then reload this page.</li>
        </ol>
      </section>
    </main>
  </>;
  return <ReadyInterview cases={cases} />;
}

function ReadyInterview({ cases: initialCases }: { cases: InterviewCase[] }) {
  const [cases, setCases] = useState(initialCases);
  const [creating, setCreating] = useState(false);
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const selected = cases.find(c => c.id === caseId);
  const [personalityId, setPersonalityId] = useState(selected?.personalities[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [timings, setTimings] = useState<Timing[]>([]);
  const [active, setActive] = useState<"voice" | "text" | null>(null);
  const [ended, setEnded] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("Listening");
  const [hint, setHint] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [guardPending, setGuardPending] = useState(0);
  const [coach, setCoach] = useState<CoachState>({ status: "idle" });
  const [anamnesis, setAnamnesis] = useState<AnamnesisState>({ status: "idle" });
  const revealedRef = useRef<Set<string>>(new Set());
  const patientSeen = useRef<Set<string>>(new Set());
  const startedAt = useRef(0);
  const voice = useRef<RealtimeInterview | null>(null);
  const orb = useRef<HTMLButtonElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const requests = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const sending = useRef(false);
  const guardTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  function controller(): AbortController {
    if (!requests.current || requests.current.signal.aborted) requests.current = new AbortController();
    return requests.current;
  }

  function addMessage(message: Message): void {
    if (messagesRef.current.some(item => item.id === message.id)) {
      messagesRef.current = messagesRef.current.map(item => item.id === message.id ? message : item);
    } else {
      messagesRef.current = [...messagesRef.current, message];
    }
    setMessages(messagesRef.current);
  }

  function disclose(ids: string[]): void {
    revealedRef.current = new Set([...revealedRef.current, ...ids.filter(id => selected?.facts.some(f => f.id === id))]);
    setRevealed(revealedRef.current);
  }

  // Long-talk consistency: every 6 patient turns, re-send instructions plus a memo of what is already disclosed.
  async function refreshInstructions(token: number): Promise<void> {
    try {
      const { instructions } = await post<{ instructions: string }>("/api/memo", { caseId, personalityId, revealed: [...revealedRef.current] }, controller().signal);
      if (token === generation.current) voice.current?.updateInstructions(instructions);
    } catch { /* The next interval retries; the conversation continues without the memo. */ }
  }

  async function loadCoach(token: number): Promise<void> {
    const history = messagesRef.current.filter(item => item.text.trim()).map(({ role, text: t }) => ({ role, text: t }));
    if (!history.length) { setCoach({ status: "idle" }); return; }
    setCoach({ status: "loading" });
    try {
      const report = await post<CoachReport>("/api/coach", { caseId, history, revealed: [...revealedRef.current] }, controller().signal);
      if (token === generation.current) setCoach({ status: "ready", report });
    } catch (error) {
      if (token === generation.current && !controller().signal.aborted) setCoach({ status: "error", message: error instanceof Error ? error.message : "The coach report could not be created." });
    }
  }

  async function loadAnamnesis(token: number): Promise<void> {
    const history = messagesRef.current.filter(item => item.text.trim()).map(({ role, text }) => ({ role, text }));
    if (!history.length) { setAnamnesis({ status: "idle" }); return; }
    setAnamnesis({ status: "loading" });
    try {
      const report = await post<AnamnesisReport>("/api/anamnesis", { caseId, history, revealed: [...revealedRef.current] }, controller().signal);
      if (token === generation.current) setAnamnesis({ status: "ready", report });
    } catch (error) {
      if (token === generation.current) setAnamnesis({ status: "error", message: error instanceof Error ? error.message : "The anamnesis could not be created." });
    }
  }

  async function checkReply(reply: string, history: ChatMessage[], token: number): Promise<void> {
    setGuardPending(n => n + 1);
    try {
      const result = await post<GuardResult>("/api/guard", { caseId, history, reply }, controller().signal);
      if (token !== generation.current) return;
      setWarnings(previous => [...previous, ...result.issues]);
    } catch (error) {
      if (token === generation.current && !controller().signal.aborted) {
        setWarnings(previous => [...previous, { type: "guard unavailable", detail: error instanceof Error ? error.message : "This response could not be checked." }]);
      }
    } finally { if (token === generation.current) setGuardPending(n => Math.max(0, n - 1)); }
  }

  function clearInterview(): void {
    generation.current += 1;
    voice.current?.close();
    voice.current = null;
    requests.current?.abort();
    guardTimers.current.forEach(timer => clearTimeout(timer));
    guardTimers.current.clear();
    messagesRef.current = [];
    setMessages([]);
    revealedRef.current = new Set();
    patientSeen.current = new Set();
    setRevealed(new Set());
    setCoach({ status: "idle" });
    setAnamnesis({ status: "idle" });
    setWarnings([]);
    setTimings([]);
    setHint("");
    setEnded(false);
    setActive(null);
    setBusy(false);
    sending.current = false;
    setGuardPending(0);
    setStatus("Listening");
  }

  useEffect(() => () => {
    generation.current += 1;
    voice.current?.close();
    requests.current?.abort();
    guardTimers.current.forEach(timer => clearTimeout(timer));
  }, []);

  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, busy]);

  function toggleInterview(): void {
    if (active) {
      // Ignore the second click of a double-click on Start.
      if (performance.now() - startedAt.current < 700) return;
      endInterview();
    } else if (!busy) startInterview();
  }

  function endInterview(): void {
    voice.current?.close();
    voice.current = null;
    setActive(null);
    setEnded(true);
    void loadCoach(generation.current);
    void loadAnamnesis(generation.current);
  }

  function downloadTranscript(): void {
    if (!selected) return;
    const personality = selected.personalities.find(p => p.id === personalityId);
    const data = {
      exportedAt: new Date().toISOString(),
      app: "medBot",
      engineMode: "openai",
      case: { id: selected.id, title: selected.title, patient: selected.patient },
      personality: personality ?? { id: personalityId },
      messages: messages.map(({ role, text: t }) => ({ role, text: t })),
      revealedFactIds: [...revealed],
      latencies: timings.map(({ kind, ms }) => ({ kind, ms: Math.round(ms) })),
      guardWarnings: warnings,
      coachReport: coach.status === "ready" ? coach.report : null,
      anamnesis: anamnesis.status === "ready" ? anamnesis.report : null,
      anamnesisStatus: anamnesis.status,
    };
    downloadJson(data, `medbot-${selected.id}-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`);
  }

  function startInterview(): void {
    if (!selected || active || busy) return;
    clearInterview();
    startedAt.current = performance.now();
    setActive("voice");
    setStatus("Connecting");
    const token = generation.current;
    const client = new RealtimeInterview({
      onStatus: next => { if (token === generation.current) setStatus(next); },
      onMessage: (role, message, id) => {
        if (token !== generation.current) return;
        addMessage({ role, text: message, id });
        if (role === "patient" && message.trim() && !patientSeen.current.has(id)) {
          patientSeen.current.add(id);
          if (patientSeen.current.size % 6 === 0) void refreshInstructions(token);
        }
        if (role === "patient") {
          // Input transcription is asynchronous; give it a short window before checking.
          const timer = setTimeout(() => {
            guardTimers.current.delete(timer);
            if (token !== generation.current) return;
            const index = messagesRef.current.findIndex(item => item.id === id);
            const preceding = messagesRef.current.slice(0, index);
            if (preceding.some(item => !item.text.trim())) setWarnings(previous => [...previous, { type: "incomplete transcript", detail: "A question was still transcribing when this reply was checked. Disclosure observations may be incomplete." }]);
            void checkReply(message, preceding.filter(item => item.text.trim()).map(({ role: r, text: t }) => ({ role: r, text: t })), token);
          }, 500);
          guardTimers.current.add(timer);
        }
      },
      onFact: id => { if (token === generation.current) disclose([id]); },
      onLatency: ms => { if (token === generation.current) setTimings(previous => [...previous, { ms, kind: "voice" }]); },
      onLevel: (mic, patient) => { orb.current?.style.setProperty("--mic-level", mic.toFixed(3)); orb.current?.style.setProperty("--out-level", patient.toFixed(3)); },
      onError: message => { if (token === generation.current) setHint(message); },
      onDisconnect: () => {
        if (token !== generation.current) return;
        voice.current = null;
        setActive("text");
        setStatus("Listening");
      },
    }, selected.facts.map(f => f.id));
    voice.current = client;
    void client.start(caseId, personalityId);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const question = text.trim();
    if (!question || !selected || sending.current) return;
    if (active === "voice") {
      try { voice.current?.sendText(question); setText(""); }
      catch (error) { setHint(error instanceof Error ? error.message : "Please try again."); }
      return;
    }
    if (ended) clearInterview();
    const token = generation.current;
    const history = messagesRef.current.filter(item => item.text.trim()).map(({ role, text: t }) => ({ role, text: t }));
    sending.current = true;
    setBusy(true);
    setActive("text");
    setHint("");
    setText("");
    const studentId = crypto.randomUUID();
    addMessage({ id: studentId, role: "student", text: question });
    const started = performance.now();
    try {
      const turn = await post<PatientTurn>("/api/chat", { caseId, personalityId, history, text: question }, controller().signal);
      if (token !== generation.current) return;
      setTimings(previous => [...previous, { ms: performance.now() - started, kind: "text" }]);
      addMessage({ id: crypto.randomUUID(), role: "patient", text: turn.reply });
      disclose(turn.revealed);
      void checkReply(turn.reply, [...history, { role: "student", text: question }], token);
    } catch (error) {
      if (token !== generation.current) return;
      messagesRef.current = messagesRef.current.filter(message => message.id !== studentId);
      setMessages(messagesRef.current);
      setText(question);
      setHint(error instanceof Error ? error.message : "The patient could not reply. Please try again.");
    } finally {
      if (token === generation.current) { sending.current = false; setBusy(false); }
    }
  }

  const timingKind = active === "voice" ? "voice" : timings.at(-1)?.kind ?? "text";
  const currentTimings = timings.filter(timing => timing.kind === timingKind).map(timing => timing.ms);
  const typical = median(currentTimings);
  const last = currentTimings.at(-1);
  const locked = Boolean(active) || busy;
  const categories = [...new Set(selected?.facts.map(f => f.category) ?? [])];
  const badge = active === "text" ? "Text · OpenAI" : "Voice ready";
  const personality = selected?.personalities.find(p => p.id === personalityId);
  const patientFirst = selected?.patient.name.split(" ")[0] ?? "Patient";
  const initials = (name: string) => name.split(" ").map(part => part[0]).slice(0, 2).join("");
  // One plain-language state for the patient card, shared by voice and text.
  const state = active === "voice"
    ? ({ Connecting: "Connecting", Listening: "Listening", "Patient speaking": "Speaking", Thinking: "Thinking" } as const)[status]
    : busy ? "Thinking" : active === "text" ? "Ready" : ended ? "Finished" : "Not started";
  const stateTone = state === "Speaking" ? styles.toneSpeaking : state === "Thinking" || state === "Connecting" ? styles.toneBusy : state === "Listening" || state === "Ready" ? styles.toneLive : "";
  const orbClass = [styles.orb, active ? styles.orbActive : "", active === "voice" && status === "Patient speaking" ? styles.speaking : ""].join(" ");

  return <>
    <header className={styles.header}><div className={styles.headerInner}>
      <a className={styles.wordmark} href="/" aria-label="medBot home"><span className={styles.logo} aria-hidden="true">m</span>medBot</a>
      <nav className={styles.headerNav} aria-label="Main"><a href="/eval" className={styles.evidenceLink}>Eval</a><a href="/usage" className={styles.evidenceLink}>Usage</a><span className={styles.badge}><span className={styles.dot} />{badge}</span></nav>
    </div></header>
    <main className={styles.main}>
      <div className={styles.intro}><span className={styles.eyebrow}>Virtual interview patient</span><h1>A little practice.<br />A better conversation.</h1><p>Meet your patient. Listen closely. Ask what matters.</p></div>
      {!cases.length ? <section className={styles.card}><h2>No patient cases available</h2><p className={styles.subtle}>Create a synthetic patient to begin.</p><button type="button" className={styles.secondary} onClick={() => setCreating(true)}>New patient</button></section> : <>
        <section className={styles.setup} aria-labelledby="setup-title">
          <div className={styles.sectionTitle}><h2 id="setup-title">Choose your patient</h2><span>{locked ? "Locked during the interview" : "Synthetic cases only"}</span></div>
          <div className={styles.caseGrid}>{cases.map(c => <button type="button" key={c.id} disabled={locked} aria-pressed={caseId === c.id} className={`${styles.caseCard} ${caseId === c.id ? styles.selected : ""}`} onClick={() => { clearInterview(); setCaseId(c.id); setPersonalityId(c.personalities[0]?.id ?? ""); }}>
            <span className={styles.avatar} aria-hidden="true">{initials(c.patient.name)}</span>
            <span className={styles.caseInfo}><strong>{c.patient.name}</strong><span>{c.patient.age} years · {c.patient.job}</span><span className={styles.caseTitle}>{c.title}</span><span className={styles.redFlagBadge}>{c.redFlagCount} red flag{c.redFlagCount === 1 ? "" : "s"}</span></span><span className={styles.selectionMark} aria-hidden="true">{caseId === c.id ? "✓" : ""}</span>
          </button>)}<button type="button" disabled={locked} className={`${styles.caseCard} ${styles.newPatient}`} onClick={() => setCreating(true)}><span className={styles.avatar} aria-hidden="true">+</span><span className={styles.caseInfo}><strong>New patient</strong><span>Create a synthetic teaching case</span></span></button></div>
          <div className={styles.personalityRow}><span className={styles.label}>Personality</span><div className={styles.segmented} role="group" aria-label="Patient personality">{selected?.personalities.map(p => <button type="button" key={p.id} disabled={locked} aria-pressed={p.id === personalityId} onClick={() => { clearInterview(); setPersonalityId(p.id); }}>{p.label}</button>)}</div></div>
        </section>
        <div className={styles.workspace}>
          <section className={`${styles.card} ${styles.interview}`} aria-labelledby="interview-title">
            <h2 id="interview-title" className="sr-only">Your interview</h2>
            {selected && <div className={styles.patientCard}>
              <span className={`${styles.avatar} ${styles.avatarLg}`} aria-hidden="true">{initials(selected.patient.name)}</span>
              <div className={styles.patientInfo}><strong>{selected.patient.name}</strong><span>{selected.patient.age} years · {selected.patient.job}{personality ? ` · ${personality.label}` : ""}</span></div>
              <span className={`${styles.state} ${stateTone}`} role="status"><span className={styles.stateDot} aria-hidden="true" />{state}</span>
            </div>}
            <div className={styles.orbArea}>
              <button ref={orb} type="button" className={orbClass} style={{ "--mic-level": 0, "--out-level": 0 } as CSSProperties} disabled={busy} aria-label={active ? "End interview" : "Start interview"} onClick={toggleInterview}>
                {active ? <span className={styles.stopIcon} /> : <svg width="34" height="42" viewBox="0 0 34 42" fill="none" aria-hidden="true"><rect x="10" y="2" width="14" height="25" rx="7" stroke="currentColor" strokeWidth="2.5" /><path d="M3 20v2a14 14 0 0 0 28 0v-2M17 36v5M11 41h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>}
              </button>
              <strong className={styles.orbLabel}>{active ? "End interview" : ended ? "Start a new interview" : "Start interview"}</strong>
              <span className={styles.status}>{active === "voice" ? (status === "Connecting" ? "Connecting to your patient…" : "Speak naturally, or type below.") : busy ? "Patient is thinking…" : active === "text" ? "Text interview · ready" : ended ? "Interview complete" : "A conversation starts with a question"}</span>
              <span className={styles.latency} title={timingKind === "voice" ? "From speech stopped to first patient audio event" : "From submitting text to receiving the complete reply"}>{timingKind === "voice" ? "Voice onset" : "Text round trip"} · Last {duration(last)} · Median {duration(typical)}</span>
            </div>
            {hint && <p className={`${styles.notice} ${styles.noticeWarn}`} role="status">{hint}</p>}
            <div ref={transcript} className={styles.transcript} role="log" aria-label="Interview transcript" aria-live="polite" aria-relevant="additions">
              {!messages.length && <div className={styles.emptyTranscript}><p>“What brings you in today?”</p><small>A good place to begin. Start the interview and speak, or just type below.</small></div>}
              {messages.map(message => <div key={message.id} className={`${styles.message} ${message.role === "student" ? styles.student : styles.patient}`}><span className={styles.speaker}>{message.role === "student" ? "You" : patientFirst}</span><p>{message.text || "Transcribing…"}</p></div>)}
              {busy && <p className={styles.thinking}>Patient is thinking…</p>}
            </div>
            <form className={styles.composer} onSubmit={event => void submit(event)}>
              <label htmlFor="question" className="sr-only">Your question to the patient</label><input id="question" value={text} onChange={event => setText(event.target.value)} placeholder="Ask your patient a question…" maxLength={8000} autoComplete="off" disabled={busy} />
              <button type="submit" aria-label="Send question" disabled={!text.trim() || busy || (active === "voice" && status !== "Listening")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
            </form>
            <div className={styles.composerFoot}>
              <p className={styles.composerNote}>Text is always available. {active === "voice" ? "Typed questions use the same voice conversation." : "Press Enter to send."}</p>
              <button type="button" className={styles.ghost} disabled={!messages.length} onClick={downloadTranscript}>Download transcript</button>
            </div>
          </section>
          <aside className={styles.sidebar}>
            <section className={`${styles.card} ${styles.facts}`} aria-labelledby="facts-title"><div className={styles.sectionTitle}><h2 id="facts-title">Disclosed facts</h2><span className={styles.count}>{revealed.size}/{selected?.facts.length ?? 0}</span></div><p className={styles.subtle}>The patient reveals their story as you ask.</p><progress className={styles.progress} value={revealed.size} max={selected?.facts.length || 1} aria-label="Facts disclosed" />
              {categories.map(category => <div className={styles.factGroup} key={category}><h3>{category}</h3><ul>{selected?.facts.filter(f => f.category === category).map(f => <li key={f.id} className={revealed.has(f.id) ? styles.disclosed : ""}><span className={styles.check} aria-hidden="true">{revealed.has(f.id) ? "✓" : ""}</span><span><span className="sr-only">{revealed.has(f.id) ? "Disclosed: " : "Not yet disclosed: "}</span>{f.lay}</span></li>)}</ul></div>)}
            </section>
            <section className={`${styles.card} ${styles.guard}`} aria-labelledby="guard-title"><div className={styles.sectionTitle}><h2 id="guard-title">Consistency check</h2></div><p className={styles.subtle}>{guardPending ? "Checking the latest replies…" : warnings.length ? "Review these observations after your interview." : "Observations will appear here as you talk."}</p>{warnings.length > 0 && <ul className={styles.warningList}>{warnings.map((warning, index) => <li key={index}><strong>{warning.type.replaceAll("_", " ")}</strong><span>{warning.detail}</span></li>)}</ul>}</section>
          </aside>
        </div>
        {ended && <section className={`${styles.card} ${styles.summary}`} aria-labelledby="summary-title">
          <div className={styles.summaryHead}><div><span className={styles.eyebrow}>Interview complete</span><h2 id="summary-title">Every question builds the picture.</h2></div><button type="button" className={styles.secondary} disabled={!messages.length} onClick={downloadTranscript}>Download transcript</button></div>
          <div className={styles.summaryStats}><div><strong>{revealed.size}<small> / {selected?.facts.length}</small></strong><span>Facts covered</span></div><div><strong>{(selected?.facts.length ?? 0) - revealed.size}</strong><span>Still to explore</span></div><div><strong>{messages.filter(m => m.role === "patient").length}</strong><span>Patient turns</span></div>{(["voice", "text"] as const).map(kind => { const values = timings.filter(t => t.kind === kind).map(t => t.ms); return values.length ? <div key={kind}><strong>{duration(median(values))}</strong><span>Median {kind === "voice" ? "voice onset" : "text round trip"}</span></div> : null; })}</div>
          <div className={styles.summaryPanels}><div className={styles.coachWrap}><h3>Coach report</h3><CoachPanel state={coach} hasMessages={messages.some(m => m.text.trim())} onRetry={() => void loadCoach(generation.current)} /></div>
          <div className={styles.coachWrap}><h3>Anamnesis</h3><AnamnesisPanel state={anamnesis} onRetry={() => void loadAnamnesis(generation.current)} /></div></div>
        </section>}
      </>}
      {creating && <CaseCreator onClose={() => setCreating(false)} onCreated={c => { clearInterview(); setCases(previous => [...previous.filter(item => item.id !== c.id), c]); setCaseId(c.id); setPersonalityId(c.personalities[0]?.id ?? ""); setCreating(false); setHint("AI-generated synthetic patient created. Your patient is ready."); }} />}
      <footer className={styles.footer}><span>Built for better listening.</span><span>hackaTUM 2026 · Avelios VIP</span><p>Synthetic patients for education. Not clinical advice. Conversations are not saved by this app.</p></footer>
    </main>
  </>;
}
