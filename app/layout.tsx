import type { Metadata, Viewport } from "next";
import { MobileNav } from "../components/MobileNav.tsx";
import { PwaClient } from "../components/PwaClient.tsx";
import { themeBootScript } from "../components/ThemeToggle.tsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "medBot · Virtual interview patient",
  description: "Practice patient interviews with a synthetic patient. Built for hackaTUM 2026.",
  applicationName: "medBot",
  appleWebApp: { capable: true, title: "medBot", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1112" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head><body>{children}<footer className="demo-footer"><a href="/feedback">Send feedback</a><a href="/privacy">Privacy</a></footer><PwaClient /><MobileNav /></body></html>;
}
