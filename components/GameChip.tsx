"use client";

import { useEffect, useState } from "react";
import { summarize } from "../lib/engine/gamification.ts";
import type { GameSummary } from "../lib/engine/gamification.ts";
import { gameChangedEvent, loadGame, loadProfile } from "./learner-storage.ts";
import styles from "./GameChip.module.css";

/** Header chip: level and streak, derived from this browser's profile. Renders nothing until it has read storage. */
export function GameChip() {
  const [summary, setSummary] = useState<GameSummary | null>(null);
  useEffect(() => {
    const refresh = () => { const now = new Date().toISOString(); const { profile } = loadProfile(); setSummary(summarize(profile, loadGame(profile, now).game, now)); };
    refresh();
    for (const name of ["storage", "focus", gameChangedEvent]) window.addEventListener(name, refresh);
    return () => { for (const name of ["storage", "focus", gameChangedEvent]) window.removeEventListener(name, refresh); };
  }, []);
  if (!summary) return null;
  const { streak, level } = summary;
  return <a className={styles.chip} href="/learning" aria-label={`Level ${level.level}, ${streak.current}-day streak${streak.todayDone ? ", today's goal done" : ", today's goal open"}. Open your learning.`}>
    <span className={styles.level}>Lv {level.level}</span>
    <span className={streak.todayDone ? styles.streakDone : styles.streak}>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M8 1.5c.5 2.3 3.8 3.9 3.8 7.2A3.8 3.8 0 0 1 8 12.5a3.8 3.8 0 0 1-3.8-3.8c0-1.4.6-2.2 1.3-3 .2 1 .7 1.5 1.3 1.7C6.6 5.2 7 3.3 8 1.5z" /></svg>
      {streak.current}<span className="sr-only"> day streak</span>
    </span>
  </a>;
}
