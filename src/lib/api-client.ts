export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field?: string; code: string; message?: string }>;
  requestId?: string;
}

export class ClientApiError extends Error {
  public readonly code: string;
  public readonly details?: Array<{ field?: string; code: string; message?: string }>;
  public readonly status: number;

  constructor(message: string, code: string, status: number, details?: any[]) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  // Include credentials for session cookie
  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const errorInfo: ApiError = data?.error || {
      code: "UNKNOWN_ERROR",
      message: res.statusText || "Request failed",
    };
    throw new ClientApiError(errorInfo.message, errorInfo.code, res.status, errorInfo.details);
  }

  return data?.data as T;
}

