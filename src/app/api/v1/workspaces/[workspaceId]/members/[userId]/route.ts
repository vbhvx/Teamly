import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { workspaceMemberships, tasks } from "@/db/schema";
import {
  requireWorkspaceMembership,
  AuthorizationPolicy,
  isSoleOwner,
  getWorkspaceMembership,
  type Role,
} from "@/server/authorization/policies";
import { updateMemberRoleSchema } from "@/server/validation";
import {
  createErrorResponse,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";
import { logActivity } from "@/server/services/audit";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ workspaceId: string; userId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId, userId: targetUserId } = await params;

    const actorMembership = await requireWorkspaceMembership(workspaceId, user.id);
    const targetMembership = await getWorkspaceMembership(workspaceId, targetUserId);

    if (!targetMembership) {
      throw new NotFoundError("Member not found in this workspace.");
    }

    const body = await req.json();
    const validated = updateMemberRoleSchema.parse(body);
    const newRole = validated.role as Role;

    // Check if target is the sole owner
    const targetIsSoleOwner = await isSoleOwner(workspaceId, targetUserId);

    const isPermitted = AuthorizationPolicy.canUpdateMemberRole(
      actorMembership.role,
      targetMembership.role,
      newRole,
      targetIsSoleOwner
    );

    if (!isPermitted) {
      if (targetIsSoleOwner && newRole !== "owner") {
        throw new ForbiddenError(
          "Cannot demote the sole workspace owner. Another owner must be designated first."
        );
      }
      throw new ForbiddenError(
        "You do not have permission to change this member's role."
      );
    }

    await db
      .update(workspaceMemberships)
      .set({ role: newRole })
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, targetUserId)
        )
      );

    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "ROLE_CHANGED",
      changeSummary: {
        targetUserId,
        previousRole: targetMembership.role,
        newRole,
      },
    });

    return NextResponse.json(
      {
        data: {
          userId: targetUserId,
          workspaceId,
          role: newRole,
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
    const { workspaceId, userId: targetUserId } = await params;

    const actorMembership = await requireWorkspaceMembership(workspaceId, user.id);
    const targetMembership = await getWorkspaceMembership(workspaceId, targetUserId);

    if (!targetMembership) {
      throw new NotFoundError("Member not found in this workspace.");
    }

    const isSelf = user.id === targetUserId;
    const targetIsSoleOwner = await isSoleOwner(workspaceId, targetUserId);

    const isPermitted = AuthorizationPolicy.canRemoveMember(
      actorMembership.role,
      targetMembership.role,
      isSelf,
      targetIsSoleOwner
    );

    if (!isPermitted) {
      if (targetIsSoleOwner) {
        throw new ForbiddenError(
          "The sole workspace owner cannot leave or be removed. Transfer ownership or delete the workspace."
        );
      }
      throw new ForbiddenError(
        "You do not have permission to remove this member."
      );
    }

    await db.transaction(async (tx) => {
      // Remove membership
      await tx
        .delete(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspaceId),
            eq(workspaceMemberships.userId, targetUserId)
          )
        );

      // Unassign tasks assigned to this user in this workspace
      await tx
        .update(tasks)
        .set({ assigneeId: null, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.workspaceId, workspaceId),
            eq(tasks.assigneeId, targetUserId)
          )
        );
    });

    await logActivity({
      workspaceId,
      actorId: user.id,
      action: isSelf ? "MEMBER_LEFT" : "MEMBER_REMOVED",
      changeSummary: {
        targetUserId,
        previousRole: targetMembership.role,
      },
    });

    return NextResponse.json(
      {
        data: {
          message: isSelf
            ? "You have left the workspace."
            : "Member has been removed successfully.",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

