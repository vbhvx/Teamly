import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { db } from "@/db/client";
import { workspaceInvitations, workspaceMemberships, users } from "@/db/schema";
import { requireWorkspaceMembership, AuthorizationPolicy } from "@/server/authorization/policies";
import { inviteMemberSchema } from "@/server/validation";
import {
  createErrorResponse,
  ForbiddenError,
  ConflictError,
  RateLimitError,
} from "@/server/errors/app-error";
import { generateId } from "@/lib/id";
import { hashToken } from "@/server/auth/session";
import { logActivity } from "@/server/services/audit";
import { rateLimiter } from "@/server/auth/rate-limiter";
import crypto from "crypto";
import { eq, and, gt, desc } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canInviteMembers(membership.role)) {
      throw new ForbiddenError("Only workspace owners and admins can view pending invitations.");
    }

    const now = new Date();
    const invitations = await db
      .select({
        id: workspaceInvitations.id,
        email: workspaceInvitations.email,
        role: workspaceInvitations.role,
        expiresAt: workspaceInvitations.expiresAt,
        createdAt: workspaceInvitations.createdAt,
        createdBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(workspaceInvitations)
      .innerJoin(users, eq(workspaceInvitations.createdBy, users.id))
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          gt(workspaceInvitations.expiresAt, now)
        )
      )
      .orderBy(desc(workspaceInvitations.createdAt));

    return NextResponse.json(
      {
        data: invitations,
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

    // Rate limit invitation creation
    const rateCheck = rateLimiter.check(`invite:${user.id}`, 20, 60000);
    if (!rateCheck.allowed) {
      throw new RateLimitError();
    }

    const membership = await requireWorkspaceMembership(workspaceId, user.id);

    if (!AuthorizationPolicy.canInviteMembers(membership.role)) {
      throw new ForbiddenError("Only workspace owners and admins can invite members.");
    }

    const body = await req.json();
    const validated = inviteMemberSchema.parse(body);

    // Check if user with this email is already a member
    const existingMember = await db
      .select({ id: workspaceMemberships.id })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(users.email, validated.email)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw new ConflictError("A user with this email is already a member of this workspace.");
    }

    // Generate secure random secret token
    const rawSecretToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = hashToken(rawSecretToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const invitationId = generateId("inv");

    await db.insert(workspaceInvitations).values({
      id: invitationId,
      workspaceId,
      email: validated.email,
      role: validated.role,
      tokenHash,
      expiresAt,
      createdBy: user.id,
      createdAt: new Date(),
    });

    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "MEMBER_INVITED",
      changeSummary: {
        email: validated.email,
        role: validated.role,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: invitationId,
          workspaceId,
          email: validated.email,
          role: validated.role,
          expiresAt,
          invitationToken: rawSecretToken, // Returned so caller can send link or use in test
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

