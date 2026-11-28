"use client";

import { useEffect, useRef, useState } from "react";
import { addReview, dailyReviewCards, reviewRatings, reviewXp, summarize, syncBadges } from "../lib/engine/gamification.ts";
import type { Badge, GameState, GameSummary, ReviewCard, ReviewRating } from "../lib/engine/gamification.ts";
import { emptyProfile } from "../lib/engine/learner.ts";
import type { LearnerProfile } from "../lib/engine/learner.ts";
import { Mascot } from "./Brand.tsx";
import { loadGame, loadProfile, persistGame } from "./learner-storage.ts";
import { syncLeaderboard } from "./leaderboard-client.ts";
import { SiteHeader } from "./SiteHeader.tsx";
import { Status } from "./Status.tsx";
import type { InterviewCase } from "./types.ts";
import styles from "./Game.module.css";

const ratingText: Record<ReviewRating, { label: string; hint: string }> = {
  again: { label: "Again", hint: "I could not recall it" },
  hard: { label: "Hard", hint: "I got there with effort" },
  good: { label: "Good", hint: "I recalled it" },
  easy: { label: "Easy", hint: "Immediately obvious" },
};

/** Three-card retrieval session: write the question from memory first, then compare with the case's own wording. */
export function ReviewSession({ cases }: { cases: InterviewCase[] }) {
  const [state, setState] = useState<{ profile: LearnerProfile; game: GameState; cards: ReviewCard[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState(false);
  const [earned, setEarned] = useState(0);
  const [unlocked, setUnlocked] = useState<Badge[]>([]);
  const [after, setAfter] = useState<GameSummary | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const now = new Date().toISOString();
    const { profile } = loadProfile();
    const { game } = loadGame(profile, now);
    setState({ profile, game, cards: dailyReviewCards(profile, game, cases, now) });
  }, [cases]);
  useEffect(() => { heading.current?.focus(); }, [index, state]);

  if (!state) return <><SiteHeader current="learning" /><main className={styles.page}><p role="status">Loading your review cards…</p></main></>;
  const card = state.cards[index];
  const finished = !card;
  function rate(rating: ReviewRating): void {
    if (!card || !state) return;
    const now = new Date().toISOString();
    let game = addReview(state.game, { at: now, caseId: card.caseId, factId: card.factId, rating });
    const synced = syncBadges(state.profile, game, now);
    game = synced.game;
    persistGame(game);
    void syncLeaderboard(state.profile, game, now);
    setEarned(value => value + reviewXp[rating]);
    setUnlocked(value => [...value, ...synced.unlocked]);
    setState({ ...state, game });
    setAnswer(""); setShown(false);
    setIndex(value => value + 1);
    if (index + 1 >= state.cards.length) setAfter(summarize(state.profile, game, now));
  }
  return <>
    <SiteHeader current="learning" />
    <main className={styles.page}>
      <div className={styles.intro}><h1>Daily red-flag review</h1><p>Retrieving a safety question from memory is what makes it stick. Write your attempt before you look.</p></div>
      {!state.cards.length && index === 0 ? <section className={styles.card}><div className={styles.center}><Mascot mood="rest" size={110} animate /><h2 ref={heading} tabIndex={-1}>Nothing due today</h2><p>Red flags you miss in an interview return after 1, 3 and 7 days. Finish an interview to build your review plan.</p><a className={styles.primary} href="/">Start an interview</a> <a href="/learning">Back to your learning</a></div></section>
        : finished ? <section className={styles.card} aria-live="polite"><div className={styles.center}><Mascot mood="cheer" size={120} animate /><h2 ref={heading} tabIndex={-1}>Review complete</h2><p><strong>+{earned} XP</strong> from {state.cards.length} cards.</p>
          {after && <p>{after.goal.met ? "Daily goal met." : `${after.goal.reviews}/3 cards today.`} Streak: {after.streak.current} {after.streak.current === 1 ? "day" : "days"}.</p>}
          {unlocked.map(b => <p key={b.id}><Status kind="found">Badge unlocked: {b.title}</Status></p>)}
          <a className={styles.primary} href="/learning">Back to your learning</a></div></section>
        : <section className={styles.card} aria-labelledby="card-title">
          <div className={styles.row}><span className={styles.eyebrow}>Card {index + 1} of {state.cards.length}</span><Status kind="flag" /></div>
          <h2 id="card-title" ref={heading} tabIndex={-1}>{card.prompt}</h2>
          <p className={styles.topic}><strong>{card.label}</strong> <span>· {card.caseTitle}</span></p>
          <label htmlFor="attempt">Your question, from memory</label>
          <textarea id="attempt" rows={3} maxLength={300} value={answer} onChange={e => setAnswer(e.target.value)} disabled={shown} placeholder="For example: “Have you had …?”" />
          {!shown ? <button type="button" className={styles.primary} onClick={() => setShown(true)}>Reveal model answer</button> : <>
            <div className={styles.reveal}>
              <p><Status kind="info">Model answer</Status></p>
              <p>The patient discloses this when you: <strong>{card.revealWhen}</strong></p>
              <p>Then they say: <q>{card.lay}</q></p>
              {answer.trim() && <p className={styles.mine}>Your attempt: {answer.trim()}</p>}
            </div>
            <fieldset className={styles.rate}><legend>How well did you recall it?</legend>
              {reviewRatings.map(r => <button key={r} type="button" onClick={() => rate(r)}><strong>{ratingText[r].label}</strong><span>{ratingText[r].hint}</span></button>)}
            </fieldset>
          </>}
        </section>}
    </main>
  </>;
}
