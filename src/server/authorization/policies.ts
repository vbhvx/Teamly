import { db } from "@/db/client";
import { workspaceMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@/server/errors/app-error";

export type Role = "owner" | "admin" | "member" | "viewer";

export interface TaskResource {
  id: string;
  workspaceId: string;
  createdBy: string;
  assigneeId?: string | null;
}

export const AuthorizationPolicy = {
  canViewWorkspace(role: Role): boolean {
    return ["owner", "admin", "member", "viewer"].includes(role);
  },

  canUpdateWorkspace(role: Role): boolean {
    return role === "owner";
  },

  canDeleteWorkspace(role: Role): boolean {
    return role === "owner";
  },

  canViewMembers(role: Role): boolean {
    return ["owner", "admin", "member", "viewer"].includes(role);
  },

  canInviteMembers(role: Role): boolean {
    return ["owner", "admin"].includes(role);
  },

  canRemoveMember(
    actorRole: Role,
    targetRole: Role,
    isSelf: boolean,
    isTargetOnlyOwner: boolean
  ): boolean {
    if (isTargetOnlyOwner) {
      // The only owner cannot be removed or leave without transferring ownership
      return false;
    }

    if (isSelf) {
      // Any member can remove themselves (leave) except the last owner
      return true;
    }

    if (actorRole === "owner") {
      return true;
    }

    if (actorRole === "admin") {
      // Admin can remove members and viewers, but not owners or other admins
      return ["member", "viewer"].includes(targetRole);
    }

    return false;
  },

  canUpdateMemberRole(
    actorRole: Role,
    targetRole: Role,
    newRole: Role,
    isTargetOnlyOwner: boolean
  ): boolean {
    if (isTargetOnlyOwner && newRole !== "owner") {
      // Cannot demote the only owner
      return false;
    }

    if (actorRole === "owner") {
      return true;
    }

    if (actorRole === "admin") {
      // Admin cannot promote anyone to owner, cannot modify an owner, and cannot modify another admin
      if (targetRole === "owner" || newRole === "owner") {
        return false;
      }
      if (targetRole === "admin") {
        return false;
      }
      return ["member", "viewer"].includes(targetRole) && ["admin", "member", "viewer"].includes(newRole);
    }

    return false;
  },

  canViewTasks(role: Role): boolean {
    return ["owner", "admin", "member", "viewer"].includes(role);
  },

  canCreateTask(role: Role): boolean {
    return ["owner", "admin", "member"].includes(role);
  },

  canEditTask(role: Role, task: TaskResource, userId: string): boolean {
    if (["owner", "admin"].includes(role)) {
      return true;
    }
    if (role === "member") {
      // Member can only edit tasks they created or are assigned to
      return task.createdBy === userId || task.assigneeId === userId;
    }
    return false; // viewer cannot edit
  },

  canDeleteTask(role: Role, task: TaskResource, userId: string): boolean {
    if (["owner", "admin"].includes(role)) {
      return true;
    }
    if (role === "member") {
      // Member can delete only tasks they personally created
      return task.createdBy === userId;
    }
    return false; // viewer cannot delete
  },

  canViewAudit(role: Role): boolean {
    return ["owner", "admin", "member", "viewer"].includes(role);
  },
};

/**
 * Retrieves the current user's membership for a workspace.
 * Returns null if the user is not a member.
 */
export async function getWorkspaceMembership(
  workspaceId: string,
  userId: string
): Promise<{ id: string; role: Role; joinedAt: Date } | null> {
  const result = await db
    .select({
      id: workspaceMemberships.id,
      role: workspaceMemberships.role,
      joinedAt: workspaceMemberships.joinedAt,
    })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId)
      )
    )
    .limit(1);

  if (!result || result.length === 0) {
    return null;
  }

  return {
    id: result[0].id,
    role: result[0].role as Role,
    joinedAt: result[0].joinedAt,
  };
}

/**
 * Verifies that the user is an active member of the workspace.
 * Throws NotFoundError (intentional 404 to avoid leaking private workspace existence).
 */
export async function requireWorkspaceMembership(
  workspaceId: string,
  userId: string
): Promise<{ id: string; role: Role; joinedAt: Date }> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    // Intentional 404 to conceal private resource existence from non-members
    throw new NotFoundError("Workspace not found");
  }
  return membership;
}

/**
 * Checks if a target user is an active member of the given workspace.
 */
export async function isUserInWorkspace(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  return membership !== null;
}

/**
 * Checks if a user is the sole owner of a workspace.
 */
export async function isSoleOwner(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const ownerMemberships = await db
    .select({ id: workspaceMemberships.id, userId: workspaceMemberships.userId })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.role, "owner")
      )
    );

  return ownerMemberships.length === 1 && ownerMemberships[0].userId === userId;
}
