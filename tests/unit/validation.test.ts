import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  createWorkspaceSchema,
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  inviteMemberSchema,
} from "@/server/validation";

describe("Validation Schemas (Unit)", () => {
  describe("Registration Schema", () => {
    it("should accept valid registration input", () => {
      const valid = {
        email: "alice@example.com",
        name: "Alice Smith",
        password: "StrongPassword1",
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("alice@example.com");
      }
    });

    it("should reject invalid email format", () => {
      const invalid = {
        email: "not-an-email",
        name: "Alice Smith",
        password: "StrongPassword1",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject short password (< 8 chars)", () => {
      const invalid = {
        email: "alice@example.com",
        name: "Alice",
        password: "short1",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject password without numbers", () => {
      const invalid = {
        email: "alice@example.com",
        name: "Alice",
        password: "NoNumbersPassword",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject unrecognized extra fields (strict schema)", () => {
      const withExtra = {
        email: "alice@example.com",
        name: "Alice",
        password: "StrongPassword1",
        role: "owner", // Privilege escalation attempt via payload injection
      };
      const result = registerSchema.safeParse(withExtra);
      expect(result.success).toBe(false);
    });
  });

  describe("Task Schemas", () => {
    it("should accept valid task creation payload", () => {
      const valid = {
        title: "Implement RBAC checks",
        description: "Enforce workspace-level boundaries",
        status: "in_progress",
        priority: "high",
        dueAt: new Date().toISOString(),
      };
      const result = createTaskSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject empty task title", () => {
      const empty = {
        title: "   ",
      };
      const result = createTaskSchema.safeParse(empty);
      expect(result.success).toBe(false);
    });

    it("should reject invalid task status", () => {
      const invalid = {
        title: "Fix bug",
        status: "completed_and_approved", // Not in enum
      };
      const result = createTaskSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid task priority", () => {
      const invalid = {
        title: "Fix bug",
        priority: "critical_emergency",
      };
      const result = createTaskSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid due date format", () => {
      const invalid = {
        title: "Fix bug",
        dueAt: "tomorrow morning",
      };
      const result = createTaskSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Task Query Pagination & Filters", () => {
    it("should parse and default query parameters", () => {
      const query = {};
      const parsed = taskQuerySchema.parse(query);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortBy).toBe("createdAt");
      expect(parsed.sortOrder).toBe("desc");
    });

    it("should reject excessive page limit (> 100)", () => {
      const query = { limit: "5000" };
      const result = taskQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it("should reject negative or zero page", () => {
      const query = { page: "0" };
      const result = taskQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  describe("Invitation Schema", () => {
    it("should accept valid member invitation", () => {
      const valid = {
        email: "colleague@team.com",
        role: "member",
      };
      const result = inviteMemberSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject inviting as owner directly", () => {
      const invalid = {
        email: "colleague@team.com",
        role: "owner", // Cannot invite directly as owner
      };
      const result = inviteMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

