import { Leaderboard } from "../../components/Leaderboard.tsx";
import { SiteHeader } from "../../components/SiteHeader.tsx";
import { ephemeralStorage } from "../../lib/server/storage.ts";
import styles from "../hosted.module.css";

export const metadata = { title: "Leaderboard · medBot" };
export const dynamic = "force-dynamic";
export default function LeaderboardPage() {
  if (ephemeralStorage()) return <><SiteHeader current="leaderboard" /><main className={styles.page}>
    <h1>Leaderboard</h1><p>The shared leaderboard is unavailable on this hosted demo. Your learning progress stays in this browser.</p>
    <a href="/learning">View your learning</a>
  </main></>;
  return <Leaderboard />;
}
