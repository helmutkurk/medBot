import { badges as allBadges, dailyGoal } from "../lib/engine/gamification.ts";
import type { Badge, GameSummary, Reward } from "../lib/engine/gamification.ts";
import { Mascot } from "./Brand.tsx";
import { Status } from "./Status.tsx";
import styles from "./Game.module.css";

const iconPaths: Record<Badge["icon"], string> = {
  stethoscope: "M7 4v6a5 5 0 0 0 10 0V4M12 15v2a4 4 0 0 0 8 0v-1",
  flag: "M6 21V4M6 5h11l-2 4 2 4H6",
  speech: "M4 5h16v11H9l-5 4z",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M18 20a5 5 0 0 0-2-4",
  flame: "M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-2 1-3.5 2-5 .5 1.5 1.5 2 2.5 2C11 8 11.500 5.500 12 3z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12v.01",
  cards: "M5 7h11v13H5zM9 4h11v13",
};
export function BadgeIcon({ badge, locked = false }: { badge: Badge; locked?: boolean }) {
  return <svg className={locked ? styles.badgeLocked : styles.badgeIcon} viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={iconPaths[badge.icon]} /></svg>;
}

/** End of feedback: what this interview earned. Text carries every fact; the mascot only adds warmth. */
export function RewardPanel({ reward }: { reward: Reward }) {
  const { xp } = reward;
  const leveledUp = reward.levelAfter > reward.levelBefore;
  const streakUp = reward.streakAfter > reward.streakBefore;
  const celebrate = leveledUp || streakUp || reward.newBadges.length > 0;
  return <section className={styles.reward} aria-labelledby="reward-title" role="status">
    <Mascot mood={celebrate ? "cheer" : "hello"} size={84} animate={celebrate} />
    <div>
      <h3 id="reward-title">+{xp.total} XP</h3>
      <ul className={styles.xpList}>
        <li>Interview completed <span>+{xp.base}</span></li>
        {xp.coverage > 0 && <li>History coverage <span>+{xp.coverage}</span></li>}
        {xp.redFlags > 0 && <li>Red flags found <span>+{xp.redFlags}</span></li>}
        {xp.communication > 0 && <li>Communication skills <span>+{xp.communication}</span></li>}
        {xp.calibration > 0 && <li>Confidence matched performance <span>+{xp.calibration}</span></li>}
      </ul>
      {leveledUp && <p><Status kind="found">Level up</Status> You reached level {reward.levelAfter}.</p>}
      <p>{reward.streakAfter > 0 ? <>Streak: <strong>{reward.streakAfter} {reward.streakAfter === 1 ? "day" : "days"}</strong>{streakUp ? " (extended today)" : ""}.</> : "Streak: start one by meeting the daily goal."}{reward.goalJustMet ? " Daily goal met." : ""}</p>
      {reward.newBadges.map(b => <p key={b.id} className={styles.badgeLine}><BadgeIcon badge={b} /><span><Status kind="found">Badge unlocked</Status> <strong>{b.title}</strong>. {b.description}</span></p>)}
    </div>
  </section>;
}

/** Learning page: level, daily goal, streak and badges. */
export function ProgressCard({ summary, dueCount }: { summary: GameSummary; dueCount: number }) {
  const { level, goal, streak } = summary;
  return <section className={styles.cardFull} aria-labelledby="progress-title">
    <div className={styles.progressHead}>
      <Mascot mood={goal.met ? "cheer" : "hello"} size={72} />
      <div>
        <h2 id="progress-title">Level {level.level}</h2>
        <progress max={1} value={level.progress} aria-label={`Level progress: ${level.xp} XP${level.ceiling ? ` of ${level.ceiling} for level ${level.level + 1}` : ""}`} />
        <p className={styles.hint}>{level.xp} XP{level.ceiling ? ` · ${level.ceiling - level.xp} to level ${level.level + 1}` : " · top level"} · {summary.weeklyXp} XP this week</p>
      </div>
    </div>
    <div className={styles.stats}>
      <div><strong>{goal.met ? <Status kind="found">Done</Status> : <Status kind="missed">Open</Status>}</strong><span>Today&rsquo;s goal: {dailyGoal.interviews} interview or {dailyGoal.reviews} review cards ({goal.interviews} interviews, {goal.reviews} cards so far)</span></div>
      <div><strong>{streak.current} {streak.current === 1 ? "day" : "days"}</strong><span>Streak · best {streak.longest} · weekly freeze {streak.freezeAvailable ? "available" : "used"}</span></div>
      <div><strong>{dueCount}</strong><span>red-flag cards due</span></div>
    </div>
    <p><a className={styles.primary} href="/learning/review">{dueCount ? "Start daily review" : "Open daily review"}</a> <a href="/leaderboard">Weekly leaderboard</a></p>
    <h3>Badges</h3>
    <ul className={styles.badges}>{allBadges.map(b => {
      const earned = summary.badgeIds.includes(b.id);
      return <li key={b.id} className={earned ? styles.earned : styles.locked}><BadgeIcon badge={b} locked={!earned} /><div><strong>{b.title}</strong><span>{b.description}</span><span>{earned ? <Status kind="found">Earned</Status> : <Status kind="info">Locked</Status>}</span></div></li>;
    })}</ul>
  </section>;
}
