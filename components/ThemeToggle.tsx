"use client";
import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "system" | "light" | "dark";
const key = "medbot.theme";
const order: Theme[] = ["system", "light", "dark"];
const labels: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };
const icons: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

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
    <span aria-hidden="true">{icons[theme]}</span>
  </button>;
}
