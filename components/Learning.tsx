"use client";

import { useEffect, useState } from "react";
import { communicationSkills } from "../lib/case/types.ts";
import { adaptationsActive, domainLabels, domains, emptyProfile, recommendNext, weakestDomains } from "../lib/engine/learner.ts";
import type { Domain, LearnerProfile } from "../lib/engine/learner.ts";
import { loadGame, loadProfile, resetGame, resetProfile } from "./learner-storage.ts";
import { effectiveQueue, emptyGame, dailyReviewCards, summarize } from "../lib/engine/gamification.ts";
import type { GameState } from "../lib/engine/gamification.ts";
import { ProgressCard } from "./Rewards.tsx";
import { Status } from "./Status.tsx";
import { CaseCreator } from "./CaseCreator.tsx";
import { downloadJson } from "./download.ts";
import type { InterviewCase } from "./types.ts";
import { SiteHeader } from "./SiteHeader.tsx";
import styles from "./Learning.module.css";

export function Learning({ cases: initialCases, ready }: { cases: InterviewCase[]; ready: boolean }) {
  const [profile, setProfile] = useState<LearnerProfile>(emptyProfile);
  const [game, setGame] = useState<GameState>(emptyGame);
  const [cases, setCases] = useState(initialCases);
  const [loaded, setLoaded] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState("");
  useEffect(() => {
    const refresh = () => { const state = loadProfile(); setProfile(state.profile); setGame(loadGame(state.profile).game); setPersistent(state.persistent); setLoaded(true); setNow(new Date().toISOString()); };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  const recommendation = recommendNext(profile, cases, now || undefined);
  const next = cases.find(c => c.id === recommendation?.caseId);
  const focus = weakestDomains(profile).slice(0, 3).map(d => domainLabels[d]);
  const calibration = profile.calibration;
  const queue = effectiveQueue(profile, game);
  function bar(domain: Domain) {
    const mastery = profile.domainMastery[domain];
    return <li key={domain}><div><label htmlFor={`mastery-${domain}`}>{domainLabels[domain]}</label><span>{mastery.count ? `${Math.round(mastery.value * 100)}% · ${mastery.count} interviews` : "Not measured yet"}</span></div><progress id={`mastery-${domain}`} max={1} value={mastery.value} /></li>;
  }
  return <>
    <SiteHeader current="learning" />
    <main className={styles.main}>
      <div className={styles.intro}><h1>Your learning</h1><p>Retrieve, reflect, practise one improvement, then return to it.</p></div>
      {!loaded ? <p role="status">Loading learning progress from this browser…</p> : <>
        <section className={styles.card}><h2>Practice that builds on your last interview</h2><p>{profile.sessions.length} reflected interviews · {calibration.count} with feedback</p>{!profile.sessions.length && <p><strong>No interviews yet.</strong> Complete one interview with a reflection and this page starts adapting to you. <a href="/">Start your first interview</a></p>}<p>Progress and reflections are stored only in this browser. No learner name is collected. Export downloads a local JSON file.</p>{!persistent && <p role="status">Browser storage is unavailable or contains unsupported data. Progress is held in memory while this page is open. Export before leaving.</p>}<div className={styles.actions}><button type="button" onClick={() => downloadJson(profile, "medbot-learning.json")}>Export learning JSON</button><button type="button" onClick={() => { setPersistent(resetProfile() && resetGame()); setProfile(emptyProfile()); setGame(emptyGame()); }}>Reset learning progress</button></div></section>
        {now && <ProgressCard summary={summarize(profile, game, now)} dueCount={dailyReviewCards(profile, game, cases, now, 99).length} />}
        <div className={styles.grid}>
          <section className={styles.card}><h2>Next patient</h2>{recommendation && next ? <><h3>{next.title}</h3><p>{next.personalities.find(p => p.id === recommendation.personalityId)?.label} · {recommendation.difficulty} practice</p><ul>{recommendation.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><h3>Session goals</h3><ul>{recommendation.goals.map(goal => <li key={goal}>{goal}</li>)}</ul><a className={styles.primary} href={`/?case=${encodeURIComponent(next.id)}&personality=${encodeURIComponent(recommendation.personalityId)}`}>Start recommended patient</a></> : <p>No cases available. Create a synthetic patient to start.</p>}
            <button className={styles.create} type="button" disabled={!ready} onClick={() => setCreating(true)}>Create a patient for my weak spots</button><p>Focus: {focus.join(", ")}. {ready ? "Choose a diagnosis; only these domain labels are sent as learning focus." : "Connect OpenAI on the interview page to create a patient."}</p>
          </section>
          <section className={styles.card}><h2>Confidence calibration</h2>{calibration.count ? <><p><strong>{Math.round(calibration.meanAbsoluteError * 100)} percentage points</strong> average gap between confidence and performance.</p><p>Signed gap: {calibration.meanBias > 0 ? "+" : ""}{Math.round(calibration.meanBias * 100)} points ({Math.abs(calibration.meanBias) < .1 ? "roughly aligned" : calibration.meanBias > 0 ? "confidence exceeds measured performance" : "performance exceeds confidence"}).</p><p>{calibration.highConfidenceMisses} interviews with confidence 4–5 and a missed red flag.</p></> : <p>Reflect before your first coach report to start comparing confidence with performance.</p>}<p className={styles.muted}>Confidence 1–5 maps to 0–100%. Performance averages coach coverage and the proportion of red flags found (coverage alone when no red flags exist). This measures self-assessment against coverage, not diagnostic accuracy.</p>{profile.sessions.at(-1) && <p>Last reflection: “{profile.sessions.at(-1)!.reflection.concern}” · {profile.sessions.at(-1)!.reflection.confidence}/5</p>}</section>
          <section className={styles.card}><h2>History-taking mastery</h2><p className={styles.muted}>Recent performance carries more weight (35% per interview). Unmeasured domains are starting points, not demonstrated weaknesses.</p><ul className={styles.bars}>{domains.filter(d => !communicationSkills.some(skill => skill === d)).map(bar)}</ul></section>
          <section className={styles.card}><h2>Communication skills</h2><p className={styles.muted}>Calgary-Cambridge ratings, supported by student transcript quotes in your coach report. ICE also appears in history-taking mastery.</p><ul className={styles.bars}>{communicationSkills.map(bar)}</ul></section>
          <section className={styles.card}><h2>Spaced safety review</h2>{queue.length ? <ul className={styles.queue}>{queue.map(item => <li key={`${item.caseId}/${item.factId}`}><strong>{item.label} <Status kind="flag" /></strong><span>{cases.find(c => c.id === item.caseId)?.title ?? item.caseId}</span><span>{item.due <= now ? <Status kind="missed">Due now</Status> : <Status kind="info">Next review</Status>} · <time dateTime={item.due}>{item.due.slice(0, 10)} UTC</time> · step {item.stage + 1}/3</span></li>)}</ul> : <p>No missed red flags queued. Complete an interview to build your review plan.</p>}<p className={styles.muted}>A miss schedules a one-day review. Finding it when due schedules three days, then seven; the next successful due review completes it. Early practice does not advance spacing.</p></section>
          <section className={styles.card}><h2>How the agents adapt to you</h2><ul>{adaptationsActive(profile).map(item => <li key={item}>{item}</li>)}</ul><p className={styles.muted}>Practise from memory with the instructor checklist hidden. After reflection, choose one specific coach tip to apply in your next conversation.</p></section>
        </div>
      </>}
      {creating && <CaseCreator focus={focus} onClose={() => setCreating(false)} onCreated={c => { setCases(old => [...old.filter(item => item.id !== c.id), c]); setCreating(false); window.location.assign(`/?case=${encodeURIComponent(c.id)}&personality=${encodeURIComponent(recommendNext(profile, [c], now || undefined)?.personalityId ?? "")}`); }} />}
    </main>
  </>;
}
