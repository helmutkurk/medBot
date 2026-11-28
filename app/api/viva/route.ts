import { gradeViva, vivaQuestion } from "../../../lib/engine/viva.ts";
import { engineOptions } from "../../../lib/server/env.ts";
import { body, caseFrom, history, json, requestSignal, route, string } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const messages = history(data.history);
    const opts = engineOptions(requestSignal(request), "/api/viva");
    if (data.answer === undefined) return json(await vivaQuestion(messages, opts));
    const answer = string(data.answer, "answer", 4000);
    const c = await caseFrom(data.caseId);
    return json(await gradeViva(c, messages, answer, opts));
  });
}
