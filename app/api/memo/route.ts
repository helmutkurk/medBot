import { buildConsistencyMemo, buildPatientInstructions } from "../../../lib/engine/index.ts";
import { body, ids, interviewFrom, json, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Returns full session instructions plus the consistency memo for a mid-call
// session.update. Instructions stay server-side until needed; no key is involved.
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const revealed = ids(data.revealed, "revealed");
    const { c, p } = await interviewFrom(data);
    return json({ instructions: `${buildPatientInstructions(c, p)}\n\n${buildConsistencyMemo(c, revealed)}` });
  });
}
