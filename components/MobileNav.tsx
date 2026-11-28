"use client";

import { usePathname } from "next/navigation";
import styles from "./MobileNav.module.css";

const links = [
  { href: "/", label: "Interview", path: "M6 3v6a6 6 0 0 0 12 0V3M12 15v2a4 4 0 0 0 8 0v-2M4 3h4M16 3h4" },
  { href: "/learning/review", label: "Review", path: "M4 7h12v14H4zM8 3h12v14M8 12h4M8 16h4" },
  { href: "/learning", label: "Learning", path: "m3 8 9-5 9 5-9 5zM6 10v7c4 3 8 3 12 0v-7M21 8v9" },
  { href: "/eval", label: "Evidence", path: "M5 3h14v18H5zM8 8h8M8 12h8M8 16h4" },
];

export function MobileNav() {
  const pathname = usePathname();
  return <nav className={styles.nav} aria-label="Mobile navigation">
    {links.map(link => <a key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={link.path} /></svg>
      <span>{link.label}</span>
    </a>)}
  </nav>;
}
