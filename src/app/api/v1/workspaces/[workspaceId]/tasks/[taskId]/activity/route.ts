import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { requireWorkspaceMembership, AuthorizationPolicy } from "@/server/authorization/policies";
import { getTaskActivities } from "@/server/services/audit";
import { createErrorResponse, ForbiddenError, NotFoundError } from "@/server/errors/app-error";
import { db } from "@/db/client";
import { tasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ workspaceId: string; taskId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId, taskId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canViewAudit(membership.role)) {
      throw new ForbiddenError("You do not have permission to view task audit history.");
    }

    // Verify task belongs to this workspace
    const [existingTask] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError("Task not found.");
    }

    const activities = await getTaskActivities(taskId, workspaceId);

    return NextResponse.json(
      {
        data: activities,
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

