import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { protectRequest } from "./lib/server/protection.ts";
import { hosted, publicPath } from "./lib/server/hosted.ts";

export async function proxy(request: NextRequest) {
  const blocked = await protectRequest(request);
  if (blocked) return blocked;
  const response = NextResponse.next();
  if (hosted() && !publicPath(request.nextUrl.pathname)) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Match everything, including future routes. Only explicit static paths bypass protection.
export const config = { matcher: ["/:path*"] };
