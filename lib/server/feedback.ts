import path from "node:path";
import { HttpError } from "./http.ts";
import { ADMIN_COOKIE, hosted, requestCookie, verifyCookie } from "./hosted.ts";
import { appendJsonLine, readJsonLines, storageDirectory } from "./storage.ts";

export interface Feedback { id: string; ts: string; rating: number; text: string }
const feedbackFile = () => path.join(storageDirectory(), "feedback.jsonl");

export async function saveFeedback(data: Record<string, unknown>): Promise<{ stored: boolean }> {
  if (Object.keys(data).some(key => key !== "rating" && key !== "text")
    || typeof data.rating !== "number" || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5
    || (data.text !== undefined && (typeof data.text !== "string" || data.text.length > 2000))) {
    throw new HttpError(400, "invalid_feedback", "Choose a rating from 1 to 5 and at most 2,000 characters of optional feedback.");
  }
  const entry: Feedback = { id: crypto.randomUUID(), ts: new Date().toISOString(), rating: data.rating, text: typeof data.text === "string" ? data.text.trim() : "" };
  // Intentionally no IP, cookie, nickname, transcript or case details.
  if (hosted()) console.info("medbot_feedback", JSON.stringify(entry));
  return { stored: await appendJsonLine(feedbackFile(), entry) };
}

export async function listFeedback(request: Request): Promise<Feedback[]> {
  if (!await verifyCookie(requestCookie(request, ADMIN_COOKIE), "admin")) throw new HttpError(403, "admin_required", "Enter the admin code to view feedback.");
  const values = await readJsonLines(feedbackFile());
  return values.filter((row): row is Feedback => row !== null && typeof row === "object"
    && "id" in row && typeof row.id === "string" && "ts" in row && typeof row.ts === "string"
    && "rating" in row && typeof row.rating === "number" && "text" in row && typeof row.text === "string").slice(-200).reverse();
}
