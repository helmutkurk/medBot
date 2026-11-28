import { Learning } from "../../components/Learning.tsx";
import { listCases, loadCase } from "../../lib/engine/index.ts";
import { interviewCase } from "../../lib/server/cases.ts";
import { hasOpenAIKey } from "../../lib/server/env.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function LearningPage() {
  const summaries = await listCases();
  const cases = await Promise.all(summaries.map(async c => interviewCase(await loadCase(c.id))));
  return <Learning cases={cases} ready={hasOpenAIKey()} />;
}
