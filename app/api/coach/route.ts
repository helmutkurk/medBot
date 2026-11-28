import { coachReport } from "../../../lib/engine/index.ts";
import { engineOptions } from "../../../lib/server/env.ts";
import { body, caseFrom, history, ids, json, requestSignal, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const messages = history(data.history);
    const revealed = ids(data.revealed, "revealed");
    const c = await caseFrom(data.caseId);
    return json(await coachReport(c, messages, revealed, engineOptions(requestSignal(request), "/api/coach")));
  });
}
