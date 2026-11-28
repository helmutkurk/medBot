import { body, json, route } from "../../../lib/server/http.ts";
import { board, checkRate, clientKey, remove, submit, validateRemoval, validateSubmission } from "../../../lib/server/leaderboard.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return route(async () => json(await board(new URL(request.url).searchParams.get("nickname")?.slice(0, 40) || undefined)));
}
export function POST(request: Request) {
  return route(async () => {
    checkRate(clientKey(request));
    return json(await submit(validateSubmission(await body(request, 1_000))));
  });
}
export function DELETE(request: Request) {
  return route(async () => {
    checkRate(clientKey(request));
    await remove(validateRemoval(await body(request, 1_000)));
    return json({ ok: true });
  });
}
