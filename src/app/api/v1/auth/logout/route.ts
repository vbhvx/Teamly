import { NextRequest, NextResponse } from "next/server";
import { extractTokenFromRequest, invalidateSession, SESSION_COOKIE_NAME } from "@/server/auth/session";
import { createErrorResponse } from "@/server/errors/app-error";

export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromRequest(req);
    if (token) {
      await invalidateSession(token);
    }

    const response = NextResponse.json(
      {
        data: {
          message: "Logged out successfully.",
        },
      },
      { status: 200 }
    );

    // Clear cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      path: "/",
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    return createErrorResponse(error);
  }
}

