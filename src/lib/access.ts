import { cookies } from "next/headers";

export const libraryAccessCookie = "readable_access";

const cookieMaxAge = 60 * 60 * 24 * 30;

export function getLibraryKey() {
  return process.env.LIBRARY_KEY?.trim() ?? "";
}

export function isValidLibraryKey(key: string | null | undefined) {
  const libraryKey = getLibraryKey();

  return libraryKey.length > 0 && key === libraryKey;
}

export async function hasLibraryCookieAccess() {
  const cookieStore = await cookies();

  return isValidLibraryKey(cookieStore.get(libraryAccessCookie)?.value);
}

export function hasLibraryRequestAccess(request: Request) {
  const url = new URL(request.url);

  if (isValidLibraryKey(url.searchParams.get("k"))) {
    return true;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const requestCookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const accessCookie = requestCookies.find((cookie) =>
    cookie.startsWith(`${libraryAccessCookie}=`)
  );

  if (!accessCookie) {
    return false;
  }

  return isValidLibraryKey(decodeURIComponent(accessCookie.split("=")[1] ?? ""));
}

export function libraryAccessCookieOptions() {
  return {
    httpOnly: true,
    maxAge: cookieMaxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function unauthorizedJson() {
  return Response.json(
    {
      ok: false,
      error: "Library access key required.",
    },
    {
      status: 401,
    },
  );
}

export function aboutUrlFor(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("k");
  const about = new URL("/llms.txt", url.origin);

  if (key) {
    about.searchParams.set("k", key);
  }

  return about.pathname + about.search;
}
