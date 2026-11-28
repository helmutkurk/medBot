import type { ReactNode } from "react";
import { Logo } from "./Brand.tsx";
import { GameChip } from "./GameChip.tsx";
import styles from "./SiteHeader.module.css";

export type NavKey = "interview" | "learning" | "leaderboard" | "evidence";
const links: { key: NavKey; href: string; label: string }[] = [
  { key: "interview", href: "/", label: "Interview" },
  { key: "learning", href: "/learning", label: "Your learning" },
  { key: "leaderboard", href: "/leaderboard", label: "Leaderboard" },
  { key: "evidence", href: "/eval", label: "Evidence" },
];

// One header for every page. /usage stays reachable by URL but is not part of the main navigation.
export function SiteHeader({ current, children }: { current?: NavKey; children?: ReactNode }) {
  return <header className={styles.header}><div className={styles.inner}>
    <a className={styles.wordmark} href="/" aria-label="medBot home"><Logo />medBot</a>
    <nav className={styles.nav} aria-label="Main">
      {links.map(link => <a key={link.key} href={link.href} aria-current={current === link.key ? "page" : undefined}>{link.label}</a>)}
    </nav>
    <GameChip />
    {children}
  </div></header>;
}
