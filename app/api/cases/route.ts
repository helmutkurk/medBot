import { listCases } from "../../../lib/engine/index.ts";
import { json, route } from "../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return route(async () => json(await listCases())); }
