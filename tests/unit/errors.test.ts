import { describe, it, expect } from "vitest";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  createErrorResponse,
} from "@/server/errors/app-error";
import { z, ZodError } from "zod";

describe("Error Envelope & Exception Handling (Unit)", () => {
  it("should create AppError with proper code and status", () => {
    const error = new UnauthorizedError("Please log in");
    expect(error.status).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Please log in");
  });

  it("should format AppError into standardized JSON response", async () => {
    const error = new ForbiddenError("Insufficient rights");
    const response = createErrorResponse(error, "req_test_123");

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient rights",
        requestId: "req_test_123",
      },
    });
  });

  it("should format Zod validation error into standardized response with details", async () => {
    const schema = z.object({
      title: z.string().min(3),
    });

    let zodErr: ZodError | null = null;
    try {
      schema.parse({ title: "ab" });
    } catch (e) {
      zodErr = e as ZodError;
    }

    expect(zodErr).not.toBeNull();
    const response = createErrorResponse(zodErr!, "req_zod_456");

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
    expect(body.error.details.length).toBeGreaterThan(0);
    expect(body.error.details[0].field).toBe("title");
  });

  it("should mask unhandled errors and return generic 500 without leaking stack traces or internal secrets", async () => {
    const internalSecretError = new Error("FATAL: password authentication failed for postgres connection string postgresql://secret:pass@internal-db:5432");
    const response = createErrorResponse(internalSecretError, "req_secret_mask");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).not.toContain("password");
    expect(body.error.message).not.toContain("postgresql");
    expect(body.error.message).toBe("An unexpected error occurred. Please try again later.");
  });
});

