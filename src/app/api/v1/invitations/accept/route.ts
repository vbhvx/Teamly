import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { workspaceInvitations, workspaceMemberships } from "@/db/schema";
import { acceptInvitationSchema } from "@/server/validation";
import { hashToken } from "@/server/auth/session";
import { generateId } from "@/lib/id";
import {
  createErrorResponse,
  NotFoundError,
  ConflictError,
} from "@/server/errors/app-error";
import { logActivity } from "@/server/services/audit";
import { eq, and, gt } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    const body = await req.json();
    const validated = acceptInvitationSchema.parse(body);

    const tokenHash = hashToken(validated.token);
    const now = new Date();

    const [invitation] = await db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.tokenHash, tokenHash),
          gt(workspaceInvitations.expiresAt, now)
        )
      )
      .limit(1);

    if (!invitation || invitation.acceptedAt !== null) {
      throw new NotFoundError("This invitation link is invalid, expired, or has already been used.");
    }

    // Check if user is already a member
    const [existingMembership] = await db
      .select()
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, invitation.workspaceId),
          eq(workspaceMemberships.userId, user.id)
        )
      )
      .limit(1);

    if (existingMembership) {
      // Mark accepted
      await db
        .update(workspaceInvitations)
        .set({ acceptedAt: now })
        .where(eq(workspaceInvitations.id, invitation.id));

      return NextResponse.json(
        {
          data: {
            workspaceId: invitation.workspaceId,
            role: existingMembership.role,
            message: "You are already a member of this workspace.",
          },
        },
        { status: 200 }
      );
    }

    // Atomically join workspace and mark invitation accepted
    await db.transaction(async (tx) => {
      await tx.insert(workspaceMemberships).values({
        id: generateId("wm"),
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role,
        joinedAt: now,
      });

      await tx
        .update(workspaceInvitations)
        .set({ acceptedAt: now })
        .where(eq(workspaceInvitations.id, invitation.id));
    });

    await logActivity({
      workspaceId: invitation.workspaceId,
      actorId: user.id,
      action: "MEMBER_JOINED",
      changeSummary: {
        userId: user.id,
        role: invitation.role,
      },
    });

    return NextResponse.json(
      {
        data: {
          workspaceId: invitation.workspaceId,
          role: invitation.role,
          message: "Successfully joined workspace.",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

