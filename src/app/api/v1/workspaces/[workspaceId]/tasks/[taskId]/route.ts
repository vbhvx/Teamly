import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { tasks, users } from "@/db/schema";
import {
  requireWorkspaceMembership,
  AuthorizationPolicy,
  isUserInWorkspace,
} from "@/server/authorization/policies";
import { updateTaskSchema } from "@/server/validation";
import {
  createErrorResponse,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "@/server/errors/app-error";
import { logActivity } from "@/server/services/audit";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

interface RouteParams {
  params: Promise<{ workspaceId: string; taskId: string }>;
}

const creatorUser = alias(users, "creator_user");
const assigneeUser = alias(users, "assignee_user");

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId, taskId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    const [task] = await db
      .select({
        id: tasks.id,
        workspaceId: tasks.workspaceId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        creator: {
          id: creatorUser.id,
          name: creatorUser.name,
          email: creatorUser.email,
        },
        assignee: {
          id: assigneeUser.id,
          name: assigneeUser.name,
          email: assigneeUser.email,
        },
      })
      .from(tasks)
      .innerJoin(creatorUser, eq(tasks.createdBy, creatorUser.id))
      .leftJoin(assigneeUser, eq(tasks.assigneeId, assigneeUser.id))
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
      .limit(1);

    if (!task) {
      throw new NotFoundError("Task not found.");
    }

    return NextResponse.json(
      {
        data: task,
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId, taskId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError("Task not found.");
    }

    // Role-based task edit authorization
    const canEdit = AuthorizationPolicy.canEditTask(
      membership.role,
      {
        id: existingTask.id,
        workspaceId: existingTask.workspaceId,
        createdBy: existingTask.createdBy,
        assigneeId: existingTask.assigneeId,
      },
      user.id
    );

    if (!canEdit) {
      throw new ForbiddenError(
        "You do not have permission to edit this task. Members can only edit tasks they created or are assigned to."
      );
    }

    const body = await req.json();
    const validated = updateTaskSchema.parse(body);

    // Validate assignee if changed to non-null
    if (validated.assigneeId !== undefined && validated.assigneeId !== null) {
      const isAssigneeMember = await isUserInWorkspace(workspaceId, validated.assigneeId);
      if (!isAssigneeMember) {
        throw new UnprocessableEntityError(
          "Task cannot be assigned to a user who is not a member of this workspace.",
          [{ field: "assigneeId", code: "NOT_WORKSPACE_MEMBER" }]
        );
      }
    }

    // Prepare update payload
    const updatePayload: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
    };
    const changes: Record<string, { from: any; to: any }> = {};

    if (validated.title !== undefined && validated.title !== existingTask.title) {
      updatePayload.title = validated.title;
      changes.title = { from: existingTask.title, to: validated.title };
    }
    if (validated.description !== undefined && validated.description !== existingTask.description) {
      updatePayload.description = validated.description;
      changes.description = { from: existingTask.description, to: validated.description };
    }
    if (validated.status !== undefined && validated.status !== existingTask.status) {
      updatePayload.status = validated.status;
      changes.status = { from: existingTask.status, to: validated.status };
    }
    if (validated.priority !== undefined && validated.priority !== existingTask.priority) {
      updatePayload.priority = validated.priority;
      changes.priority = { from: existingTask.priority, to: validated.priority };
    }
    if (validated.assigneeId !== undefined && validated.assigneeId !== existingTask.assigneeId) {
      updatePayload.assigneeId = validated.assigneeId;
      changes.assigneeId = { from: existingTask.assigneeId, to: validated.assigneeId };
    }
    if (validated.dueAt !== undefined) {
      const newDueDate = validated.dueAt ? new Date(validated.dueAt) : null;
      const oldDueTime = existingTask.dueAt ? existingTask.dueAt.getTime() : null;
      const newDueTime = newDueDate ? newDueDate.getTime() : null;
      if (oldDueTime !== newDueTime) {
        updatePayload.dueAt = newDueDate;
        changes.dueAt = { from: existingTask.dueAt, to: newDueDate };
      }
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updatePayload)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
      .returning();

    // Log specific and general activities if there were actual changes
    if (Object.keys(changes).length > 0) {
      if (changes.status) {
        await logActivity({
          workspaceId,
          taskId,
          actorId: user.id,
          action: "STATUS_CHANGED",
          changeSummary: changes.status,
        });
      }
      if (changes.priority) {
        await logActivity({
          workspaceId,
          taskId,
          actorId: user.id,
          action: "PRIORITY_CHANGED",
          changeSummary: changes.priority,
        });
      }
      if (changes.assigneeId) {
        await logActivity({
          workspaceId,
          taskId,
          actorId: user.id,
          action: "TASK_ASSIGNED",
          changeSummary: changes.assigneeId,
        });
      }
      if (changes.dueAt) {
        await logActivity({
          workspaceId,
          taskId,
          actorId: user.id,
          action: "DUE_DATE_CHANGED",
          changeSummary: changes.dueAt,
        });
      }

      await logActivity({
        workspaceId,
        taskId,
        actorId: user.id,
        action: "TASK_UPDATED",
        changeSummary: changes,
      });
    }

    return NextResponse.json(
      {
        data: updatedTask,
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId, taskId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError("Task not found.");
    }

    const canDelete = AuthorizationPolicy.canDeleteTask(
      membership.role,
      {
        id: existingTask.id,
        workspaceId: existingTask.workspaceId,
        createdBy: existingTask.createdBy,
        assigneeId: existingTask.assigneeId,
      },
      user.id
    );

    if (!canDelete) {
      throw new ForbiddenError(
        "You do not have permission to delete this task. Only Workspace Owners, Admins, or the task creator can delete it."
      );
    }

    await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)));

    await logActivity({
      workspaceId,
      taskId: existingTask.id,
      actorId: user.id,
      action: "TASK_DELETED",
      changeSummary: {
        title: existingTask.title,
      },
    });

    return NextResponse.json(
      {
        data: {
          message: "Task deleted successfully.",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

