import { HttpError, json, route } from "../../../lib/server/http.ts";
import { loadUsage } from "../../../lib/server/usage.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(async () => {
    const source = new URL(request.url).searchParams.get("source");
    if (source !== null && source !== "app" && source !== "eval") throw new HttpError(400, "invalid_source", "source must be app or eval.");
    return json(await loadUsage(source ?? undefined));
  });
}
