import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_SERVER_ERROR";

export interface ErrorDetail {
  field?: string;
  code: string;
  message?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: ErrorDetail[];

  constructor(message: string, code: ErrorCode, status: number, details?: ErrorDetail[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, "CONFLICT", 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(message, "UNPROCESSABLE_ENTITY", 422, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
  }
}

export function formatZodError(error: ZodError): ErrorDetail[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    code: err.code.toUpperCase(),
    message: err.message,
  }));
}

export function createErrorResponse(
  error: unknown,
  requestId: string = `req_${Math.random().toString(36).substring(2, 10)}`
): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && error.details.length > 0 ? { details: error.details } : {}),
          requestId,
        },
      },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    const details = formatZodError(error);
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request contains invalid fields.",
          details,
          requestId,
        },
      },
      { status: 400 }
    );
  }

  // Never leak internal DB error messages, SQL queries, or stack traces
  console.error(`[Unhandled Error] [${requestId}]`, error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
        requestId,
      },
    },
    { status: 500 }
  );
}

