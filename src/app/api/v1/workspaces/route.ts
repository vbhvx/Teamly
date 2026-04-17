import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { workspaces, workspaceMemberships, users } from "@/db/schema";
import { createWorkspaceSchema } from "@/server/validation";
import { createErrorResponse } from "@/server/errors/app-error";
import { generateId } from "@/lib/id";
import { logActivity } from "@/server/services/audit";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    const userWorkspaces = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: workspaceMemberships.role,
        createdBy: workspaces.createdBy,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
      .where(eq(workspaceMemberships.userId, user.id))
      .orderBy(desc(workspaces.createdAt));

    return NextResponse.json(
      {
        data: userWorkspaces,
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    const body = await req.json();
    const validated = createWorkspaceSchema.parse(body);

    const workspaceId = generateId("ws");
    const membershipId = generateId("wm");

    // Atomically create workspace and add user as Owner
    const newWorkspace = await db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({
          id: workspaceId,
          name: validated.name,
          createdBy: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      await tx.insert(workspaceMemberships).values({
        id: membershipId,
        workspaceId: ws.id,
        userId: user.id,
        role: "owner",
        joinedAt: new Date(),
      });

      return ws;
    });

    await logActivity({
      workspaceId: newWorkspace.id,
      actorId: user.id,
      action: "WORKSPACE_CREATED",
      changeSummary: { name: newWorkspace.name },
    });

    return NextResponse.json(
      {
        data: {
          ...newWorkspace,
          role: "owner",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

