import type { ReactNode } from "react";
import styles from "./Status.module.css";

export type StatusKind = "found" | "missed" | "flag" | "info";
const labels: Record<StatusKind, string> = { found: "Found", missed: "Missed", flag: "Red flag", info: "Note" };

/** Fixed learning meanings: green check = found, amber dash = missed, red flag icon = red flag, blue i = info. */
export function StatusIcon({ kind }: { kind: StatusKind }) {
  const paths: Record<StatusKind, ReactNode> = {
    found: <path d="M3.5 8.5l3 3 6-7" />,
    missed: <path d="M4 8h8" />,
    flag: <path d="M4.5 14V2.5M4.5 3h7l-1.5 3 1.5 3h-7" />,
    info: <path d="M8 7.2V12M8 4.2v.1" />,
  };
  return <svg className={styles.icon} viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
/** Chip: always icon + text, so colour is never the only signal. `children` replaces the default label. */
export function Status({ kind, children }: { kind: StatusKind; children?: ReactNode }) {
  return <span className={`${styles.chip} ${styles[kind]}`}><StatusIcon kind={kind} />{children ?? labels[kind]}</span>;
}
