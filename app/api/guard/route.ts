import { guardTurn } from "../../../lib/engine/index.ts";
import { engineOptions } from "../../../lib/server/env.ts";
import { body, caseFrom, history, json, requestSignal, route, string } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const messages = history(data.history);
    const reply = string(data.reply, "reply");
    const c = await caseFrom(data.caseId);
    return json(await guardTurn(c, messages, reply, engineOptions(requestSignal(request), "/api/guard")));
  });
}
