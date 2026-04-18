import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { requireWorkspaceMembership, AuthorizationPolicy } from "@/server/authorization/policies";
import { updateWorkspaceSchema } from "@/server/validation";
import {
  createErrorResponse,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/app-error";
import { logActivity } from "@/server/services/audit";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    return NextResponse.json(
      {
        data: {
          ...workspace,
          currentUserRole: membership.role,
        },
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
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canUpdateWorkspace(membership.role)) {
      throw new ForbiddenError("Only workspace owners can update workspace settings.");
    }

    const body = await req.json();
    const validated = updateWorkspaceSchema.parse(body);

    const [updatedWorkspace] = await db
      .update(workspaces)
      .set({
        name: validated.name,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "WORKSPACE_UPDATED",
      changeSummary: { name: validated.name },
    });

    return NextResponse.json(
      {
        data: {
          ...updatedWorkspace,
          currentUserRole: membership.role,
        },
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
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canDeleteWorkspace(membership.role)) {
      throw new ForbiddenError("Only workspace owners can delete a workspace.");
    }

    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    return NextResponse.json(
      {
        data: {
          message: "Workspace deleted successfully.",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

