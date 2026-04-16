import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { registerSchema } from "@/server/validation";
import { hashPassword, createSession, getSessionCookieOptions } from "@/server/auth/session";
import { rateLimiter } from "@/server/auth/rate-limiter";
import {
  createErrorResponse,
  ConflictError,
  RateLimitError,
} from "@/server/errors/app-error";
import { generateId } from "@/lib/id";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = rateLimiter.check(`register:${ip}`, 10, 60000);
    if (!rateCheck.allowed) {
      throw new RateLimitError();
    }

    const body = await req.json();
    const validated = registerSchema.parse(body);

    // Check if email already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError("An account with this email address already exists.");
    }

    const passwordHash = await hashPassword(validated.password);
    const userId = generateId("usr");

    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email: validated.email,
        name: validated.name,
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    // Create session
    const { token, expiresAt } = await createSession(newUser.id);

    const response = NextResponse.json(
      {
        data: {
          user: newUser,
          token, // For API clients
        },
      },
      { status: 201 }
    );

    // Set HttpOnly cookie for browser sessions
    response.cookies.set(getSessionCookieOptions(expiresAt).name, token, getSessionCookieOptions(expiresAt));

    return response;
  } catch (error) {
    return createErrorResponse(error);
  }
}

