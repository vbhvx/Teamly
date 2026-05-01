import { describe, it, expect, beforeEach } from "vitest";
import { clearTestDatabase, makeRequest } from "../helpers/test-client";
import { POST as registerHandler } from "@/app/api/v1/auth/register/route";
import { POST as loginHandler } from "@/app/api/v1/auth/login/route";
import { POST as logoutHandler } from "@/app/api/v1/auth/logout/route";
import { GET as meHandler } from "@/app/api/v1/me/route";
import { POST as createWorkspaceHandler } from "@/app/api/v1/workspaces/route";
import {
  GET as getTasksHandler,
  POST as createTaskHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/tasks/route";
import {
  GET as getTaskDetailHandler,
  PATCH as updateTaskHandler,
  DELETE as deleteTaskHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/tasks/[taskId]/route";
import { POST as createInvitationHandler } from "@/app/api/v1/workspaces/[workspaceId]/invitations/route";
import { POST as acceptInvitationHandler } from "@/app/api/v1/invitations/accept/route";
import {
  PATCH as updateMemberRoleHandler,
  DELETE as removeMemberHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/members/[userId]/route";

describe("Complete End-to-End User Journey (Section 11)", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it("should execute the full 10-step lifecycle journey end-to-end", async () => {
    // 1. A user registers and logs in
    const regRes = await registerHandler(
      makeRequest("http://localhost:3000/api/v1/auth/register", "POST", {
        name: "Alice Founder",
        email: "alice@startup.io",
        password: "MasterPassword123",
      })
    );
    expect(regRes.status).toBe(201);
    const ownerToken = (await regRes.json()).data.token;

    const loginRes = await loginHandler(
      makeRequest("http://localhost:3000/api/v1/auth/login", "POST", {
        email: "alice@startup.io",
        password: "MasterPassword123",
      })
    );
    expect(loginRes.status).toBe(200);

    // 2. The user creates a workspace
    const wsRes = await createWorkspaceHandler(
      makeRequest("http://localhost:3000/api/v1/workspaces", "POST", {
        name: "Acme Product Sprint",
      }, ownerToken)
    );
    expect(wsRes.status).toBe(201);
    const workspaceId = (await wsRes.json()).data.id;

    // Register a second user (Bob)
    const bobRegRes = await registerHandler(
      makeRequest("http://localhost:3000/api/v1/auth/register", "POST", {
        name: "Bob Engineer",
        email: "bob@startup.io",
        password: "MasterPassword123",
      })
    );
    const bobToken = (await bobRegRes.json()).data.token;
    const bobMeRes = await meHandler(makeRequest("http://localhost:3000/api/v1/me", "GET", undefined, bobToken));
    const bobUserId = (await bobMeRes.json()).data.user.id;

    // 4. An invited team member joins the workspace
    // Alice invites Bob as Member
    const inviteRes = await createInvitationHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/invitations`, "POST", {
        email: "bob@startup.io",
        role: "member",
      }, ownerToken),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(inviteRes.status).toBe(201);
    const inviteToken = (await inviteRes.json()).data.invitationToken;

    // Bob accepts invitation
    const acceptRes = await acceptInvitationHandler(
      makeRequest("http://localhost:3000/api/v1/invitations/accept", "POST", {
        token: inviteToken,
      }, bobToken)
    );
    expect(acceptRes.status).toBe(200);

    // 3. The owner creates and assigns a task to Bob
    const createTaskRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "Setup CI/CD pipeline",
        description: "Configure GitHub Actions and Playwright tests",
        status: "todo",
        priority: "high",
        assigneeId: bobUserId,
      }, ownerToken),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(createTaskRes.status).toBe(201);
    const taskId = (await createTaskRes.json()).data.id;

    // 5. The member (Bob) performs permitted task operations (updating status of his assigned task)
    const bobUpdateRes = await updateTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, "PATCH", {
        status: "in_progress",
      }, bobToken),
      { params: Promise.resolve({ workspaceId, taskId }) }
    );
    expect(bobUpdateRes.status).toBe(200);
    expect((await bobUpdateRes.json()).data.status).toBe("in_progress");

    // 6. The member is denied a prohibited operation (e.g. attempting to rename workspace or elevate role)
    const bobElevateRes = await updateMemberRoleHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/members/${bobUserId}`, "PATCH", {
        role: "owner",
      }, bobToken),
      { params: Promise.resolve({ workspaceId, userId: bobUserId }) }
    );
    expect(bobElevateRes.status).toBe(403);

    // Register a third user (Charlie - Viewer)
    const charlieRegRes = await registerHandler(
      makeRequest("http://localhost:3000/api/v1/auth/register", "POST", {
        name: "Charlie Auditor",
        email: "charlie@audit.io",
        password: "MasterPassword123",
      })
    );
    const charlieToken = (await charlieRegRes.json()).data.token;

    // Alice invites Charlie as Viewer
    const charlieInviteRes = await createInvitationHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/invitations`, "POST", {
        email: "charlie@audit.io",
        role: "viewer",
      }, ownerToken),
      { params: Promise.resolve({ workspaceId }) }
    );
    const charlieInviteToken = (await charlieInviteRes.json()).data.invitationToken;

    await acceptInvitationHandler(
      makeRequest("http://localhost:3000/api/v1/invitations/accept", "POST", {
        token: charlieInviteToken,
      }, charlieToken)
    );

    // 7. A Viewer can read permitted tasks but cannot change them
    const viewerReadRes = await getTasksHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "GET", undefined, charlieToken),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(viewerReadRes.status).toBe(200);

    const viewerWriteRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "Viewer unauthorized task",
      }, charlieToken),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(viewerWriteRes.status).toBe(403);

    // 8. A removed member loses access
    const removeBobRes = await removeMemberHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/members/${bobUserId}`, "DELETE", undefined, ownerToken),
      { params: Promise.resolve({ workspaceId, userId: bobUserId }) }
    );
    expect(removeBobRes.status).toBe(200);

    // Bob can no longer view or access the workspace
    const bobAccessAfterRemoval = await getTasksHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "GET", undefined, bobToken),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(bobAccessAfterRemoval.status).toBe(404);

    // 9. Invalid form submissions display useful feedback
    const invalidTaskRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "", // empty title
      }, ownerToken),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(invalidTaskRes.status).toBe(400);
    const invalidJson = await invalidTaskRes.json();
    expect(invalidJson.error.code).toBe("VALIDATION_ERROR");

    // 10. Logout invalidates the protected session
    const logoutRes = await logoutHandler(
      makeRequest("http://localhost:3000/api/v1/auth/logout", "POST", undefined, ownerToken)
    );
    expect(logoutRes.status).toBe(200);

    const postLogoutAccess = await meHandler(
      makeRequest("http://localhost:3000/api/v1/me", "GET", undefined, ownerToken)
    );
    expect(postLogoutAccess.status).toBe(401);
  });
});

