import { body, HttpError, json, route } from "../../../../lib/server/http.ts";
import { ADMIN_COOKIE, ADMIN_SECONDS, accessConfigured, cookieHeader, matchesCode, signCookie } from "../../../../lib/server/hosted.ts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return route(async () => {
    if (!accessConfigured() || (process.env.MEDBOT_ADMIN_CODE?.length ?? 0) < 12) throw new HttpError(503, "admin_unconfigured", "Feedback review is not configured. Please contact the host.");
    const data = await body(request, 1024);
    if (typeof data.code !== "string" || !await matchesCode(data.code, process.env.MEDBOT_ADMIN_CODE)) throw new HttpError(403, "invalid_code", "That admin code was not accepted.");
    const response = json({ ok: true });
    response.headers.set("Set-Cookie", cookieHeader(request, ADMIN_COOKIE, await signCookie("admin"), ADMIN_SECONDS));
    return response;
  });
}
