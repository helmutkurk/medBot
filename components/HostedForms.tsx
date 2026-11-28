"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Feedback } from "../lib/server/feedback.ts";
import styles from "../app/hosted.module.css";

async function send(url: string, value: unknown): Promise<void> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || "The request could not be completed.");
  }
}

export function AccessForm() {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, code = new FormData(form).get("code");
    setBusy(true); setError("");
    try {
      await send("/access/login", { code });
      form.reset();
      window.location.assign("/");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not unlock the demo."); }
    finally { setBusy(false); }
  }
  return <form className={styles.form} onSubmit={unlock}>
    <label htmlFor="access-code">Shared passcode</label>
    <input id="access-code" name="code" type="password" autoComplete="current-password" required maxLength={512} />
    <button disabled={busy}>{busy ? "Opening…" : "Open medBot"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

export function FeedbackForm() {
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    setBusy(true); setMessage(""); setError("");
    try {
      await send("/api/feedback", { rating: Number(fields.get("rating")), text: fields.get("text") });
      form.reset(); setMessage("Thank you. Your feedback has been received.");
    } catch (error) { setError(error instanceof Error ? error.message : "Feedback could not be sent."); }
    finally { setBusy(false); }
  }
  return <form className={styles.form} onSubmit={submit}>
    <label htmlFor="feedback-rating">How useful was medBot?</label>
    <select id="feedback-rating" name="rating" required defaultValue="">
      <option value="" disabled>Choose a rating</option>
      <option value="1">1 · Not useful</option><option value="2">2 · Slightly useful</option>
      <option value="3">3 · Somewhat useful</option><option value="4">4 · Useful</option><option value="5">5 · Very useful</option>
    </select>
    <label htmlFor="feedback-text">What worked, or what should improve? (optional)</label>
    <textarea id="feedback-text" name="text" rows={5} maxLength={2000} aria-describedby="feedback-warning" />
    <p id="feedback-warning">Do not enter patient data, names, contact details or other personal information. Feedback is shared with the host and stored in server logs. <a href="/privacy">Privacy notice</a></p>
    <button disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </form>;
}

export function FeedbackAdmin() {
  const [entries, setEntries] = useState<Feedback[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError("");
    try {
      await send("/api/feedback/admin", { code: new FormData(form).get("code") });
      form.reset();
      const response = await fetch("/api/feedback", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Feedback could not be loaded.");
      setEntries(data.entries);
    } catch (error) { setEntries(null); setError(error instanceof Error ? error.message : "Feedback could not be loaded."); }
    finally { setBusy(false); }
  }
  return <details className={styles.admin}>
    <summary>Host: review feedback</summary>
    <form className={styles.form} onSubmit={unlock}>
      <label htmlFor="admin-code">Admin code</label>
      <input id="admin-code" name="code" type="password" autoComplete="off" required maxLength={512} />
      <button disabled={busy}>{busy ? "Loading…" : "View feedback"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    {entries && <div aria-live="polite"><p>Recent feedback available on this server instance ({entries.length}). Hosted storage is temporary; server logs may contain additional entries.</p>
      {entries.map(entry => <article className={styles.entry} key={entry.id}><p><strong>{entry.rating}/5</strong> · <time dateTime={entry.ts}>{entry.ts}</time></p><p className={styles.feedbackText}>{entry.text || "No comment."}</p></article>)}
    </div>}
  </details>;
}
