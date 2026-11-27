import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "medBot · Virtual interview patient",
  description: "Practice patient interviews with a synthetic patient. Built for hackaTUM 2026.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
