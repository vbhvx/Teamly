# System Architecture: Teamly Secure Task Platform

## Overview
Teamly is built using a strict layered architecture to guarantee that security boundaries, input validation, role-based access control, and database invariants are enforced on every request before business logic executes.

```text
                       Client (Browser / Automated HTTP Client)
                                          │
                                          ▼
                            Next.js Middleware & Security
                                          │
                                          ▼
                             REST API v1 (/api/v1/*)
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
       Authentication Layer                        Rate Limiter Layer
  (Session Validation & CSRF)                     (IP & User Sliding Window)
                    │                                           │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                               Input Validation Layer
                                (Zod Runtime Schemas)
                                          │
                                          ▼
                             Authorization Service Layer
                            (Centralized RBAC & Policies)
                                          │
                                          ▼
                               Application Services
                             (Task, Workspace, Audit)
                                          │
                                          ▼
                             Database Abstraction (Drizzle)
                                          │
                                          ▼
                                PostgreSQL Database
                           (ACID Transactions, FKs, Indexes)
```

## Layers and Responsibilities

### 1. Presentation & Client Layer
- Next.js App Router (React 19, TypeScript, Tailwind CSS).
- Handles responsive UI state, optimistic feedback, and accessibility.
- Never serves as an authorization boundary. Frontend role checks only enhance UX by hiding non-executable controls.

### 2. HTTP Routing & API Layer (`/api/v1/*`)
- Versioned, structured REST endpoints.
- Uniform JSON resource responses (`{ data: ... }`).
- Standardized error envelope (`{ error: { code, message, details, requestId } }`).
- HTTP Status Code conventions: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`.

### 3. Authentication & Session Management
- Password hashing with bcrypt (12 rounds) or Argon2id.
- Cryptographically secure 256-bit session tokens (`crypto.randomBytes(32)`).
- Session tokens stored as SHA-256 hashes in database (`sessions` table) to prevent token exposure in database dumps.
- Browser cookies configured with `HttpOnly`, `SameSite=Lax`, `Secure` (in production), and `Path=/`.
- Dual client support: tokens supported via `teamly_session` cookie or `Authorization: Bearer <token>` header.
- CSRF defense on state-changing requests by validating origin and host headers.

### 4. Input Validation
- Server-side runtime validation using Zod for all query parameters, route parameters, and request bodies.
- Rejection of unexpected fields via strict schemas.
- Sanitization of emails and text fields.

### 5. Centralized Authorization Layer
- Evaluates workspace membership and current role (`owner`, `admin`, `member`, `viewer`).
- Single source of truth for permission checks (`canViewTask`, `canEditTask`, `canDeleteTask`, `canInviteMembers`, `canUpdateMemberRole`, `canRemoveMember`).
- Intentional 404 responses for unauthorized cross-workspace queries to avoid leaking private resource existence.

### 6. Persistence & Relational Integrity
- PostgreSQL with relational foreign key cascades and deletion restrictions.
- Unique constraints on emails, session token hashes, invitation token hashes, and `(workspaceId, userId)`.
- Targeted indexes on `(workspaceId, status)`, `(workspaceId, assigneeId)`, `(workspaceId, createdAt)`, and `(workspaceId, dueAt)`.
- ACID multi-record transactions for critical state transitions (e.g., workspace creation with ownership assignment, member deletion with task unassignment).

### 7. Audit Logging
- Structured immutable audit records in `task_activities` for task lifecycle events and workspace membership transitions.
- Automatic redaction of sensitive credentials, hashes, and session secrets.

