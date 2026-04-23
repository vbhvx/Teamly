import { db, pool } from "./client";
import { users, workspaces, workspaceMemberships, tasks, taskActivities } from "./schema";
import { hashPassword } from "../server/auth/session";
import { generateId } from "../lib/id";
import * as dotenv from "dotenv";

dotenv.config();

async function seed() {
  console.log("Seeding initial database records...");

  const passwordHash = await hashPassword("Password123");

  // 1. Create Users
  const ownerId = generateId("usr");
  const adminId = generateId("usr");
  const memberId = generateId("usr");
  const viewerId = generateId("usr");

  await db.insert(users).values([
    {
      id: ownerId,
      name: "Olivia Owner",
      email: "owner@teamly.dev",
      passwordHash,
    },
    {
      id: adminId,
      name: "Adam Admin",
      email: "admin@teamly.dev",
      passwordHash,
    },
    {
      id: memberId,
      name: "Marcus Member",
      email: "member@teamly.dev",
      passwordHash,
    },
    {
      id: viewerId,
      name: "Valerie Viewer",
      email: "viewer@teamly.dev",
      passwordHash,
    },
  ]).onConflictDoNothing();

  // 2. Create Workspace
  const workspaceId = generateId("ws");
  await db.insert(workspaces).values({
    id: workspaceId,
    name: "Acme Product Core",
    createdBy: ownerId,
  });

  // 3. Add Memberships
  await db.insert(workspaceMemberships).values([
    {
      id: generateId("wm"),
      workspaceId,
      userId: ownerId,
      role: "owner",
    },
    {
      id: generateId("wm"),
      workspaceId,
      userId: adminId,
      role: "admin",
    },
    {
      id: generateId("wm"),
      workspaceId,
      userId: memberId,
      role: "member",
    },
    {
      id: generateId("wm"),
      workspaceId,
      userId: viewerId,
      role: "viewer",
    },
  ]);

  // 4. Create Sample Tasks
  const task1Id = generateId("task");
  const task2Id = generateId("task");
  const task3Id = generateId("task");
  const task4Id = generateId("task");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await db.insert(tasks).values([
    {
      id: task1Id,
      workspaceId,
      title: "Enforce strict session token hashing",
      description: "Hash all session tokens with SHA-256 before database insertion.",
      status: "done",
      priority: "high",
      createdBy: ownerId,
      assigneeId: memberId,
      dueAt: yesterday,
    },
    {
      id: task2Id,
      workspaceId,
      title: "Add rate limiting to login and registration",
      description: "Prevent brute force enumeration with sliding window counter.",
      status: "in_progress",
      priority: "urgent",
      createdBy: adminId,
      assigneeId: memberId,
      dueAt: tomorrow,
    },
    {
      id: task3Id,
      workspaceId,
      title: "Write authorization policy integration tests",
      description: "Ensure Viewers cannot create/edit tasks and Members cannot hijack unassigned tasks.",
      status: "todo",
      priority: "medium",
      createdBy: memberId,
      assigneeId: adminId,
      dueAt: null,
    },
    {
      id: task4Id,
      workspaceId,
      title: "Verify OpenAPI 3.0 documentation matches API handlers",
      description: "Ensure response envelopes and error structures match real responses.",
      status: "blocked",
      priority: "low",
      createdBy: ownerId,
      assigneeId: null,
      dueAt: null,
    },
  ]);

  // 5. Add Sample Audit Activity
  await db.insert(taskActivities).values([
    {
      id: generateId("act"),
      workspaceId,
      taskId: task1Id,
      actorId: ownerId,
      action: "TASK_CREATED",
      changeSummary: { title: "Enforce strict session token hashing", status: "todo" },
    },
    {
      id: generateId("act"),
      workspaceId,
      taskId: task1Id,
      actorId: memberId,
      action: "STATUS_CHANGED",
      changeSummary: { from: "in_progress", to: "done" },
    },
  ]);

  console.log("Seeding complete! Sample accounts created:");
  console.log("  Owner:  owner@teamly.dev  (Password123)");
  console.log("  Admin:  admin@teamly.dev  (Password123)");
  console.log("  Member: member@teamly.dev (Password123)");
  console.log("  Viewer: viewer@teamly.dev (Password123)");
}

seed()
  .catch((e) => console.error("Seeding failed", e))
  .finally(() => pool.end());

