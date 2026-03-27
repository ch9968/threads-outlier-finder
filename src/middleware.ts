import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "santiago-auth";

/**
 * Password middleware — protects all pages except:
 * - /login (auth page itself)
 * - /api/webhooks/* (secured by webhook secret)
 * - /_next/* and static files
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, webhooks, Next.js internals, and static files
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(COOKIE_NAME);

  if (!authCookie || authCookie.value !== getExpectedToken()) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Generate expected token from SITE_PASSWORD.
 * Simple hash to avoid storing plaintext in cookie.
 */
function getExpectedToken(): string {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    throw new Error("Missing SITE_PASSWORD environment variable");
  }
  // Simple deterministic token from password.
  // Not cryptographically strong, but sufficient for a 1-person tool.
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `s_${Math.abs(hash).toString(36)}`;
}

export { getExpectedToken, COOKIE_NAME };

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
