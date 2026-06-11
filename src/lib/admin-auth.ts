import bcrypt from "bcryptjs";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

type AdminSessionData = {
  isAdmin?: boolean;
};

const adminCookieName = "readable_admin";
const adminSessionTtl = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }

  return secret;
}

function hasSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  return Boolean(secret && secret.length >= 32);
}

function getSessionOptions(): SessionOptions {
  return {
    cookieName: adminCookieName,
    password: getSessionSecret(),
    ttl: adminSessionTtl,
    cookieOptions: {
      httpOnly: true,
      maxAge: adminSessionTtl,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export async function getAdminSession() {
  const cookieStore = await cookies();

  return getIronSession<AdminSessionData>(cookieStore, getSessionOptions());
}

export async function hasAdminSession() {
  if (!hasSessionSecret()) {
    return false;
  }

  const session = await getAdminSession();

  return session.isAdmin === true;
}

export async function verifyAdminPassword(password: string) {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();

  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

export async function markAdminLoggedIn(session: IronSession<AdminSessionData>) {
  session.isAdmin = true;
  await session.save();
}

export function unauthorizedAdminJson() {
  return Response.json(
    {
      ok: false,
      error: "Admin session required.",
    },
    {
      status: 401,
    },
  );
}

export async function requireAdmin() {
  if (await hasAdminSession()) {
    return null;
  }

  return unauthorizedAdminJson();
}
