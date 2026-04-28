import { NextRequest } from "next/server";
import { db, pool } from "@/db/client";
import { users, workspaces, workspaceMemberships, tasks, taskActivities, sessions, workspaceInvitations } from "@/db/schema";
import { hashPassword, createSession } from "@/server/auth/session";
import { generateId } from "@/lib/id";
import { sql } from "drizzle-orm";

export async function clearTestDatabase(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE task_activities, tasks, workspace_invitations, workspace_memberships, workspaces, sessions, users CASCADE;
  `);
}

export async function createTestUser(params: {
  name?: string;
  email: string;
  password?: string;
}): Promise<{ id: string; email: string; name: string; token: string }> {
  const password = params.password || "Password123";
  const passwordHash = await hashPassword(password);
  const id = generateId("usr");
  const name = params.name || "Test User";

  await db.insert(users).values({
    id,
    email: params.email.toLowerCase(),
    name,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { token } = await createSession(id);
  return { id, email: params.email.toLowerCase(), name, token };
}

export function makeRequest(
  url: string,
  method: string = "GET",
  body?: any,
  token?: string
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  const baseUrl = process.env.APP_URL || "https://teamly.local";
  const req = new NextRequest(new URL(url, baseUrl), init as any);
  return req;
}
