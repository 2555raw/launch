import { NextResponse, type NextRequest } from "next/server";

/**
 * The edge gate.
 *
 * Two jobs, both of which have to happen before anything renders:
 *
 * 1. Send a signed-out visitor to /login with a real 307. Doing this inside a
 *    page means the response has already begun streaming, so Next can only
 *    fall back to a meta-refresh: the visitor sees a flash of the wrong page
 *    first. On a payments app that is unacceptable.
 * 2. Keep a signed-in visitor out of /login and /signup.
 *
 * This checks only that a session cookie is present. It is not authorization:
 * the cookie may be expired, revoked or forged, and every protected page still
 * calls requireAuth(), which verifies it against the database.
 */
/** Whole sections that require a session. */
const PROTECTED_TREES = [
  "/dashboard",
  "/wallet",
  "/send",
  "/receive",
  "/transactions",
  "/settings",
  "/notifications",
  "/merchant",
];

/**
 * Exact paths only. /pay is the scanner, which needs a session; /pay/<code> is
 * the target a printed QR points at, and must stay public so a customer who is
 * not signed in still reaches the checkout rather than a login wall with no
 * explanation.
 */
const PROTECTED_EXACT = ["/pay"];

const AUTH_PAGES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("payence_session");

  const needsSession =
    PROTECTED_EXACT.includes(pathname) ||
    PROTECTED_TREES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!hasSession && needsSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url, 307);
  }

  // /login/verify is the second factor step, which needs a session to reach.
  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets, the API (which authenticates by key)
  // and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
