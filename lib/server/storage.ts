// Codex, 2026-11-28. Hosted writes never target the read-only deployment bundle.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { hosted } from "./hosted.ts";

export const ephemeralStorage = () => hosted() || process.env.VERCEL === "1";
export function storageDirectory(): string {
  const configured = process.env.MEDBOT_STORAGE_DIR;
  if (!ephemeralStorage()) return path.resolve(/* turbopackIgnore: true */ configured || "data");
  const resolved = configured ? path.resolve(/* turbopackIgnore: true */ configured) : "/tmp/medbot";
  return resolved.startsWith("/tmp/") ? resolved : "/tmp/medbot";
}
export const traceDirectory = () => ephemeralStorage() ? path.join(storageDirectory(), "traces") : process.env.MEDBOT_TRACE_DIR || path.join(process.cwd(), "traces");
const fallback = new Map<string, unknown[]>();
const warned = new Set<string>();

export async function appendJsonLine(file: string, value: unknown): Promise<boolean> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify(value) + "\n", { mode: 0o600 });
    return true;
  } catch {
    const rows = fallback.get(file) ?? [];
    rows.push(value);
    fallback.set(file, rows.slice(-1000));
    if (!warned.has(file)) {
      warned.add(file);
      console.warn("medBot storage write failed; retaining recent entries in instance memory only.");
    }
    return false;
  }
}

export async function readJsonLines(file: string): Promise<unknown[]> {
  let text = "";
  try { text = await readFile(/* turbopackIgnore: true */ file, "utf8"); } catch { /* Missing/unavailable disk: use instance memory. */ }
  const rows: unknown[] = [];
  for (const line of text.split("\n").slice(0, -1)) {
    try { rows.push(JSON.parse(line)); } catch { /* Ignore incomplete/corrupt rows. */ }
  }
  return [...rows, ...(fallback.get(file) ?? [])];
}
