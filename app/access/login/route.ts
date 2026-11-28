import { body, HttpError, json, route } from "../../../lib/server/http.ts";
import { ACCESS_COOKIE, ACCESS_SECONDS, accessConfigured, cookieHeader, matchesCode, signCookie } from "../../../lib/server/hosted.ts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return route(async () => {
    if (!accessConfigured()) throw new HttpError(503, "access_unconfigured", "Demo access is not configured. Please contact the host.");
    const data = await body(request, 1024);
    if (typeof data.code !== "string" || !await matchesCode(data.code, process.env.MEDBOT_ACCESS_CODE)) throw new HttpError(401, "invalid_code", "That passcode was not accepted.");
    const response = json({ ok: true });
    response.headers.set("Set-Cookie", cookieHeader(request, ACCESS_COOKIE, await signCookie("access"), ACCESS_SECONDS));
    return response;
  });
}
