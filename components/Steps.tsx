import styles from "./Steps.module.css";

export const flowSteps = ["Choose patient", "Interview", "Reflect", "Feedback"] as const;

// Shows where the student is in the single guided flow. `current` is the zero-based active step.
export function Steps({ current }: { current: number }) {
  return <ol className={styles.steps} aria-label="Progress">
    {flowSteps.map((label, index) => <li key={label} className={index < current ? styles.done : index === current ? styles.current : ""} aria-current={index === current ? "step" : undefined}>
      <span className={styles.mark} aria-hidden="true">{index < current ? "✓" : index + 1}</span>
      <span className={styles.label}>{label}<span className="sr-only">{index < current ? " (done)" : index === current ? " (current step)" : ""}</span></span>
    </li>)}
  </ol>;
}
