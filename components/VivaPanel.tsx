"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/case/types.ts";
import type { VivaResult } from "../lib/engine/viva.ts";
import styles from "./Interview.module.css";

export function VivaPanel({ caseId, history, onResult }: { caseId: string; history: ChatMessage[]; onResult: (result: VivaResult) => void }) {
  const grading = useRef<AbortController | null>(null);
  useEffect(() => () => grading.current?.abort(), []);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<VivaResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError("");
    void fetch("/api/viva", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ history }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50_000)]) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? "The viva question could not load."); if (!controller.signal.aborted) setQuestion(data.question); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Viva unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [history, attempt]);
  return <section aria-labelledby="viva-title"><h3 id="viva-title">Viva · Explain your reasoning</h3>
    {result ? <><p><strong>{result.score}/100</strong> · {result.feedback}</p><p>Viva saved to your learner profile. Detailed feedback is now unlocked.</p></> : <>
      <p>Answer before opening the case answer key. Earn up to 20 XP for your reasoning.</p>
      {question && <form className={styles.reflection} onSubmit={async event => {
        event.preventDefault(); if (busy || !answer.trim()) return; setBusy(true); setError("");
        const controller = new AbortController(); grading.current = controller;
        try {
          const response = await fetch("/api/viva", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId, history, answer }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50_000)]) });
          const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? "The answer could not be graded.");
          if (!controller.signal.aborted) { setResult(data); onResult(data); }
        } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Viva unavailable."); } finally { if (!controller.signal.aborted) setBusy(false); }
      }}><label htmlFor="viva-answer">{question}<textarea id="viva-answer" required maxLength={4000} rows={5} value={answer} disabled={busy} onChange={e => setAnswer(e.target.value)} /></label><button className={styles.secondary} disabled={busy || !answer.trim()}>{busy ? "Grading…" : "Submit viva answer"}</button></form>}
      {busy && !question && <p role="status">Your examiner is preparing a question…</p>}
      {error && <p role="alert">{error} {!question && <button className={styles.ghost} type="button" onClick={() => setAttempt(n => n + 1)}>Retry question</button>}</p>}
    </>}
  </section>;
}
