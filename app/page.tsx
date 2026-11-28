import { Interview } from "../components/Interview.tsx";
import { listCases, loadCase } from "../lib/engine/index.ts";
import { interviewCase } from "../lib/server/cases.ts";
import { getModels, hasOpenAIKey } from "../lib/server/env.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const health = { ready: hasOpenAIKey(), models: getModels() };
  if (!health.ready) return <Interview cases={[]} health={health} />;
  const summaries = await listCases();
  const cases = await Promise.all(summaries.map(async summary => {
    const c = await loadCase(summary.id);
    return interviewCase(c);
  }));
  return <Interview cases={cases} health={health} />;
}
