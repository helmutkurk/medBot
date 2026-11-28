import { patientTurn } from "../../../lib/engine/index.ts";
import { engineOptions, getModels } from "../../../lib/server/env.ts";
import { body, history, interviewFrom, json, requestSignal, route, string } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const messages = history(data.history);
    const text = string(data.text, "text");
    const { c, p } = await interviewFrom(data);
    return json(await patientTurn(c, p, messages, text, {
      ...engineOptions(requestSignal(request), "/api/chat"), model: getModels().patient,
    }));
  });
}
