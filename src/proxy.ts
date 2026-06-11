import { NextRequest, NextResponse } from "next/server";
import {
  isValidLibraryKey,
  libraryAccessCookie,
  libraryAccessCookieOptions,
} from "@/lib/access";

const securityHeaders = {
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function acceptsHtml(request: NextRequest) {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

export function proxy(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("k");
  const hasValidKey = isValidLibraryKey(key);
  const isHtmlGet = request.method === "GET" && acceptsHtml(request);
  const shouldStripKey = hasValidKey && isHtmlGet;

  const response = shouldStripKey
    ? NextResponse.redirect(withoutKey(request.nextUrl))
    : NextResponse.next();

  if (hasValidKey && key) {
    response.cookies.set(libraryAccessCookie, key, libraryAccessCookieOptions());
  }

  for (const [header, value] of Object.entries(securityHeaders)) {
    response.headers.set(header, value);
  }

  return response;
}

function withoutKey(url: URL) {
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("k");

  return cleanUrl;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
