import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { workspaceMemberships, workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createErrorResponse } from "@/server/errors/app-error";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    // Fetch user's workspaces and roles
    const memberships = await db
      .select({
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        role: workspaceMemberships.role,
        joinedAt: workspaceMemberships.joinedAt,
      })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
      .where(eq(workspaceMemberships.userId, user.id));

    return NextResponse.json(
      {
        data: {
          user,
          workspaces: memberships,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

