import { Interview } from "../components/Interview.tsx";
import { listCases, loadCase } from "../lib/engine/index.ts";
import { getModels, hasOpenAIKey } from "../lib/server/env.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const summaries = await listCases();
  const cases = await Promise.all(summaries.map(async summary => {
    const c = await loadCase(summary.id);
    return { ...summary, facts: c.facts.map(({ id, category, lay }) => ({ id, category, lay })) };
  }));
  return <Interview cases={cases} health={{ voice: hasOpenAIKey(), text: hasOpenAIKey() ? "openai" : "mock", models: getModels() }} />;
}
