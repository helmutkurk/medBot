import { body, json, route } from "../../../lib/server/http.ts";
import { listFeedback, saveFeedback } from "../../../lib/server/feedback.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => json({ ok: true, ...await saveFeedback(await body(request, 10_000)) }, 201));
}
export function GET(request: Request) {
  return route(async () => json({ entries: await listFeedback(request) }));
}
