"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { levelInfo, totalXp, weeklyXp } from "../lib/engine/gamification.ts";
import type { GameState } from "../lib/engine/gamification.ts";
import { checkNickname, nicknameHint } from "../lib/engine/nickname.ts";
import type { LearnerProfile } from "../lib/engine/learner.ts";
import { Mascot } from "./Brand.tsx";
import { leaveLeaderboard, syncLeaderboard } from "./leaderboard-client.ts";
import { loadGame, loadProfile, persistGame } from "./learner-storage.ts";
import { SiteHeader } from "./SiteHeader.tsx";
import styles from "./Game.module.css";

interface Board { week: string; total: number; entries: { rank: number; nickname: string; xp: number; level: number }[]; me: { rank: number; xp: number; level: number } | null }

export function Leaderboard() {
  const [local, setLocal] = useState<{ profile: LearnerProfile; game: GameState } | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [problem, setProblem] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (nick: string | null) => {
    try {
      const response = await fetch(`/api/leaderboard${nick ? `?nickname=${encodeURIComponent(nick)}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error("bad status");
      setBoard(await response.json() as Board);
      setProblem("");
    } catch { setProblem("The leaderboard could not be loaded. Try again in a moment."); }
  }, []);
  useEffect(() => {
    const { profile } = loadProfile();
    const { game } = loadGame(profile);
    setLocal({ profile, game });
    void load(game.nickname);
  }, [load]);
  if (!local) return <><SiteHeader current="leaderboard" /><main className={styles.page}><p role="status">Loading…</p></main></>;
  const { profile, game } = local;
  const now = new Date().toISOString();
  const myWeek = weeklyXp(profile, game, now);
  const myLevel = levelInfo(totalXp(profile, game)).level;

  async function join(event: FormEvent): Promise<void> {
    event.preventDefault();
    const checked = checkNickname(nickname);
    if (!checked.ok) { setProblem(checked.reason); return; }
    setBusy(true);
    const next = { ...game, nickname: checked.nickname };
    persistGame(next);
    setLocal({ profile, game: next });
    const ok = await syncLeaderboard(profile, next, now);
    if (!ok) setProblem("Could not join. The nickname may be invalid or you may be sending too fast; try again in a minute.");
    await load(checked.nickname);
    setBusy(false);
  }
  async function leave(): Promise<void> {
    if (!game.nickname) return;
    setBusy(true);
    const ok = await leaveLeaderboard(game.nickname);
    if (ok) { const next = { ...game, nickname: null }; persistGame(next); setLocal({ profile, game: next }); setNickname(""); await load(null); }
    else setProblem("Could not remove your entry. Your nickname is kept so you can try again.");
    setBusy(false);
  }
  return <>
    <SiteHeader current="leaderboard" />
    <main className={styles.page}>
      <div className={styles.intro}><h1>Weekly leaderboard</h1><p>Opt-in and anonymous. Ranks use XP earned since Monday (UTC), from interviews and review cards.</p></div>
      <div className={styles.twoCol}>
        <section className={styles.card} aria-labelledby="board-title">
          <h2 id="board-title">Top 20 this week</h2>
          {problem && <p role="alert" className={styles.problem}>{problem}</p>}
          {board && board.entries.length > 0 ? <ol className={styles.board}>
            {board.entries.map(e => <li key={e.rank} className={game.nickname && e.nickname.toLowerCase() === game.nickname.toLowerCase() ? styles.me : undefined}><span className={styles.rank}>{e.rank}</span><strong>{e.nickname}</strong><span>Lv {e.level}</span><span className={styles.xp}>{e.xp} XP</span></li>)}
          </ol> : board ? <div className={styles.center}><Mascot mood="hello" size={96} animate /><p>No one has joined this week yet. Be the first.</p></div> : <p role="status">Loading…</p>}
          {board?.me && board.me.rank > 20 && <p className={styles.mine}>Your rank: {board.me.rank} of {board.total} · {board.me.xp} XP</p>}
        </section>
        <section className={styles.card} aria-labelledby="join-title">
          <h2 id="join-title">{game.nickname ? "You are on the board" : "Join the leaderboard"}</h2>
          {game.nickname ? <>
            <p>Nickname: <strong>{game.nickname}</strong>{board?.me ? <> · Rank {board.me.rank} of {board.total}</> : null}</p>
            <p>This week: {myWeek} XP · Level {myLevel}. Your XP is sent after each interview and review.</p>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => void leave()}>Leave and delete my entry</button>
          </> : <form onSubmit={e => void join(e)}>
            <p>Only your nickname, this week&rsquo;s XP and your level are sent. Nothing else leaves your browser.</p>
            <label htmlFor="nick">Nickname</label>
            <input id="nick" value={nickname} onChange={e => setNickname(e.target.value)} minLength={3} maxLength={20} autoComplete="off" aria-describedby="nick-hint" required />
            <p id="nick-hint" className={styles.hint}>{nicknameHint}</p>
            <button type="submit" className={styles.primary} disabled={busy}>Join with {myWeek} XP</button>
          </form>}
          <p className={styles.hint}>XP is reported by your browser and is not verified, so treat the board as friendly motivation.</p>
        </section>
      </div>
    </main>
  </>;
}
