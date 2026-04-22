import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { requireWorkspaceMembership, AuthorizationPolicy } from "@/server/authorization/policies";
import { getWorkspaceActivities } from "@/server/services/audit";
import { createErrorResponse, ForbiddenError } from "@/server/errors/app-error";

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canViewAudit(membership.role)) {
      throw new ForbiddenError("You do not have permission to view workspace audit events.");
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 50;

    const activities = await getWorkspaceActivities(workspaceId, limit);

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

