import { describe, it, expect, beforeEach } from "vitest";
import { clearTestDatabase, makeRequest, createTestUser } from "../helpers/test-client";
import { POST as registerHandler } from "@/app/api/v1/auth/register/route";
import { POST as loginHandler } from "@/app/api/v1/auth/login/route";
import { POST as logoutHandler } from "@/app/api/v1/auth/logout/route";
import { GET as meHandler } from "@/app/api/v1/me/route";
import { GET as getWorkspacesHandler, POST as createWorkspaceHandler } from "@/app/api/v1/workspaces/route";
import { GET as getWorkspaceDetailHandler } from "@/app/api/v1/workspaces/[workspaceId]/route";
import { db } from "@/db/client";
import { users, sessions, workspaces, workspaceMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Authentication & Workspaces Integration", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe("User Registration", () => {
    it("should successfully register a user and set a session", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/auth/register", "POST", {
        name: "Charlie Brown",
        email: "charlie@example.com",
        password: "Password123",
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data.user.email).toBe("charlie@example.com");
      expect(json.data.user.name).toBe("Charlie Brown");
      expect(json.data.user.passwordHash).toBeUndefined(); // never expose passwordHash
      expect(json.data.token).toBeDefined();

      // Verify user in DB
      const [dbUser] = await db.select().from(users).where(eq(users.email, "charlie@example.com"));
      expect(dbUser).toBeDefined();
      expect(dbUser.passwordHash).not.toBe("Password123"); // hashed!
    });

    it("should reject duplicate email with 409 Conflict", async () => {
      await createTestUser({ email: "duplicate@example.com" });

      const req = makeRequest("http://localhost:3000/api/v1/auth/register", "POST", {
        name: "Second User",
        email: "duplicate@example.com",
        password: "Password123",
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("CONFLICT");
    });
  });

  describe("Login and Session Validation", () => {
    it("should authenticate valid credentials and issue a session token", async () => {
      await createTestUser({ email: "login@example.com", password: "SecretPassword1" });

      const req = makeRequest("http://localhost:3000/api/v1/auth/login", "POST", {
        email: "login@example.com",
        password: "SecretPassword1",
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.token).toBeDefined();
      expect(json.data.user.email).toBe("login@example.com");
    });

    it("should reject invalid password with generic 401 error", async () => {
      await createTestUser({ email: "login@example.com", password: "SecretPassword1" });

      const req = makeRequest("http://localhost:3000/api/v1/auth/login", "POST", {
        email: "login@example.com",
        password: "WrongPassword1",
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.message).toBe("Invalid email or password.");
    });

    it("should reject non-existent user with generic 401 error (no email enumeration)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/auth/login", "POST", {
        email: "nonexistent@example.com",
        password: "Password123",
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.message).toBe("Invalid email or password.");
    });
  });

  describe("Logout and Session Invalidation", () => {
    it("should invalidate the session in DB upon logout", async () => {
      const user = await createTestUser({ email: "logout@example.com" });

      // Check session valid before logout
      const meReq1 = makeRequest("http://localhost:3000/api/v1/me", "GET", undefined, user.token);
      const meRes1 = await meHandler(meReq1);
      expect(meRes1.status).toBe(200);

      // Perform logout
      const logoutReq = makeRequest("http://localhost:3000/api/v1/auth/logout", "POST", undefined, user.token);
      const logoutRes = await logoutHandler(logoutReq);
      expect(logoutRes.status).toBe(200);

      // Verify subsequent request with invalidated token returns 401
      const meReq2 = makeRequest("http://localhost:3000/api/v1/me", "GET", undefined, user.token);
      const meRes2 = await meHandler(meReq2);
      expect(meRes2.status).toBe(401);
    });
  });

  describe("Workspace Creation and Membership", () => {
    it("should create a workspace, establish owner membership, and allow owner access", async () => {
      const user = await createTestUser({ email: "owner@example.com" });

      const createWsReq = makeRequest("http://localhost:3000/api/v1/workspaces", "POST", {
        name: "Product Design",
      }, user.token);

      const createWsRes = await createWorkspaceHandler(createWsReq);
      expect(createWsRes.status).toBe(201);

      const wsJson = await createWsRes.json();
      expect(wsJson.data.name).toBe("Product Design");
      expect(wsJson.data.role).toBe("owner");
      const workspaceId = wsJson.data.id;

      // Verify membership record in database
      const [membership] = await db
        .select()
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.workspaceId, workspaceId));

      expect(membership.userId).toBe(user.id);
      expect(membership.role).toBe("owner");

      // Verify workspace details endpoint
      const getWsReq = makeRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}`, "GET", undefined, user.token);
      const getWsRes = await getWorkspaceDetailHandler(getWsReq, { params: Promise.resolve({ workspaceId }) });
      expect(getWsRes.status).toBe(200);
      const getWsJson = await getWsRes.json();
      expect(getWsJson.data.currentUserRole).toBe("owner");
    });
  });
});

