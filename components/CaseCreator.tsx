"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { InterviewCase } from "./types.ts";
import styles from "./CaseCreator.module.css";

export function CaseCreator({ onClose, onCreated }: { onClose: () => void; onCreated: (c: InterviewCase) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => { request.current?.abort(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const diagnosis = String(fields.get("diagnosis") ?? "").trim();
    if (diagnosis.length < 3) { setError("Enter a diagnosis with at least 3 characters."); return; }
    pending.current = true;
    setBusy(true);
    setError("");
    request.current = new AbortController();
    const optional = (name: string) => String(fields.get(name) ?? "").trim() || undefined;
    try {
      const response = await fetch("/api/cases/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosis, age: optional("age") ? Number(fields.get("age")) : undefined, sex: optional("sex"), setting: optional("setting"), personalityHints: optional("personalityHints") }),
        signal: AbortSignal.any([request.current.signal, AbortSignal.timeout(50_000)]),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value?.error?.message || "The patient could not be generated.");
      onCreated(value.case);
    } catch (error) {
      if (!request.current.signal.aborted) setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Generation timed out. Please try again.");
    } finally { pending.current = false; setBusy(false); }
  }

  return <dialog ref={dialog} className={styles.sheet} aria-labelledby="creator-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={event => void submit(event)}>
      <div className={styles.heading}><h2 id="creator-title">A new patient</h2><button type="button" className={styles.close} aria-label="Close case creator" disabled={busy} onClick={onClose}>×</button></div>
      <p className={styles.muted}>Create a synthetic teaching case with two contrasting personalities. Use fictional details only.</p>
      <fieldset disabled={busy} className={styles.fields}>
        <label>Diagnosis<input name="diagnosis" required minLength={3} maxLength={200} placeholder="e.g. Migraine" autoFocus /></label>
        <div className={styles.row}><label>Age <span>(optional)</span><input name="age" type="number" min={0} max={120} step={1} placeholder="45" /></label><label>Sex <span>(optional)</span><select name="sex" defaultValue=""><option value="">Any</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label></div>
        <label>Setting <span>(optional)</span><input name="setting" maxLength={200} placeholder="e.g. Emergency department" /></label>
        <label>Personality hints <span>(optional)</span><textarea name="personalityHints" rows={3} maxLength={500} placeholder="e.g. Reserved versus very talkative" /></label>
      </fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {busy && <p className={styles.muted} role="status">Generating and validating your synthetic patient…</p>}
      <div className={styles.actions}><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" disabled={busy} className={styles.primary}>{busy ? "Generating…" : "Create patient"}</button></div>
    </form>
  </dialog>;
}
