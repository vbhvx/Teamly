import { describe, it, expect, beforeEach } from "vitest";
import { clearTestDatabase, makeRequest, createTestUser } from "../helpers/test-client";
import { POST as createWorkspaceHandler } from "@/app/api/v1/workspaces/route";
import {
  GET as getWorkspaceDetailHandler,
  PATCH as updateWorkspaceHandler,
  DELETE as deleteWorkspaceHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/route";
import {
  GET as getTasksHandler,
  POST as createTaskHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/tasks/route";
import {
  GET as getTaskDetailHandler,
  PATCH as updateTaskHandler,
  DELETE as deleteTaskHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/tasks/[taskId]/route";
import {
  PATCH as updateMemberRoleHandler,
  DELETE as removeMemberHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/members/[userId]/route";
import { db } from "@/db/client";
import { workspaceMemberships } from "@/db/schema";
import { generateId } from "@/lib/id";
import { eq, and } from "drizzle-orm";

describe("Required Security Test Suite (Section 7)", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  async function createWorkspaceWithRole(role: "owner" | "admin" | "member" | "viewer") {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const owner = await createTestUser({ email: `owner_${role}_${randomSuffix}@test.com`, name: "Workspace Owner" });
    const wsRes = await createWorkspaceHandler(
      makeRequest("http://localhost:3000/api/v1/workspaces", "POST", { name: `WS for ${role}` }, owner.token)
    );
    const workspaceId = (await wsRes.json()).data.id;

    if (role === "owner") {
      return { user: owner, workspaceId, owner };
    }

    const testUser = await createTestUser({ email: `user_${role}_${randomSuffix}@test.com`, name: `Test ${role}` });
    await db.insert(workspaceMemberships).values({
      id: generateId("wm"),
      workspaceId,
      userId: testUser.id,
      role,
    });

    return { user: testUser, workspaceId, owner };
  }

  // 1. User A cannot read User B's private workspace tasks without membership.
  it("Scenario 1: User A cannot read User B's private workspace tasks without membership", async () => {
    const userA = await createTestUser({ email: "user_a@test.com", name: "User A" });
    const { owner: userB, workspaceId } = await createWorkspaceWithRole("owner");

    // User B creates a task in private workspace
    const taskRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "Confidential roadmap",
      }, userB.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    const taskId = (await taskRes.json()).data.id;

    // User A attempts to list tasks in User B's workspace
    const listRes = await getTasksHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "GET", undefined, userA.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(listRes.status).toBe(404); // Intentional 404 to avoid leaking workspace presence

    // User A attempts to get task detail
    const getRes = await getTaskDetailHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, "GET", undefined, userA.token),
      { params: Promise.resolve({ workspaceId, taskId }) }
    );
    expect(getRes.status).toBe(404);
  });

  // 2. A Member cannot elevate themselves to Admin or Owner.
  it("Scenario 2: A Member cannot elevate themselves to Admin or Owner", async () => {
    const { user: memberUser, workspaceId } = await createWorkspaceWithRole("member");

    const elevateToAdminReq = makeRequest(
      `http://localhost:3000/api/v1/workspaces/${workspaceId}/members/${memberUser.id}`,
      "PATCH",
      { role: "admin" },
      memberUser.token
    );
    const adminRes = await updateMemberRoleHandler(elevateToAdminReq, {
      params: Promise.resolve({ workspaceId, userId: memberUser.id }),
    });
    expect(adminRes.status).toBe(403);

    const elevateToOwnerReq = makeRequest(
      `http://localhost:3000/api/v1/workspaces/${workspaceId}/members/${memberUser.id}`,
      "PATCH",
      { role: "owner" },
      memberUser.token
    );
    const ownerRes = await updateMemberRoleHandler(elevateToOwnerReq, {
      params: Promise.resolve({ workspaceId, userId: memberUser.id }),
    });
    expect(ownerRes.status).toBe(403);
  });

  // 3. A Viewer cannot create, update, or delete tasks.
  it("Scenario 3: A Viewer cannot create, update, or delete tasks", async () => {
    const { user: viewerUser, workspaceId, owner } = await createWorkspaceWithRole("viewer");

    // Owner creates a task
    const taskRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "Owner task",
      }, owner.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    const taskId = (await taskRes.json()).data.id;

    // Viewer tries to create a task -> 403
    const createRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "Viewer unauthorized task",
      }, viewerUser.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(createRes.status).toBe(403);

    // Viewer tries to update task -> 403
    const updateRes = await updateTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, "PATCH", {
        title: "Viewer tampered title",
      }, viewerUser.token),
      { params: Promise.resolve({ workspaceId, taskId }) }
    );
    expect(updateRes.status).toBe(403);

    // Viewer tries to delete task -> 403
    const deleteRes = await deleteTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, "DELETE", undefined, viewerUser.token),
      { params: Promise.resolve({ workspaceId, taskId }) }
    );
    expect(deleteRes.status).toBe(403);
  });

  // 4. A Member cannot modify a task outside their permitted scope.
  it("Scenario 4: A Member cannot modify a task outside their permitted scope", async () => {
    const { user: memberUser, workspaceId, owner } = await createWorkspaceWithRole("member");

    // Owner creates an unassigned task
    const taskRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "Owner-only task",
        assigneeId: null,
      }, owner.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    const taskId = (await taskRes.json()).data.id;

    // Member attempts to edit it -> 403 Forbidden
    const editRes = await updateTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, "PATCH", {
        title: "Hijacked task",
      }, memberUser.token),
      { params: Promise.resolve({ workspaceId, taskId }) }
    );
    expect(editRes.status).toBe(403);

    // Member attempts to delete it -> 403 Forbidden
    const delRes = await deleteTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, "DELETE", undefined, memberUser.token),
      { params: Promise.resolve({ workspaceId, taskId }) }
    );
    expect(delRes.status).toBe(403);
  });

  // 5. An Admin cannot perform owner-only actions when the policy reserves those actions for the Owner.
  it("Scenario 5: An Admin cannot perform owner-only actions (settings, deletion, sole owner demotion)", async () => {
    const { user: adminUser, workspaceId, owner } = await createWorkspaceWithRole("admin");

    // Admin attempts to rename workspace
    const updateWsRes = await updateWorkspaceHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}`, "PATCH", {
        name: "Admin renamed workspace",
      }, adminUser.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(updateWsRes.status).toBe(403);

    // Admin attempts to delete workspace
    const deleteWsRes = await deleteWorkspaceHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}`, "DELETE", undefined, adminUser.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(deleteWsRes.status).toBe(403);

    // Admin attempts to demote Owner
    const demoteOwnerRes = await updateMemberRoleHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/members/${owner.id}`, "PATCH", {
        role: "member",
      }, adminUser.token),
      { params: Promise.resolve({ workspaceId, userId: owner.id }) }
    );
    expect(demoteOwnerRes.status).toBe(403);
  });

  // 6. A user cannot assign a task to a user outside the workspace.
  it("Scenario 6: A user cannot assign a task to a user outside the workspace", async () => {
    const { user: owner, workspaceId } = await createWorkspaceWithRole("owner");
    const outsider = await createTestUser({ email: "unrelated@external.com" });

    const createRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
        title: "Illegal cross-workspace assignment",
        assigneeId: outsider.id,
      }, owner.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(createRes.status).toBe(422);
    const json = await createRes.json();
    expect(json.error.code).toBe("UNPROCESSABLE_ENTITY");
  });

  // 7. A removed member loses access on subsequent requests.
  it("Scenario 7: A removed member loses access on subsequent requests", async () => {
    const { user: memberUser, workspaceId, owner } = await createWorkspaceWithRole("member");

    // Verify member can view tasks
    const initialList = await getTasksHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "GET", undefined, memberUser.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(initialList.status).toBe(200);

    // Owner removes member
    const removeRes = await removeMemberHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/members/${memberUser.id}`, "DELETE", undefined, owner.token),
      { params: Promise.resolve({ workspaceId, userId: memberUser.id }) }
    );
    expect(removeRes.status).toBe(200);

    // Member attempts subsequent request -> 404 (concealed)
    const subsequentList = await getTasksHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "GET", undefined, memberUser.token),
      { params: Promise.resolve({ workspaceId }) }
    );
    expect(subsequentList.status).toBe(404);
  });

  // 8. Changing a resource ID cannot bypass authorization.
  it("Scenario 8: Changing a resource ID cannot bypass authorization (IDOR protection)", async () => {
    const ws1 = await createWorkspaceWithRole("owner");
    const ws2 = await createWorkspaceWithRole("owner");

    // Create task in WS2
    const taskRes = await createTaskHandler(
      makeRequest(`http://localhost:3000/api/v1/workspaces/${ws2.workspaceId}/tasks`, "POST", {
        title: "WS2 Secret Task",
      }, ws2.owner.token),
      { params: Promise.resolve({ workspaceId: ws2.workspaceId }) }
    );
    const ws2TaskId = (await taskRes.json()).data.id;

    // WS1 Owner attempts to modify WS2's task by substituting IDs
    const spoofReq = makeRequest(
      `http://localhost:3000/api/v1/workspaces/${ws1.workspaceId}/tasks/${ws2TaskId}`,
      "PATCH",
      { title: "IDOR overwrite attempt" },
      ws1.owner.token
    );
    const spoofRes = await updateTaskHandler(spoofReq, {
      params: Promise.resolve({ workspaceId: ws1.workspaceId, taskId: ws2TaskId }),
    });

    expect(spoofRes.status).toBe(404); // Task not found in WS1
  });

  // 9. Unauthenticated requests cannot access private workspace endpoints.
  it("Scenario 9: Unauthenticated requests cannot access private workspace endpoints", async () => {
    const { workspaceId } = await createWorkspaceWithRole("owner");

    const unauthReq = makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "GET");
    const unauthRes = await getTasksHandler(unauthReq, { params: Promise.resolve({ workspaceId }) });

    expect(unauthRes.status).toBe(401);
    const json = await unauthRes.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  // 10. Authorization failures do not leak sensitive records or unnecessary information.
  it("Scenario 10: Authorization failures do not leak sensitive records or unnecessary information", async () => {
    const userA = await createTestUser({ email: "unauthorized_tester@test.com" });
    const { workspaceId } = await createWorkspaceWithRole("owner");

    const req = makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}`, "GET", undefined, userA.token);
    const res = await getWorkspaceDetailHandler(req, { params: Promise.resolve({ workspaceId }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(json.data).toBeUndefined();
    expect(json.error.message).toBe("Workspace not found");
  });
});
