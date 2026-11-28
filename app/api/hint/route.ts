import type { FactCategory } from "../../../lib/case/types.ts";
import { hintCategories, interviewHint } from "../../../lib/engine/hint.ts";
import { engineOptions } from "../../../lib/server/env.ts";
import { body, history, HttpError, json, requestSignal, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    if (Object.keys(data).some(key => !["mode", "history", "coveredCategories"].includes(key)) || data.mode !== "practice") throw new HttpError(400, "invalid_request", "Hints are available in Practice only; send transcript and covered categories only.");
    const messages = history(data.history);
    if (!Array.isArray(data.coveredCategories) || data.coveredCategories.length > 8 || data.coveredCategories.some(c => !hintCategories.includes(c as FactCategory))) throw new HttpError(400, "invalid_request", "Invalid covered categories.");
    return json(await interviewHint(messages, data.coveredCategories as FactCategory[], engineOptions(requestSignal(request), "/api/hint")));
  });
}
