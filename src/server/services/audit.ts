import { db } from "@/db/client";
import { taskActivities, users } from "@/db/schema";
import { generateId } from "@/lib/id";
import { eq, desc } from "drizzle-orm";

export interface LogActivityParams {
  workspaceId: string;
  taskId?: string | null;
  actorId?: string | null;
  action: string;
  changeSummary: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    // Sanitize any sensitive fields just in case
    const sanitizedSummary = { ...params.changeSummary };
    delete (sanitizedSummary as Record<string, unknown>).password;
    delete (sanitizedSummary as Record<string, unknown>).passwordHash;
    delete (sanitizedSummary as Record<string, unknown>).token;
    delete (sanitizedSummary as Record<string, unknown>).tokenHash;

    await db.insert(taskActivities).values({
      id: generateId("act"),
      workspaceId: params.workspaceId,
      taskId: params.taskId || null,
      actorId: params.actorId || null,
      action: params.action,
      changeSummary: sanitizedSummary,
      createdAt: new Date(),
    });
  } catch (err) {
    // Audit logging failure should be noted but not crash business logic if handled gracefully
    console.error("Failed to log activity event:", err);
  }
}

export async function getTaskActivities(taskId: string, workspaceId: string) {
  return await db
    .select({
      id: taskActivities.id,
      taskId: taskActivities.taskId,
      workspaceId: taskActivities.workspaceId,
      action: taskActivities.action,
      changeSummary: taskActivities.changeSummary,
      createdAt: taskActivities.createdAt,
      actor: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(taskActivities)
    .leftJoin(users, eq(taskActivities.actorId, users.id))
    .where(eq(taskActivities.taskId, taskId))
    .orderBy(desc(taskActivities.createdAt))
    .limit(50);
}

export async function getWorkspaceActivities(workspaceId: string, limit = 50) {
  return await db
    .select({
      id: taskActivities.id,
      taskId: taskActivities.taskId,
      workspaceId: taskActivities.workspaceId,
      action: taskActivities.action,
      changeSummary: taskActivities.changeSummary,
      createdAt: taskActivities.createdAt,
      actor: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(taskActivities)
    .leftJoin(users, eq(taskActivities.actorId, users.id))
    .where(eq(taskActivities.workspaceId, workspaceId))
    .orderBy(desc(taskActivities.createdAt))
    .limit(limit);
}

