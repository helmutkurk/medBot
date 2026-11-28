import { ACCESS_COOKIE, gateDecision, hosted, isApiPath, publicPath, requestCookie, verifyCookie } from "./hosted.ts";
import { clientAddress, costsMoney, requestLimiter, routeClass } from "./limits.ts";
import { budgetFailure } from "./budget.ts";

function failure(status: number, code: string, message: string, retry?: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: {
    "Cache-Control": "private, no-store", ...(retry ? { "Retry-After": String(retry) } : {}),
  } });
}

export async function protectRequest(request: Request): Promise<Response | null> {
  if (!hosted()) return null;
  const url = new URL(request.url), pathname = url.pathname;
  const decision = await gateDecision(request);
  if (decision === "setup") return failure(503, "access_unconfigured", "Demo access is not configured. Please contact the host.");
  if (decision === "unauthorized") return failure(401, "access_required", "Access required. Open /access and enter the shared passcode (sessions last 12 hours).");
  if (decision === "login") return new Response(null, { status: 307, headers: { Location: new URL("/access", url).href, "Cache-Control": "private, no-store" } });
  if (publicPath(pathname) && pathname !== "/access/login") return null;
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") return failure(403, "invalid_origin", "Requests must come from this application.");
  }
  if (pathname === "/access/login" || isApiPath(pathname)) {
    const kind = routeClass(pathname, request.method);
    const retry = requestLimiter.check(`ip:${clientAddress(request)}`, kind);
    if (retry) return failure(429, "rate_limited", "Too many requests. Please wait before trying again.", retry);
    const client = await verifyCookie(requestCookie(request, ACCESS_COOKIE), "access");
    if (client) {
      const cookieRetry = requestLimiter.check(`cookie:${client}`, kind);
      if (cookieRetry) return failure(429, "rate_limited", "Too many requests. Please wait before trying again.", cookieRetry);
    }
  }
  // The route boundary checks the ledger too: Proxy can run in a different serverless instance.
  if (costsMoney(pathname, request.method)) {
    const blocked = await budgetFailure();
    if (blocked) return failure(blocked.status, blocked.code, blocked.message);
  }
  return null;
}
