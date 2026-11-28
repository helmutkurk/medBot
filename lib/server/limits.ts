// Codex, 2026-11-28. Bounded instance-local fixed windows; no addresses are persisted.
import { isApiPath } from "./hosted.ts";
export const routeLimits = {
  login: { limit: 5, windowMs: 600_000 },
  realtime: { limit: 6, windowMs: 600_000 },
  text: { limit: 60, windowMs: 600_000 },
  trace: { limit: 300, windowMs: 60_000 },
  feedback: { limit: 5, windowMs: 600_000 },
  read: { limit: 120, windowMs: 60_000 },
} as const;
export type RouteClass = keyof typeof routeLimits;
export function routeClass(pathname: string, method: string): RouteClass {
  if (pathname === "/access/login" || pathname === "/api/feedback/admin") return "login";
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return "read";
  if (pathname === "/api/session") return "realtime";
  if (pathname === "/api/trace") return "trace";
  if (pathname === "/api/feedback") return "feedback";
  // Future write routes (including hint/viva) get the text-call limits automatically.
  return "text";
}
export function costsMoney(pathname: string, method: string): boolean {
  return isApiPath(pathname) && !["GET", "HEAD", "OPTIONS"].includes(method)
    && !["/api/trace", "/api/memo", "/api/feedback", "/api/feedback/admin", "/api/leaderboard"].includes(pathname);
}

export class RateLimiter {
  private hits = new Map<string, { expires: number; count: number }>();
  check(key: string, kind: RouteClass, now = Date.now()): number {
    const policy = routeLimits[kind], id = `${kind}:${key}`;
    let slot = this.hits.get(id);
    if (!slot || now >= slot.expires) {
      if (this.hits.size >= 10_000) {
        for (const [id, entry] of this.hits) if (now >= entry.expires) this.hits.delete(id);
        if (this.hits.size >= 10_000) return policy.windowMs / 1000;
      }
      slot = { count: 0, expires: now + policy.windowMs };
      this.hits.set(id, slot);
    }
    if (slot.count >= policy.limit) return Math.max(1, Math.ceil((slot.expires - now) / 1000));
    slot.count++;
    return 0;
  }
}
export const requestLimiter = new RateLimiter();
export function clientAddress(request: Request): string {
  // Vercel supplies/overwrites this header. Other reverse proxies must sanitize forwarded headers.
  const header = process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "x-forwarded-for";
  return request.headers.get(header)?.split(",")[0]?.trim().slice(0, 64) || "unknown";
}
