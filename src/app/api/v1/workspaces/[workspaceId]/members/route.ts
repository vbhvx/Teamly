import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { workspaceMemberships, users } from "@/db/schema";
import { requireWorkspaceMembership, AuthorizationPolicy } from "@/server/authorization/policies";
import { createErrorResponse, ForbiddenError } from "@/server/errors/app-error";
import { eq, desc } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canViewMembers(membership.role)) {
      throw new ForbiddenError("You are not permitted to view workspace members.");
    }

    const members = await db
      .select({
        id: workspaceMemberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: workspaceMemberships.role,
        joinedAt: workspaceMemberships.joinedAt,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(eq(workspaceMemberships.workspaceId, workspaceId))
      .orderBy(desc(workspaceMemberships.joinedAt));

    return NextResponse.json(
      {
        data: members,
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

