"use client";

import { useEffect, useState } from "react";
import styles from "./Progress.module.css";

// Loading state for slow server tasks: names what is happening and how long it usually takes.
export function Progress({ title, stages, seconds }: { title: string; stages: string[]; seconds: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const active = Math.min(stages.length - 1, Math.floor(elapsed / Math.max(1, seconds / stages.length)));
  return <div className={styles.box} role="status" aria-live="polite">
    <div className={styles.head}><span className={styles.spinner} aria-hidden="true" /><strong>{title}</strong></div>
    <ol className={styles.list}>{stages.map((stage, index) => <li key={stage} className={index < active ? styles.done : index === active ? styles.active : ""}>
      <span aria-hidden="true">{index < active ? "✓" : index === active ? "…" : ""}</span>{stage}
    </li>)}</ol>
    <p className={styles.note}>{elapsed > seconds * 2 ? "Taking longer than usual. You can keep waiting; if it fails you can try again." : `Usually about ${seconds} seconds. Your transcript is saved.`}</p>
  </div>;
}
