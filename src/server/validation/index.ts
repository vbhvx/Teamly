import { z } from "zod";

// Password regex: minimum 8 characters, at least one letter and one digit
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must not exceed 100 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address")
      .max(255, "Email is too long"),
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters"),
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z.string().min(1, "Password is required").max(100),
  })
  .strict();

export const createWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Workspace name must be at least 2 characters")
      .max(100, "Workspace name cannot exceed 100 characters"),
  })
  .strict();

export const updateWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Workspace name must be at least 2 characters")
      .max(100, "Workspace name cannot exceed 100 characters"),
  })
  .strict();

export const inviteMemberSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address")
      .max(255),
    role: z.enum(["admin", "member", "viewer"], {
      errorMap: () => ({ message: "Role must be admin, member, or viewer" }),
    }),
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(16, "Invalid invitation token"),
  })
  .strict();

export const updateMemberRoleSchema = z
  .object({
    role: z.enum(["owner", "admin", "member", "viewer"], {
      errorMap: () => ({ message: "Role must be owner, admin, member, or viewer" }),
    }),
  })
  .strict();

export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done"], {
  errorMap: () => ({ message: "Invalid status. Allowed values: todo, in_progress, blocked, done" }),
});

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"], {
  errorMap: () => ({ message: "Invalid priority. Allowed values: low, medium, high, urgent" }),
});

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title cannot exceed 200 characters"),
    description: z
      .string()
      .max(5000, "Description cannot exceed 5000 characters")
      .nullable()
      .optional(),
    status: taskStatusSchema.default("todo").optional(),
    priority: taskPrioritySchema.default("medium").optional(),
    assigneeId: z.string().nullable().optional(),
    dueAt: z
      .string()
      .datetime({ message: "dueAt must be a valid ISO 8601 datetime string" })
      .nullable()
      .optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title cannot exceed 200 characters")
      .optional(),
    description: z
      .string()
      .max(5000, "Description cannot exceed 5000 characters")
      .nullable()
      .optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().nullable().optional(),
    dueAt: z
      .string()
      .datetime({ message: "dueAt must be a valid ISO 8601 datetime string" })
      .nullable()
      .optional(),
  })
  .strict();

export const taskQuerySchema = z
  .object({
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().optional(),
    search: z.string().max(100).optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1, "Page must be at least 1")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100")),
    sortBy: z.enum(["createdAt", "dueAt", "priority", "status", "title"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;

