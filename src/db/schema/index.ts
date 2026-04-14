import {
  pgTable,
  text,
  varchar,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "blocked",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

// Users Table
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
  ]
);

// Sessions Table (Server-side session management with SHA-256 hashed tokens)
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ]
);

// Workspaces Table
export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("workspaces_created_by_idx").on(table.createdBy),
  ]
);

// Workspace Memberships Table
export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_memberships_ws_user_idx").on(table.workspaceId, table.userId),
    index("workspace_memberships_ws_idx").on(table.workspaceId),
    index("workspace_memberships_user_idx").on(table.userId),
    index("workspace_memberships_role_idx").on(table.workspaceId, table.role),
  ]
);

// Workspace Invitations Table
export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: workspaceRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_invitations_token_hash_idx").on(table.tokenHash),
    index("workspace_invitations_ws_email_idx").on(table.workspaceId, table.email),
  ]
);

// Tasks Table
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tasks_workspace_id_idx").on(table.workspaceId),
    index("tasks_ws_status_idx").on(table.workspaceId, table.status),
    index("tasks_ws_assignee_idx").on(table.workspaceId, table.assigneeId),
    index("tasks_ws_created_at_idx").on(table.workspaceId, table.createdAt),
    index("tasks_ws_due_at_idx").on(table.workspaceId, table.dueAt),
  ]
);

// Task Activity / Audit Trail Table
export const taskActivities = pgTable(
  "task_activities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: text("task_id"), // Can be null if audit event is workspace-level or task was deleted
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    changeSummary: jsonb("change_summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_activities_ws_idx").on(table.workspaceId),
    index("task_activities_task_idx").on(table.taskId),
    index("task_activities_created_at_idx").on(table.workspaceId, table.createdAt),
  ]
);

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMemberships),
  sessions: many(sessions),
  createdWorkspaces: many(workspaces),
  createdTasks: many(tasks),
  assignedTasks: many(tasks),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  creator: one(users, {
    fields: [workspaces.createdBy],
    references: [users.id],
  }),
  memberships: many(workspaceMemberships),
  invitations: many(workspaceInvitations),
  tasks: many(tasks),
  activities: many(taskActivities),
}));

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMemberships.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMemberships.userId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tasks.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  activities: many(taskActivities),
}));

export const taskActivitiesRelations = relations(taskActivities, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [taskActivities.workspaceId],
    references: [workspaces.id],
  }),
  task: one(tasks, {
    fields: [taskActivities.taskId],
    references: [tasks.id],
  }),
  actor: one(users, {
    fields: [taskActivities.actorId],
    references: [users.id],
  }),
}));

