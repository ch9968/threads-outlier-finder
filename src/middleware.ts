import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "santiago-auth";

/**
 * Generate expected token from SITE_PASSWORD using Web Crypto API (Edge-compatible).
 */
async function getExpectedToken(): Promise<string> {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    throw new Error("Missing SITE_PASSWORD environment variable");
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("santiago-auth"),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 32);
}

/**
 * Password middleware — protects all pages except:
 * - /login (auth page itself)
 * - /api/webhooks/* (secured by webhook secret)
 * - /_next/* and static files
 */
export async function middleware(request: NextRequest) {
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
  const expectedToken = await getExpectedToken();

  if (!authCookie || authCookie.value !== expectedToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
