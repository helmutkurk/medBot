import { ReviewSession } from "../../../components/ReviewSession.tsx";
import { listCases, loadCase } from "../../../lib/engine/index.ts";
import { interviewCase } from "../../../lib/server/cases.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Daily review · medBot" };
export default async function ReviewPage() {
  const cases = await Promise.all((await listCases()).map(async c => interviewCase(await loadCase(c.id))));
  return <ReviewSession cases={cases} />;
}
