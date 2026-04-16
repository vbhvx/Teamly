import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { loginSchema } from "@/server/validation";
import {
  verifyPassword,
  createSession,
  getSessionCookieOptions,
} from "@/server/auth/session";
import { rateLimiter } from "@/server/auth/rate-limiter";
import {
  createErrorResponse,
  UnauthorizedError,
  RateLimitError,
} from "@/server/errors/app-error";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = rateLimiter.check(`login:${ip}`, 15, 60000);
    if (!rateCheck.allowed) {
      throw new RateLimitError();
    }

    const body = await req.json();
    const validated = loginSchema.parse(body);

    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1);

    // Generic failure message to prevent email enumeration
    const genericAuthError = new UnauthorizedError("Invalid email or password.");

    if (userRows.length === 0) {
      throw genericAuthError;
    }

    const user = userRows[0];
    const passwordValid = await verifyPassword(validated.password, user.passwordHash);
    if (!passwordValid) {
      throw genericAuthError;
    }

    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json(
      {
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          token,
        },
      },
      { status: 200 }
    );

    response.cookies.set(
      getSessionCookieOptions(expiresAt).name,
      token,
      getSessionCookieOptions(expiresAt)
    );

    return response;
  } catch (error) {
    return createErrorResponse(error);
  }
}

