import { describe, it, expect, beforeEach } from "vitest";
import { clearTestDatabase, makeRequest, createTestUser } from "../helpers/test-client";
import { POST as createWorkspaceHandler } from "@/app/api/v1/workspaces/route";
import { GET as getTasksHandler, POST as createTaskHandler } from "@/app/api/v1/workspaces/[workspaceId]/tasks/route";
import {
  GET as getTaskDetailHandler,
  PATCH as updateTaskHandler,
  DELETE as deleteTaskHandler,
} from "@/app/api/v1/workspaces/[workspaceId]/tasks/[taskId]/route";
import { GET as getTaskActivityHandler } from "@/app/api/v1/workspaces/[workspaceId]/tasks/[taskId]/activity/route";
import { db } from "@/db/client";
import { workspaceMemberships, tasks, taskActivities } from "@/db/schema";
import { generateId } from "@/lib/id";
import { eq } from "drizzle-orm";

describe("Task Workflow & Auditing Integration", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  async function setupWorkspaceAndUsers() {
    const owner = await createTestUser({ email: "owner@work.com", name: "Alice Owner" });
    const member = await createTestUser({ email: "member@work.com", name: "Bob Member" });
    const outsider = await createTestUser({ email: "outsider@other.com", name: "Eve Outsider" });

    // Create workspace
    const wsReq = makeRequest("http://localhost:3000/api/v1/workspaces", "POST", { name: "Dev Team" }, owner.token);
    const wsRes = await createWorkspaceHandler(wsReq);
    const wsJson = await wsRes.json();
    const workspaceId = wsJson.data.id;

    // Add Bob as member
    await db.insert(workspaceMemberships).values({
      id: generateId("wm"),
      workspaceId,
      userId: member.id,
      role: "member",
    });

    return { owner, member, outsider, workspaceId };
  }

  describe("Task Creation and Assignment Validation", () => {
    it("should allow a workspace member to create and assign a task to another workspace member", async () => {
      const { owner, member, workspaceId } = await setupWorkspaceAndUsers();

      const taskReq = makeRequest(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`,
        "POST",
        {
          title: "Write integration tests",
          description: "Cover all critical flows",
          priority: "high",
          status: "todo",
          assigneeId: member.id,
        },
        owner.token
      );

      const taskRes = await createTaskHandler(taskReq, { params: Promise.resolve({ workspaceId }) });
      expect(taskRes.status).toBe(201);

      const taskJson = await taskRes.json();
      expect(taskJson.data.title).toBe("Write integration tests");
      expect(taskJson.data.assigneeId).toBe(member.id);
      expect(taskJson.data.createdBy).toBe(owner.id);

      // Verify audit trail record was inserted
      const activities = await db
        .select()
        .from(taskActivities)
        .where(eq(taskActivities.taskId, taskJson.data.id));

      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].action).toBe("TASK_CREATED");
    });

    it("should reject assigning a task to an outsider user not in the workspace (422 Unprocessable)", async () => {
      const { owner, outsider, workspaceId } = await setupWorkspaceAndUsers();

      const taskReq = makeRequest(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`,
        "POST",
        {
          title: "Leaked Task",
          assigneeId: outsider.id, // Eve is not a member of this workspace
        },
        owner.token
      );

      const taskRes = await createTaskHandler(taskReq, { params: Promise.resolve({ workspaceId }) });
      expect(taskRes.status).toBe(422);

      const json = await taskRes.json();
      expect(json.error.code).toBe("UNPROCESSABLE_ENTITY");
    });
  });

  describe("Task Filtering and Pagination", () => {
    it("should filter by status, priority, and paginate accurately", async () => {
      const { owner, workspaceId } = await setupWorkspaceAndUsers();

      // Create 3 tasks with different statuses and priorities
      await createTaskHandler(
        makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
          title: "Task 1",
          status: "todo",
          priority: "low",
        }, owner.token),
        { params: Promise.resolve({ workspaceId }) }
      );

      await createTaskHandler(
        makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
          title: "Task 2",
          status: "in_progress",
          priority: "urgent",
        }, owner.token),
        { params: Promise.resolve({ workspaceId }) }
      );

      await createTaskHandler(
        makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
          title: "Task 3",
          status: "in_progress",
          priority: "high",
        }, owner.token),
        { params: Promise.resolve({ workspaceId }) }
      );

      // Filter by status=in_progress
      const listReq = makeRequest(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks?status=in_progress&limit=10&page=1`,
        "GET",
        undefined,
        owner.token
      );
      const listRes = await getTasksHandler(listReq, { params: Promise.resolve({ workspaceId }) });
      expect(listRes.status).toBe(200);

      const listJson = await listRes.json();
      expect(listJson.data.length).toBe(2);
      expect(listJson.pagination.total).toBe(2);
      expect(listJson.pagination.page).toBe(1);
    });
  });

  describe("Task State Transitions and Audit Logging", () => {
    it("should update task status and track changes in audit history", async () => {
      const { owner, workspaceId } = await setupWorkspaceAndUsers();

      const createRes = await createTaskHandler(
        makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
          title: "Refactor database layer",
          status: "todo",
        }, owner.token),
        { params: Promise.resolve({ workspaceId }) }
      );
      const taskId = (await createRes.json()).data.id;

      // Update status to in_progress
      const updateReq = makeRequest(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
        "PATCH",
        { status: "in_progress" },
        owner.token
      );
      const updateRes = await updateTaskHandler(updateReq, { params: Promise.resolve({ workspaceId, taskId }) });
      expect(updateRes.status).toBe(200);
      const updatedJson = await updateRes.json();
      expect(updatedJson.data.status).toBe("in_progress");

      // Verify task audit history endpoint
      const auditReq = makeRequest(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}/activity`,
        "GET",
        undefined,
        owner.token
      );
      const auditRes = await getTaskActivityHandler(auditReq, { params: Promise.resolve({ workspaceId, taskId }) });
      expect(auditRes.status).toBe(200);

      const auditJson = await auditRes.json();
      const actions = auditJson.data.map((a: any) => a.action);
      expect(actions).toContain("STATUS_CHANGED");
      expect(actions).toContain("TASK_UPDATED");
    });

    it("should record audit log when a task is deleted", async () => {
      const { owner, workspaceId } = await setupWorkspaceAndUsers();

      const createRes = await createTaskHandler(
        makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, "POST", {
          title: "Ephemeral task",
        }, owner.token),
        { params: Promise.resolve({ workspaceId }) }
      );
      const taskId = (await createRes.json()).data.id;

      // Delete task
      const delReq = makeRequest(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
        "DELETE",
        undefined,
        owner.token
      );
      const delRes = await deleteTaskHandler(delReq, { params: Promise.resolve({ workspaceId, taskId }) });
      expect(delRes.status).toBe(200);

      // Verify task is gone
      const getReq = makeRequest(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
        "GET",
        undefined,
        owner.token
      );
      const getRes = await getTaskDetailHandler(getReq, { params: Promise.resolve({ workspaceId, taskId }) });
      expect(getRes.status).toBe(404);
    });
  });
});

