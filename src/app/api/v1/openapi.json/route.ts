import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// OpenAPI 3.0 Document in JSON
const openApiDoc = {
  openapi: "3.0.3",
  info: {
    title: "Teamly Secure Task Management API",
    description:
      "Production-grade REST API for secure team task management with isolated workspaces, explicit RBAC, and verified workflows.",
    version: "1.0.0",
  },
  servers: [{ url: "/api/v1", description: "API v1 Base URL" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "teamly_session",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
  },
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths: {
    "/auth/register": {
      post: {
        summary: "Register new user",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "name", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  name: { type: "string" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "User registered" },
          400: { description: "Validation error" },
          409: { description: "Account already exists" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Authenticate",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Successfully logged in" },
          401: { description: "Invalid email or password" },
        },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Logout and invalidate session",
        tags: ["Authentication"],
        responses: {
          200: { description: "Logged out" },
        },
      },
    },
    "/me": {
      get: {
        summary: "Get current user profile and workspaces",
        tags: ["User"],
        responses: {
          200: { description: "Current user and workspaces" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/workspaces": {
      get: {
        summary: "List user workspaces",
        tags: ["Workspaces"],
        responses: {
          200: { description: "List of workspaces" },
        },
      },
      post: {
        summary: "Create workspace",
        tags: ["Workspaces"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string" } },
              },
            },
          },
        },
        responses: {
          201: { description: "Workspace created" },
        },
      },
    },
    "/workspaces/{workspaceId}": {
      get: {
        summary: "Retrieve workspace details",
        tags: ["Workspaces"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Workspace retrieved" }, 404: { description: "Not found" } },
      },
      patch: {
        summary: "Update workspace (Owner only)",
        tags: ["Workspaces"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Updated" }, 403: { description: "Forbidden" } },
      },
      delete: {
        summary: "Delete workspace (Owner only)",
        tags: ["Workspaces"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" }, 403: { description: "Forbidden" } },
      },
    },
    "/workspaces/{workspaceId}/members": {
      get: {
        summary: "List workspace members",
        tags: ["Members"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Member list" } },
      },
    },
    "/workspaces/{workspaceId}/members/{userId}": {
      patch: {
        summary: "Change member role",
        tags: ["Members"],
        parameters: [
          { in: "path", name: "workspaceId", required: true, schema: { type: "string" } },
          { in: "path", name: "userId", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Role updated" }, 403: { description: "Forbidden" } },
      },
      delete: {
        summary: "Remove member or leave workspace",
        tags: ["Members"],
        parameters: [
          { in: "path", name: "workspaceId", required: true, schema: { type: "string" } },
          { in: "path", name: "userId", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Member removed" }, 403: { description: "Forbidden" } },
      },
    },
    "/workspaces/{workspaceId}/invitations": {
      get: {
        summary: "List pending invitations",
        tags: ["Invitations"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Pending invitations" } },
      },
      post: {
        summary: "Invite member to workspace",
        tags: ["Invitations"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Invited" } },
      },
    },
    "/invitations/accept": {
      post: {
        summary: "Accept invitation via token",
        tags: ["Invitations"],
        responses: { 200: { description: "Accepted" } },
      },
    },
    "/workspaces/{workspaceId}/tasks": {
      get: {
        summary: "List, search, filter and paginate tasks",
        tags: ["Tasks"],
        parameters: [
          { in: "path", name: "workspaceId", required: true, schema: { type: "string" } },
          { in: "query", name: "status", schema: { type: "string" } },
          { in: "query", name: "priority", schema: { type: "string" } },
          { in: "query", name: "assigneeId", schema: { type: "string" } },
          { in: "query", name: "search", schema: { type: "string" } },
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "Filtered paginated tasks" } },
      },
      post: {
        summary: "Create a task",
        tags: ["Tasks"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Task created" }, 403: { description: "Forbidden for viewers" } },
      },
    },
    "/workspaces/{workspaceId}/tasks/{taskId}": {
      get: {
        summary: "Get task details",
        tags: ["Tasks"],
        parameters: [
          { in: "path", name: "workspaceId", required: true, schema: { type: "string" } },
          { in: "path", name: "taskId", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Task details" }, 404: { description: "Not found" } },
      },
      patch: {
        summary: "Update task",
        tags: ["Tasks"],
        parameters: [
          { in: "path", name: "workspaceId", required: true, schema: { type: "string" } },
          { in: "path", name: "taskId", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Task updated" }, 403: { description: "Forbidden" } },
      },
      delete: {
        summary: "Delete task",
        tags: ["Tasks"],
        parameters: [
          { in: "path", name: "workspaceId", required: true, schema: { type: "string" } },
          { in: "path", name: "taskId", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Task deleted" }, 403: { description: "Forbidden" } },
      },
    },
    "/workspaces/{workspaceId}/tasks/{taskId}/activity": {
      get: {
        summary: "Get task audit history",
        tags: ["Audit"],
        parameters: [
          { in: "path", name: "workspaceId", required: true, schema: { type: "string" } },
          { in: "path", name: "taskId", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Audit activities" } },
      },
    },
    "/workspaces/{workspaceId}/activity": {
      get: {
        summary: "Get workspace activity stream",
        tags: ["Audit"],
        parameters: [{ in: "path", name: "workspaceId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Workspace activity log" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiDoc, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

