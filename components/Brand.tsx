import styles from "./Brand.module.css";

/** medBot mark: a stethoscope tube drawn as a lowercase "m" on the primary colour. Colours follow the theme. */
export function Logo({ size = 32 }: { size?: number }) {
  return <svg className={styles.logo} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="10" fill="var(--accent)" />
    <path d="M8 23V15a4.2 4.2 0 0 1 8.4 0v8M16.4 15a4.2 4.2 0 0 1 8.4 0v8" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="24.8" cy="24.6" r="2.4" fill="var(--accent-ink)" />
  </svg>;
}

export type MascotMood = "hello" | "cheer" | "think" | "rest";
/**
 * Dr. Bot: a friendly round-headed bot with a stethoscope around its neck. Decorative by default; pass `label`
 * when it carries meaning. Motion is CSS only and is removed by the global prefers-reduced-motion rule.
 */
export function Mascot({ mood = "hello", size = 96, label, animate = false }: { mood?: MascotMood; size?: number; label?: string; animate?: boolean }) {
  const eyes = mood === "cheer"
    ? <><path d="M38 52q7-9 14 0M68 52q7-9 14 0" fill="none" stroke="var(--text)" strokeWidth="3.5" strokeLinecap="round" /></>
    : mood === "rest"
      ? <><path d="M38 52h14M68 52h14" fill="none" stroke="var(--text)" strokeWidth="3.5" strokeLinecap="round" /></>
      : <><circle cx="45" cy="52" r="5.5" fill="var(--text)" /><circle cx="75" cy="52" r="5.5" fill="var(--text)" />{mood === "think" && <path d="M66 41q9-5 16 0" fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />}</>;
  const mouth = mood === "cheer"
    ? <path d="M46 66q14 16 28 0z" fill="var(--text)" stroke="var(--text)" strokeWidth="3" strokeLinejoin="round" />
    : mood === "think" ? <path d="M50 70h20" fill="none" stroke="var(--text)" strokeWidth="3.5" strokeLinecap="round" />
      : mood === "rest" ? <path d="M52 69q8 5 16 0" fill="none" stroke="var(--text)" strokeWidth="3.5" strokeLinecap="round" />
        : <path d="M47 66q13 12 26 0" fill="none" stroke="var(--text)" strokeWidth="3.5" strokeLinecap="round" />;
  return <svg className={animate ? `${styles.mascot} ${mood === "cheer" ? styles.cheer : styles.bob}` : styles.mascot} width={size} height={size * 1.12} viewBox="0 0 120 134" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
    <path d="M60 24V12" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
    <circle cx="60" cy="10" r="6" fill="var(--accent)" />
    <rect x="12" y="46" width="9" height="22" rx="4" fill="var(--accent)" />
    <rect x="99" y="46" width="9" height="22" rx="4" fill="var(--accent)" />
    <rect x="20" y="24" width="80" height="68" rx="26" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="4" />
    <rect x="30" y="36" width="60" height="44" rx="16" fill="var(--surface)" />
    {eyes}
    {mouth}
    <path d="M32 94c-6 22 12 28 28 28s34-6 28-28" fill="none" stroke="var(--text)" strokeWidth="4" strokeLinecap="round" />
    <circle cx="60" cy="124" r="7" fill="var(--accent)" stroke="var(--text)" strokeWidth="3" />
    <circle cx="32" cy="94" r="3.5" fill="var(--text)" />
    <circle cx="88" cy="94" r="3.5" fill="var(--text)" />
    {mood === "cheer" && <g fill="var(--missed)"><path d="M104 20l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" /><path d="M14 22l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" /></g>}
  </svg>;
}
