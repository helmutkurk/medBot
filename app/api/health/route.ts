import { getModels, hasOpenAIKey } from "../../../lib/server/env.ts";
import { json, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return route(async () => json({ ready: hasOpenAIKey(), models: getModels() }));
}
