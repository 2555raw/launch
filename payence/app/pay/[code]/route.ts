import { NextResponse, type NextRequest } from "next/server";

/**
 * The QR target. A short link that redirects to the checkout, so the URL on a
 * printed code stays short and the checkout route can change behind it.
 */
export function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return NextResponse.redirect(new URL(`/checkout/${code}`, request.url), 307);
}
