// Codex, 2026-11-28. Shared by Proxy and the server request boundary.
export const ACCESS_COOKIE = "medbot_access";
export const ADMIN_COOKIE = "medbot_admin";
export const ACCESS_SECONDS = 12 * 60 * 60;
export const ADMIN_SECONDS = 60 * 60;
export const hosted = () => process.env.MEDBOT_HOSTED === "1";
export const isApiPath = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

export function accessConfigured(): boolean {
  return (process.env.MEDBOT_ACCESS_CODE?.length ?? 0) >= 12
    && (process.env.MEDBOT_COOKIE_SECRET?.length ?? 0) >= 32;
}

export async function matchesCode(input: string, expected: string | undefined): Promise<boolean> {
  if (!expected || input.length > 512) return false;
  const digest = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(input), digest(expected)]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i]! ^ right[i]!;
  return different === 0;
}

async function key(purpose: "access" | "admin"): Promise<CryptoKey> {
  if (!accessConfigured()) throw new Error("Hosted access is not configured.");
  const code = purpose === "admin" ? process.env.MEDBOT_ADMIN_CODE : process.env.MEDBOT_ACCESS_CODE;
  if (!code || (purpose === "admin" && code.length < 12)) throw new Error("Admin access is not configured.");
  // Including the passcode invalidates existing cookies when that passcode changes.
  return crypto.subtle.importKey("raw", new TextEncoder().encode(JSON.stringify([
    process.env.MEDBOT_COOKIE_SECRET, purpose, code,
  ])), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signCookie(purpose: "access" | "admin", now = Date.now()): Promise<string> {
  const ttl = purpose === "access" ? ACCESS_SECONDS : ADMIN_SECONDS;
  const payload = `v1.${Math.floor(now / 1000) + ttl}.${crypto.randomUUID()}`;
  const signature = await crypto.subtle.sign("HMAC", await key(purpose), new TextEncoder().encode(payload));
  return `${payload}.${Array.from(new Uint8Array(signature), n => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Returns the signed random client ID, never a client-supplied unsigned identifier. */
export async function verifyCookie(value: string | undefined, purpose: "access" | "admin", now = Date.now()): Promise<string | null> {
  if (!value || value.length > 256) return null;
  const match = /^v1\.(\d{10})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return null;
  const seconds = Math.floor(now / 1000), expires = Number(match[1]);
  const ttl = purpose === "access" ? ACCESS_SECONDS : ADMIN_SECONDS;
  if (expires <= seconds || expires > seconds + ttl) return null;
  try {
    const signature = Uint8Array.from(match[3]!.match(/../g)!, hex => parseInt(hex, 16));
    const valid = await crypto.subtle.verify("HMAC", await key(purpose), signature, new TextEncoder().encode(value.slice(0, value.lastIndexOf("."))));
    return valid ? match[2]! : null;
  } catch { return null; }
}

export function requestCookie(request: Request, name: string): string | undefined {
  return request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function cookieHeader(request: Request, name: string, value: string, seconds: number): string {
  const secure = hosted() || new URL(request.url).protocol === "https:";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure ? "; Secure" : ""}`;
}

export function publicPath(pathname: string): boolean {
  // Explicit static paths: a dot in an arbitrary page/API path must never bypass the gate.
  return pathname === "/access" || pathname === "/access/login"
    || pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/")
    || ["/icon.svg", "/favicon.ico", "/manifest.webmanifest", "/sw.js", "/offline.html"].includes(pathname);
}

export async function gateDecision(request: Request): Promise<"allow" | "setup" | "login" | "unauthorized"> {
  if (!hosted() || publicPath(new URL(request.url).pathname)) return "allow";
  if (!accessConfigured()) return "setup";
  if (await verifyCookie(requestCookie(request, ACCESS_COOKIE), "access")) return "allow";
  return isApiPath(new URL(request.url).pathname) ? "unauthorized" : "login";
}
