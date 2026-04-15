import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "teamly_session";
const SESSION_EXPIRY_DAYS = 7;
const BCRYPT_SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  await db.insert(sessions).values({
    id: generateId("sess"),
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  });

  return { token, expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function validateSessionToken(
  token: string
): Promise<{ user: AuthenticatedUser; sessionExpiresAt: Date } | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const result = await db
    .select({
      sessionId: sessions.id,
      sessionExpiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!result || result.length === 0) {
    return null;
  }

  const session = result[0];

  // Optionally update lastActiveAt
  await db
    .update(sessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(sessions.id, session.sessionId));

  return {
    user: session.user,
    sessionExpiresAt: session.sessionExpiresAt,
  };
}

export function getSessionCookieOptions(expiresAt: Date) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

/**
 * Extract token from either Cookie or Authorization header (Bearer <token>)
 */
export function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (cookie && cookie.value) {
    return cookie.value;
  }

  return null;
}
