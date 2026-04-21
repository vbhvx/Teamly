import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { tasks, users, workspaceMemberships } from "@/db/schema";
import {
  requireWorkspaceMembership,
  AuthorizationPolicy,
  isUserInWorkspace,
} from "@/server/authorization/policies";
import { createTaskSchema, taskQuerySchema } from "@/server/validation";
import {
  createErrorResponse,
  ForbiddenError,
  ValidationError,
  UnprocessableEntityError,
} from "@/server/errors/app-error";
import { generateId } from "@/lib/id";
import { logActivity } from "@/server/services/audit";
import { eq, and, sql, desc, asc, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

const creatorUser = alias(users, "creator_user");
const assigneeUser = alias(users, "assignee_user");

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canViewTasks(membership.role)) {
      throw new ForbiddenError("You do not have permission to view tasks in this workspace.");
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const query = taskQuerySchema.parse(queryParams);

    // Build filter conditions
    const conditions = [eq(tasks.workspaceId, workspaceId)];

    if (query.status) {
      conditions.push(eq(tasks.status, query.status));
    }
    if (query.priority) {
      conditions.push(eq(tasks.priority, query.priority));
    }
    if (query.assigneeId) {
      conditions.push(eq(tasks.assigneeId, query.assigneeId));
    }
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(tasks.title, searchPattern),
          ilike(tasks.description, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Count total matching tasks
    const [totalCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(whereClause);

    const total = totalCountResult?.count || 0;
    const offset = (query.page - 1) * query.limit;
    const totalPages = Math.ceil(total / query.limit);

    // Sort column
    let sortColumn: any = tasks.createdAt;
    if (query.sortBy === "dueAt") sortColumn = tasks.dueAt;
    if (query.sortBy === "priority") sortColumn = tasks.priority;
    if (query.sortBy === "status") sortColumn = tasks.status;
    if (query.sortBy === "title") sortColumn = tasks.title;

    const orderDirection = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const taskRows = await db
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
      .where(whereClause)
      .orderBy(orderDirection)
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json(
      {
        data: taskRows,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canCreateTask(membership.role)) {
      throw new ForbiddenError("Viewers cannot create tasks.");
    }

    const body = await req.json();
    const validated = createTaskSchema.parse(body);

    // If assigneeId is provided, verify assignee is a member of THIS workspace
    if (validated.assigneeId) {
      const isAssigneeMember = await isUserInWorkspace(workspaceId, validated.assigneeId);
      if (!isAssigneeMember) {
        throw new UnprocessableEntityError(
          "Task cannot be assigned to a user who is not a member of this workspace.",
          [{ field: "assigneeId", code: "NOT_WORKSPACE_MEMBER" }]
        );
      }
    }

    const taskId = generateId("task");
    const dueAtDate = validated.dueAt ? new Date(validated.dueAt) : null;

    const [newTask] = await db
      .insert(tasks)
      .values({
        id: taskId,
        workspaceId,
        title: validated.title,
        description: validated.description || null,
        status: validated.status || "todo",
        priority: validated.priority || "medium",
        createdBy: user.id,
        assigneeId: validated.assigneeId || null,
        dueAt: dueAtDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await logActivity({
      workspaceId,
      taskId: newTask.id,
      actorId: user.id,
      action: "TASK_CREATED",
      changeSummary: {
        title: newTask.title,
        status: newTask.status,
        priority: newTask.priority,
        assigneeId: newTask.assigneeId,
      },
    });

    return NextResponse.json(
      {
        data: newTask,
      },
      { status: 201 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

