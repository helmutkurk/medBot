"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { dailyGoalFor, dayKey } from "../lib/engine/gamification.ts";
import { gameChangedEvent, loadGame, loadProfile } from "./learner-storage.ts";
import { decodeReminder, defaultReminder, reminderDue, reminderStorageKey } from "./pwa-reminder.ts";
import type { ReminderSettings } from "./pwa-reminder.ts";
import styles from "./PwaClient.module.css";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaClient() {
  const pathname = usePathname();
  const registration = useRef<Promise<ServiceWorkerRegistration | null>>(Promise.resolve(null));
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>(defaultReminder);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(standalone.matches || ("standalone" in navigator && navigator.standalone === true));
    const beforeInstall = (event: Event) => {
      if (!("prompt" in event) || typeof event.prompt !== "function" || !("userChoice" in event)) return;
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    updateInstalled();
    standalone.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (process.env.NODE_ENV === "production" && window.isSecureContext && "serviceWorker" in navigator) {
      registration.current = navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => { setMessage("Offline setup is unavailable. Reconnect and reload to try again."); return null; });
      setSupported("Notification" in window && "ServiceWorkerRegistration" in window && "showNotification" in ServiceWorkerRegistration.prototype);
    }
    return () => {
      standalone.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    let checking = false;
    let disposed = false;
    async function deliver() {
      try {
        const saved = decodeReminder(window.localStorage.getItem(reminderStorageKey));
        if (disposed) return;
        setSettings(saved);
        if (!("Notification" in window) || Notification.permission !== "granted") {
          if (saved.enabled) setMessage("Reminders are paused. Allow notifications in your browser settings, or turn reminders off.");
          return;
        }
        const now = new Date();
        const { profile } = loadProfile();
        const { game } = loadGame(profile, now.toISOString());
        if (!reminderDue(saved, now, dailyGoalFor(profile, game, now.toISOString()).met)) return;
        const worker = await registration.current;
        if (disposed || !worker?.active) return;
        // Read again after the async boundary so turning reminders off always wins.
        const latest = decodeReminder(window.localStorage.getItem(reminderStorageKey));
        const currentProfile = loadProfile().profile;
        const currentGame = loadGame(currentProfile, now.toISOString()).game;
        if (!reminderDue(latest, now, dailyGoalFor(currentProfile, currentGame, now.toISOString()).met)) return;
        const claimed = { ...latest, lastNotified: dayKey(now.toISOString()) };
        window.localStorage.setItem(reminderStorageKey, JSON.stringify(claimed));
        try {
          await worker.showNotification("Time for your daily practice", {
            body: "Complete one interview or three reviews to keep your medBot streak going.",
            icon: "/icons/icon-192.png",
            tag: "medbot-daily-practice",
          });
          if (!disposed) setSettings(claimed);
        } catch {
          window.localStorage.setItem(reminderStorageKey, JSON.stringify(latest));
          if (!disposed) setMessage("The browser could not show a reminder. Check notification settings.");
        }
      } catch {
        if (!disposed) setMessage("Local storage is unavailable. Reminders need browser storage to stay opted in.");
      }
    }
    async function check() {
      if (checking) return;
      checking = true;
      try {
        if (navigator.locks) {
          await navigator.locks.request("medbot-daily-reminder", { ifAvailable: true }, async lock => { if (lock) await deliver(); });
        } else await deliver();
      } catch { if (!disposed) setMessage("The browser could not schedule a reminder. Try reloading medBot."); }
      finally { checking = false; }
    }
    void check();
    const timer = window.setInterval(() => { void check(); }, 30_000);
    const refresh = () => { void check(); };
    for (const event of ["focus", "storage", gameChangedEvent, "medbot:reminder-changed"]) window.addEventListener(event, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      for (const event of ["focus", "storage", gameChangedEvent, "medbot:reminder-changed"]) window.removeEventListener(event, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  function save(next: ReminderSettings) {
    try {
      window.localStorage.setItem(reminderStorageKey, JSON.stringify(next));
      setSettings(next);
      window.dispatchEvent(new Event("medbot:reminder-changed"));
      return true;
    } catch { setMessage("Your preference could not be saved. Reminders remain off until storage is available."); return false; }
  }

  async function toggleReminder() {
    setMessage("");
    if (settings.enabled) { save({ ...settings, enabled: false }); return; }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setMessage("Reminders are off. You can allow notifications in your browser settings."); return; }
      const worker = await registration.current;
      if (!worker) { setMessage("Reminders are off. Reconnect and reload to finish offline setup."); return; }
      // Preserve today's delivery marker across off/on toggles and time changes.
      const saved = decodeReminder(window.localStorage.getItem(reminderStorageKey));
      save({ ...saved, time: settings.time, enabled: true });
    } catch { setMessage("Reminders could not be enabled. Check your browser's notification settings."); }
    finally { setBusy(false); }
  }

  async function install() {
    if (!installPrompt) return;
    setBusy(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "Installation requested. Follow your browser's instructions." : "Installation dismissed. You can install later from your browser menu.");
    } catch { setMessage("Use your browser menu to install medBot or add it to your home screen."); }
    finally { setInstallPrompt(null); setBusy(false); }
  }

  if (pathname !== "/learning") return null;
  return <section className={styles.panel} aria-labelledby="mobile-practice-title">
    <h2 id="mobile-practice-title">Make room for daily practice</h2>
    <p>{installed ? "medBot is running as an installed app." : "Keep medBot on your home screen. You can also use your browser menu → Install app or Add to Home Screen."} Voice, text interviews and feedback need an internet connection.</p>
    {installPrompt && !installed && <button type="button" className={styles.install} disabled={busy} onClick={() => { void install(); }}>Install medBot</button>}
    <div className={styles.reminder}>
      <h3>Daily streak reminder</h3>
      <p id="reminder-help">Optional, on this device only. Remind me if my daily goal is still open at the chosen local time, while medBot is open or when I next open it after that time. No reminders arrive while the app is closed.</p>
      {supported ? <div className={styles.actions}>
        <label htmlFor="reminder-time">Local time<input id="reminder-time" type="time" value={settings.time} aria-describedby="reminder-help" onChange={event => { if (event.target.validity.valid && event.target.value) save({ ...settings, time: event.target.value }); }} /></label>
        <button type="button" aria-pressed={settings.enabled} disabled={busy} onClick={() => { void toggleReminder(); }}>{settings.enabled ? "Turn reminders off" : "Enable daily reminder"}</button>
      </div> : <p>Reminders need a supported browser and an HTTPS production app (or localhost). On iPhone, first add medBot to your home screen.</p>}
      <p role="status">{message || (settings.enabled ? `Reminders on · ${settings.time} local time · at most once a day.` : "Reminders are off.")}</p>
    </div>
  </section>;
}
