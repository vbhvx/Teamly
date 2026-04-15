import { NextRequest } from "next/server";
import { extractTokenFromRequest, validateSessionToken, AuthenticatedUser } from "./session";
import { UnauthorizedError, ForbiddenError } from "@/server/errors/app-error";

export interface AuthContext {
  user: AuthenticatedUser;
  token: string;
}

/**
 * Validates session token and returns authenticated context.
 * Throws UnauthorizedError if missing or invalid.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const token = extractTokenFromRequest(req);
  if (!token) {
    throw new UnauthorizedError("Authentication required. Please log in.");
  }

  // Validate CSRF for cookie-based mutating requests
  const method = req.method.toUpperCase();
  const isMutating = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  const isCookieAuth = !req.headers.get("authorization") && req.cookies.has("teamly_session");

  if (isMutating && isCookieAuth) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const referer = req.headers.get("referer");

    // Modern browsers send Origin or Referer with mutating requests
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          throw new ForbiddenError("Cross-site request forgery validation failed");
        }
      } catch {
        throw new ForbiddenError("Invalid origin header");
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host) {
          throw new ForbiddenError("Cross-site request forgery validation failed");
        }
      } catch {
        throw new ForbiddenError("Invalid referer header");
      }
    }
  }

  const result = await validateSessionToken(token);
  if (!result) {
    throw new UnauthorizedError("Session has expired or is invalid. Please log in again.");
  }

  return {
    user: result.user,
    token,
  };
}

/**
 * Optional authentication helper: returns user if logged in, null otherwise.
 */
export async function getOptionalAuth(req: NextRequest): Promise<AuthContext | null> {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const result = await validateSessionToken(token);
  if (!result) {
    return null;
  }

  return {
    user: result.user,
    token,
  };
}

