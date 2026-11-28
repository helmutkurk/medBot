"use client";
import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "system" | "light" | "dark";
const key = "medbot.theme";
const order: Theme[] = ["system", "light", "dark"];
const labels: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };
const icons = {
  system: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" /></>,
  light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  dark: <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />,
};

/** Runs before hydration (inline in <head>) so the chosen theme applies without a flash. */
export const themeBootScript = `try{var t=localStorage.getItem("${key}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function apply(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { if (theme === "system") localStorage.removeItem(key); else localStorage.setItem(key, theme); } catch { /* storage unavailable: theme lasts for this page only */ }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") setTheme(current);
  }, []);
  const next = order[(order.indexOf(theme) + 1) % order.length]!;
  return <button type="button" className={styles.toggle} onClick={() => { apply(next); setTheme(next); }}
    aria-label={`${labels[theme]}. Switch to ${labels[next].toLowerCase()}`} title={`${labels[theme]} (click for ${labels[next].toLowerCase()})`}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[theme]}</svg>
  </button>;
}
