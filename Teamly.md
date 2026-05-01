# Technical Specification: Secure Team Task Management Platform

**Project Type:** Full-Stack Web Application  
**Primary Focus:** Secure Authentication, Authorization, Task Workflows, Input Validation, API Design, and Testing  
**Target Users:** Small teams, project collaborators, and workspace administrators  
**Engineering Goal:** Build a production-oriented task-management application with explicit security boundaries, reliable task workflows, consistent API contracts, and maintainable architecture.

## 1. Objective

Design and implement a secure task-management platform for small teams that need to organize work without exposing sensitive task data or relying on inconsistent access-control logic.

The application must provide a complete workflow for managing users, workspaces, membership, tasks, assignments, and task status transitions. Every operation that reads or changes protected data must be authenticated, authorized, validated, and tested.

The central engineering challenge is not simply creating CRUD operations. It is ensuring that **every request is permitted, every input is validated, every state change is consistent, and every API response follows a documented contract.**

The finished application should demonstrate practical competence in full-stack engineering, backend security, database design, API development, integration testing, and production readiness.

## 2. Core Requirements

The application must include:

1. Secure user authentication and session management.
2. Workspace-based data isolation.
3. Explicit role-based access control.
4. Task creation, assignment, editing, status changes, and deletion.
5. Server-side validation of all untrusted input.
6. Documented and versioned REST APIs.
7. Consistent error handling and appropriate HTTP status codes.
8. Automated tests covering successful operations, invalid input, and unauthorized access.
9. Security-conscious logging, configuration, and deployment practices.
10. A responsive interface that communicates task state and permission boundaries clearly.

Do not treat a hidden frontend button as an authorization mechanism. The backend must enforce every security rule independently of the client.

## 3. Product Scope

### 3.1 Authentication

Users should be able to register, log in, log out, and retrieve their current account details.

Implement authentication using a well-maintained authentication library or framework-supported solution. Do not create custom password cryptography or token-generation schemes.

Requirements:

- Hash passwords with a recognized password-hashing algorithm such as Argon2id or an appropriately configured bcrypt implementation.
- Never store plaintext passwords or return password hashes in API responses.
- Use secure session management with appropriate session expiration and invalidation.
- For browser-based authentication, prefer appropriately configured `HttpOnly`, `Secure`, and `SameSite` cookies.
- Apply CSRF protection where required by the chosen authentication architecture.
- Rate-limit authentication-sensitive endpoints.
- Return generic login failures that do not reveal whether an account exists.
- Provide logout and session invalidation behavior.
- Validate account identifiers and all authentication inputs on the server.
- Avoid storing session secrets or long-lived credentials in browser local storage.

For OAuth or a third-party identity provider, use its documented authorization flow and callback validation rather than implementing an improvised flow.

### 3.2 Workspaces and Membership

Each workspace represents a team whose data must remain isolated from other teams.

A user can belong to multiple workspaces, with a role assigned separately within each workspace.

Initial roles:

| Role | Permissions |
|---|---|
| Owner | Manage workspace settings, members, roles, and all workspace tasks |
| Admin | Manage members and workspace tasks, subject to owner-only restrictions |
| Member | View workspace tasks and manage tasks permitted by the task-level rules |
| Viewer | Read permitted workspace data without modifying it |

Define task-level permissions explicitly rather than assuming that every workspace member can edit every task.

For example, a Member may create tasks and edit tasks they created or are assigned to, while an Admin may manage all workspace tasks. Viewers remain read-only.

The final policy must specify who may assign tasks, change task ownership, delete tasks, invite members, modify roles, and remove members.

Security requirements:

- Every workspace-protected request must verify current membership.
- Membership roles must be checked on the server.
- A user's role in one workspace must not grant permissions in another.
- Users must not access private workspace data by changing a workspace ID in a URL or request body.
- Prevent removal or demotion of the final workspace Owner unless a valid ownership-transfer flow has completed.
- Invitations must use expiring, securely generated tokens and must not grant membership until properly accepted.

### 3.3 Task Management

Each task should support:

- Title
- Description
- Status
- Priority
- Creator
- Assignee
- Workspace
- Due date
- Creation and update timestamps

Recommended initial status values:

`todo`, `in_progress`, `blocked`, `done`

Recommended priority values:

`low`, `medium`, `high`, `urgent`

Supported operations:

- Create a task.
- List and filter tasks.
- Retrieve task details.
- Update permitted fields.
- Assign or reassign a task.
- Change task status.
- Delete a task when authorized.
- View tasks assigned to the current user.
- Filter by status, priority, assignee, and due date.
- Paginate large task lists.

Validate all updates, including changes to task IDs, workspace IDs, assignee IDs, status values, and dates. Clients must not be allowed to assign a task to a user who is not an eligible member of the same workspace.

Use server-controlled fields for values such as `createdBy`, `createdAt`, and `updatedAt`. A client must not be able to impersonate another task creator or overwrite system-managed timestamps.

### 3.4 Task Activity and Audit Trail

Record meaningful task and membership events, including:

- Task creation and deletion
- Task assignment changes
- Status transitions
- Priority and due-date changes
- Workspace role changes
- Member invitations and removals

Each activity record should identify the actor, action, target resource, timestamp, and an appropriately limited change summary.

Audit logs must not contain passwords, session tokens, invitation secrets, or unnecessary sensitive content. Only authorized users should be able to read audit information.

Where task history is required for accountability, do not allow ordinary users to modify or delete the historical records through normal task-management endpoints.

## 4. Technical Stack

Use a TypeScript-first architecture with a clearly separated frontend, backend, and persistence layer.

| Layer | Recommended technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| UI | Tailwind CSS with accessible UI primitives |
| API | Versioned REST API using route handlers or a dedicated Node.js backend |
| Validation | Zod or an equivalent runtime schema validator |
| Database | PostgreSQL |
| ORM | Drizzle ORM or Prisma |
| Authentication | Maintained authentication library or secure session implementation |
| API documentation | OpenAPI 3.x and Swagger UI or an equivalent viewer |
| Unit and integration tests | Vitest or Jest with an appropriate HTTP test client |
| End-to-end testing | Playwright |
| API testing | Postman or automated HTTP integration tests |
| Deployment | A supported application host and managed PostgreSQL service |

Choose one ORM and one main backend architecture for the implementation. Do not mix multiple competing data-access patterns without a clear reason.

The exact framework is less important than demonstrating enforceable permissions, reliable persistence, meaningful tests, and documented behavior.

## 5. System Architecture

Use a layered architecture so security rules are not scattered across frontend components or duplicated inconsistently across API handlers.

```text
Browser / Client
       |
       v
Frontend and UI State
       |
       v
HTTP API v1
       |
       v
Authentication and Session Validation
       |
       v
Input Validation
       |
       v
Workspace Membership and Authorization
       |
       v
Application / Business Logic
       |
       v
Database Access Layer
       |
       v
PostgreSQL
```

Cross-cutting components:

- Centralized error handling
- Structured application logging
- Rate limiting
- API request validation
- Audit event recording
- API schema and documentation
- Automated security and integration tests

Expected request-processing order:

1. Parse and validate the request's basic structure.
2. Establish the authenticated identity where authentication is required.
3. Validate the requested resource and relevant identifiers.
4. Confirm workspace membership and the exact permissions required.
5. Execute the business operation.
6. Persist related changes atomically where necessary.
7. Record the corresponding audit event when required.
8. Return a documented response.

The server may reject malformed requests before authentication, but it must not expose protected resource information to unauthenticated or unauthorized callers.

For database updates that affect multiple records, use transactions where needed to avoid partially completed operations.

## 6. Data Model

Use relational constraints and database indexes to reinforce application-level rules.

### 6.1 Core entities

**User**

- `id`
- `email`
- `name`
- `passwordHash` or the provider-specific identity reference
- `createdAt`
- `updatedAt`

**Workspace**

- `id`
- `name`
- `createdBy`
- `createdAt`
- `updatedAt`

**WorkspaceMembership**

- `id`
- `workspaceId`
- `userId`
- `role`
- `joinedAt`

Enforce uniqueness for the `(workspaceId, userId)` pair.

**WorkspaceInvitation**

- `id`
- `workspaceId`
- `email`
- `role`
- `tokenHash`
- `expiresAt`
- `acceptedAt`
- `createdBy`
- `createdAt`

Store a hash of a securely generated invitation token rather than the usable secret itself.

**Task**

- `id`
- `workspaceId`
- `title`
- `description`
- `status`
- `priority`
- `createdBy`
- `assigneeId`
- `dueAt`
- `createdAt`
- `updatedAt`

**TaskActivity**

- `id`
- `workspaceId`
- `taskId`
- `actorId`
- `action`
- `changeSummary`
- `createdAt`

### 6.2 Database integrity

Implement:

- Foreign-key constraints where appropriate.
- Unique constraints for emails and workspace memberships.
- Controlled values for roles, priorities, and statuses.
- Indexes for frequently used filters and joins.
- Indexes for common queries such as `(workspaceId, status)`, `(workspaceId, assigneeId)`, and relevant timestamp columns.
- Transactions for operations that must succeed or fail together.

Prevent cross-workspace assignments through application validation and appropriate database-level design. Where practical, use composite foreign keys or equivalent constraints to enforce same-workspace relationships.

Define deletion behavior explicitly. For example, deleting a task should not accidentally remove an entire workspace or unrelated audit data. Choose soft deletion or hard deletion based on the documented retention policy.

## 7. Authorization Model

Authorization is a central acceptance criterion, not an optional enhancement.

For every protected operation, determine:

- Who is making the request?
- Which workspace does the resource belong to?
- Is the user currently a member of that workspace?
- What is the user's current workspace role?
- Is the user permitted to perform this specific operation?
- Does the operation violate any resource-level restriction?

Use centralized authorization policies, such as `canViewTask`, `canEditTask`, `canDeleteTask`, `canManageMembers`, and `canChangeRole`, rather than independently implementing inconsistent permission checks in every handler.

Treat user IDs, workspace IDs, task IDs, and role values supplied by clients as untrusted input.

Never trust client-side role values, hidden form fields, UI state, or cached authorization decisions as authoritative.

### Required security tests

1. User A cannot read User B's private workspace tasks without membership.
2. A Member cannot elevate themselves to Admin or Owner.
3. A Viewer cannot create, update, or delete tasks.
4. A Member cannot modify a task outside their permitted scope.
5. An Admin cannot perform owner-only actions when the policy reserves those actions for the Owner.
6. A user cannot assign a task to a user outside the workspace.
7. A removed member loses access on subsequent requests.
8. Changing a resource ID cannot bypass authorization.
9. Unauthenticated requests cannot access private workspace endpoints.
10. Authorization failures do not leak sensitive records or unnecessary information.

Use automated tests to verify the actual responses and database effects, not just the frontend presentation.

## 8. API Design and Contracts

Expose a consistent, versioned REST API under `/api/v1`.

### 8.1 Suggested endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Create an account |
| POST | `/api/v1/auth/login` | Authenticate |
| POST | `/api/v1/auth/logout` | End the current session |
| GET | `/api/v1/me` | Retrieve the current user |
| GET | `/api/v1/workspaces` | List current user's workspaces |
| POST | `/api/v1/workspaces` | Create a workspace |
| GET | `/api/v1/workspaces/:workspaceId` | Retrieve a permitted workspace |
| GET | `/api/v1/workspaces/:workspaceId/members` | List workspace members |
| POST | `/api/v1/workspaces/:workspaceId/invitations` | Invite a member |
| PATCH | `/api/v1/workspaces/:workspaceId/members/:userId` | Change an authorized member's role |
| DELETE | `/api/v1/workspaces/:workspaceId/members/:userId` | Remove a member when permitted |
| GET | `/api/v1/workspaces/:workspaceId/tasks` | List and filter tasks |
| POST | `/api/v1/workspaces/:workspaceId/tasks` | Create a task |
| GET | `/api/v1/workspaces/:workspaceId/tasks/:taskId` | Retrieve a task |
| PATCH | `/api/v1/workspaces/:workspaceId/tasks/:taskId` | Update permitted fields |
| DELETE | `/api/v1/workspaces/:workspaceId/tasks/:taskId` | Delete a task when authorized |
| GET | `/api/v1/workspaces/:workspaceId/tasks/:taskId/activity` | Retrieve permitted task history |

Define invitation acceptance, ownership transfer, password reset, or email verification endpoints if those features are included. Do not expose an endpoint as complete until its behavior and permissions are implemented and tested.

### 8.2 Request validation

Use explicit runtime schemas for request bodies, query parameters, path parameters, and relevant headers.

Examples of invalid requests include:

- Missing or empty task title
- Unsupported status or priority
- Invalid email address
- Malformed resource ID
- Invalid date representation
- Negative or excessive pagination values
- Unexpected fields that attempt to overwrite privileged properties
- Assignment to an ineligible workspace member

Set practical maximum lengths for user-controlled text and limits for request bodies, page sizes, and other resource-consuming inputs.

Prefer strict schemas for write operations. Do not silently accept and persist fields that were never intended to be writable.

### 8.3 Consistent responses

Successful responses should follow an established resource representation. For example:

```json
{
  "data": {
    "id": "task_123",
    "title": "Review API permissions",
    "status": "in_progress",
    "priority": "high",
    "workspaceId": "workspace_123",
    "assigneeId": "user_456",
    "createdAt": "2026-10-25T10:30:00.000Z",
    "updatedAt": "2026-10-25T11:15:00.000Z"
  }
}
```

The identifiers and values above are illustrative, not actual records.

Use a documented error envelope, for example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "code": "TOO_SHORT"
      }
    ],
    "requestId": "req_example"
  }
}
```

Do not return raw database exceptions, stack traces, SQL statements, secret values, or sensitive account information to clients.

Use status codes consistently:

- `200 OK` for successful reads and updates.
- `201 Created` for successful resource creation.
- `204 No Content` for successful operations with no response body.
- `400 Bad Request` for malformed requests.
- `401 Unauthorized` for missing or invalid authentication.
- `403 Forbidden` for authenticated users lacking permission, where revealing the resource's existence is acceptable.
- `404 Not Found` when the resource does not exist or the application intentionally conceals its existence.
- `409 Conflict` for conflicting state or uniqueness violations.
- `422 Unprocessable Content` for well-formed requests that fail applicable semantic validation, if this distinction is used consistently.
- `429 Too Many Requests` for rate limiting.
- `500 Internal Server Error` for unexpected failures.

Document where the API intentionally returns `404` instead of `403` to avoid revealing protected resources.

### 8.4 API documentation

Generate or maintain an OpenAPI 3.x specification describing:

- Endpoints and HTTP methods
- Authentication requirements
- Request schemas and validation constraints
- Success and error responses
- Pagination and filtering
- Role and permission requirements
- Representative request and response examples
- Known limitations and relevant rate limits

Ensure the documentation describes the behavior that the implementation actually provides. Avoid placeholder endpoints presented as functioning features.

Run schema validation in CI where feasible, and keep examples synchronized with automated API tests.

## 9. Frontend and User Experience

Build a responsive, accessible interface that makes core workflows straightforward without weakening backend security.

### Required screens

**Authentication**
- Registration
- Login
- Appropriate authentication failure states

**Workspace dashboard**
- Workspace selection
- Task overview
- Counts by status
- Tasks assigned to the current user
- Overdue and upcoming tasks

**Task management**
- Searchable and filterable task list
- Create and edit task forms
- Task details and activity history
- Assignment and status controls
- Clear empty, loading, and error states

**Workspace settings**
- Member list
- Role indicators
- Invitation flow
- Permission-aware management controls

### UX requirements

- Clearly distinguish loading, success, validation failure, and server failure.
- Confirm destructive operations.
- Explain why an operation failed in language users can understand.
- Prevent accidental double submission where possible.
- Maintain accessible labels, keyboard navigation, focus management, and sufficient visual contrast.
- Keep displayed task data consistent with server responses.
- Refresh or invalidate relevant client caches after mutations.
- Present dates and deadlines in a clear user-facing format while preserving an unambiguous storage convention.

The frontend should hide or disable controls that the current user cannot use, but that behavior is only a usability improvement. The backend must still reject unauthorized requests.

## 10. Security Requirements

### Authentication and sessions

- Use established authentication primitives.
- Configure session expiration and invalidation.
- Protect session cookies appropriately.
- Apply suitable CSRF defenses to cookie-authenticated state-changing requests.
- Add rate limits to login, registration, invitation, and other sensitive endpoints.
- Avoid revealing whether an email is registered through sensitive authentication responses.

### Access control

- Enforce authentication and authorization for every protected endpoint.
- Enforce workspace isolation for reads, writes, filters, exports, and activity queries.
- Prevent insecure direct object reference (IDOR) vulnerabilities.
- Re-check membership and permissions when performing sensitive mutations.
- Ensure role updates cannot be used to escalate privileges.
- Validate assignment and ownership relationships.

### Data handling

- Use parameterized database operations or the selected ORM safely.
- Validate data on the server, even if the frontend has equivalent validation.
- Encode output appropriately and avoid unsafe HTML rendering.
- Avoid leaking secrets or sensitive personal data in error messages and logs.
- Use environment variables or a managed secret store for secrets.
- Commit only a safe `.env.example`; never commit real credentials.
- Configure production CORS narrowly if cross-origin access is required.
- Restrict request sizes and expensive query parameters.
- Use TLS in production.

### Operational security

- Keep dependencies updated and review advisories.
- Apply database migrations through a repeatable process.
- Use a least-privilege database account.
- Separate development and production configurations.
- Ensure health checks and operational logs do not disclose secrets.
- Back up production data and document restoration procedures appropriate to the deployment.

Do not claim that the application is secure merely because it uses HTTPS, an ORM, JWTs, or a third-party authentication library. Security must be demonstrated through the combination of controls, architecture, and tests.

## 11. Testing Strategy

Testing must verify both functionality and the absence of unauthorized effects.

### Unit tests

Test:

- Input schemas
- Authorization policies
- Task state-transition rules
- Role-specific permissions
- Pagination and filter validation
- Error mapping
- Business logic for membership and assignment changes

### Integration tests

Use a real test database or a controlled database environment that supports the constraints being tested.

Test:

- User registration and login
- Session creation and invalidation
- Workspace creation and membership
- Task CRUD operations
- Assignment and reassignment
- Role-specific API behavior
- Database constraints
- Multi-record transactions
- Activity log creation
- Cross-workspace data isolation
- Invalid and unexpected fields

### Negative and security tests

Test at least:

- Missing authentication
- Expired or invalid sessions
- Access to another workspace's task
- Attempts to elevate user privileges
- Unauthorized deletion
- Unauthorized member management
- Invalid task assignments
- Malformed JSON and identifiers
- Oversized inputs and pagination abuse
- Repeated authentication failures
- Concurrent updates to the same task
- Attempts to change immutable fields
- API responses that could disclose sensitive information

### End-to-end tests

Using Playwright or an equivalent tool, exercise:

1. A user registers and logs in.
2. The user creates a workspace.
3. The user creates and assigns a task.
4. An invited team member joins the workspace.
5. The member performs permitted task operations.
6. The member is denied a prohibited operation.
7. A Viewer can read permitted tasks but cannot change them.
8. A removed member loses access.
9. Invalid form submissions display useful feedback.
10. Logout invalidates the protected session.

Include regression tests for every authorization bug discovered during implementation.

Do not use only mocked API handlers to claim that the backend's real authorization and database constraints have been verified.

## 12. Repository Structure

Use a maintainable structure similar to the following, adapted to the selected framework:

```text
secure-task-platform/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── dashboard/
│   │   ├── workspaces/
│   │   └── api/
│   │       └── v1/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── workspaces/
│   │   ├── members/
│   │   └── tasks/
│   ├── server/
│   │   ├── auth/
│   │   ├── authorization/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── validation/
│   │   └── errors/
│   ├── db/
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── client.ts
│   └── lib/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── authorization-matrix.md
│   ├── api.md
│   └── openapi.yaml
├── scripts/
├── .env.example
├── README.md
└── package.json
```

Keep data-access code, business logic, permission policies, and presentation components separate enough to test independently. Do not duplicate sensitive authorization decisions in several unrelated layers.

## 13. Implementation Plan

### Phase 1: Foundation

- Inspect the existing repository before modifying it.
- Identify the existing framework, entry points, scripts, dependencies, and current application behavior.
- Establish environment configuration and database connectivity.
- Define the database schema and migrations.
- Add shared request validation and error handling.
- Document the planned authorization model.

**Exit criterion:** The project starts reliably, database migrations work, and the foundational architecture is documented.

### Phase 2: Authentication and Identity

- Implement registration, login, logout, and current-user retrieval.
- Configure password handling or the selected identity provider.
- Implement session validation and invalidation.
- Add authentication tests and relevant rate limits.
- Protect the first private API endpoint.

**Exit criterion:** Authentication works through real application flows, and protected endpoints reject unauthenticated requests.

### Phase 3: Workspaces and Authorization

- Implement workspace creation and retrieval.
- Add membership and role management.
- Implement centralized authorization policies.
- Add invitations if included in the product scope.
- Implement and test cross-workspace isolation.

**Exit criterion:** A user's membership and role determine access on the server; changing identifiers cannot bypass the policy.

### Phase 4: Task Workflows

- Implement task CRUD operations.
- Add assignment validation.
- Add status, priority, filtering, and pagination.
- Record important task activity.
- Use transactions and constraints where required.

**Exit criterion:** Valid task workflows work end to end, invalid changes are rejected, and database invariants remain intact.

### Phase 5: API Contracts and Frontend

- Implement the required interface screens.
- Add consistent loading, empty, and error states.
- Publish OpenAPI documentation.
- Verify request and response contracts against the running implementation.
- Complete the workspace and task user journeys.

**Exit criterion:** Core workflows function through the UI and documented API, with consistent behavior and usable feedback.

### Phase 6: Verification and Hardening

- Run unit, integration, security, and end-to-end tests.
- Inspect every protected endpoint for authorization gaps.
- Check database migrations and production configuration.
- Scan for leaked secrets and unsafe dependency versions.
- Test error responses, logging, and session invalidation.
- Fix existing regressions before release.

**Exit criterion:** Required tests pass, critical authorization failures are resolved, and known limitations are documented.

### Phase 7: Release Preparation

- Prepare a reproducible deployment process.
- Configure production secrets and database access.
- Document migrations, backup expectations, and recovery steps.
- Verify health checks and operational logs.
- Prepare a clear README and API documentation.
- Report the actual test and deployment status.

**Exit criterion:** Another developer can configure, run, test, and understand the application from the documentation without relying on undocumented manual steps.

## 14. Acceptance Criteria

The project is ready for submission only when the following are demonstrated.

### Functional completeness

- Users can authenticate and manage their sessions.
- Users can create and access workspaces they are authorized to use.
- Workspace roles affect the available operations.
- Authorized users can create, list, update, assign, and delete tasks.
- Task status and priority changes are validated.
- Filtering and pagination return predictable results.
- Task activity is recorded according to the documented policy.

### Security

- No protected operation relies solely on frontend restrictions.
- Cross-workspace access is prevented and covered by automated tests.
- Privilege escalation attempts are rejected.
- Input validation is performed on the server.
- Authentication-sensitive endpoints have appropriate abuse protections.
- Secrets are not committed or returned through API responses.
- Database relationships and constraints protect important invariants.

### API quality

- All implemented endpoints have documented request and response contracts.
- Success and failure responses are consistent.
- HTTP status codes are used appropriately.
- Invalid requests produce predictable validation errors.
- API documentation matches the actual implementation.

### Engineering quality

- Database migrations are reproducible.
- Unit, integration, security, and end-to-end tests are available for the critical flows.
- The application can be run from a clean setup using documented commands.
- Environment configuration and sample variables are documented.
- Known limitations are clearly disclosed.
- No critical feature is represented by a nonfunctional UI placeholder.

## 15. README and Developer Documentation

The README must include:

- Project overview and problem statement
- Main features
- Architecture diagram
- Technology stack
- Prerequisites
- Local setup instructions
- Environment-variable reference
- Database creation and migration commands
- Development and production build commands
- Test commands
- API documentation location
- Authentication and authorization design
- Workspace role-permission matrix
- Deployment instructions
- Known limitations and future improvements

Use placeholders for secrets in environment examples. Never include actual API keys, credentials, session secrets, or production database URLs.

## 16. Scope Boundaries

Keep the initial implementation focused on secure task and workspace management.

Do not add complex functionality such as real-time collaboration, advanced automation, billing, external integrations, or elaborate analytics before the core authentication, authorization, task persistence, and API contracts are correct.

When a feature is not implemented, document it as a limitation rather than presenting it as complete.

Do not invent user counts, performance benchmarks, security certifications, external integrations, or deployment outcomes.

## 17. Final Verification Report

At the end of implementation, produce a report containing:

| Area | Required report |
|---|---|
| Features | Implemented, incomplete, or intentionally excluded |
| Authentication | Tested flows and known limitations |
| Authorization | Role matrix and tested denial scenarios |
| Database | Schema, constraints, and migration status |
| APIs | Implemented endpoints and documentation location |
| Validation | Enforced schemas and error behavior |
| Testing | Commands executed and actual results |
| Security | Controls implemented, findings, and unresolved risks |
| Frontend | Verified workflows and known issues |
| Deployment | Actual deployment status and configuration requirements |
| Final status | Ready for submission, blocked, or incomplete, with evidence |

Clearly distinguish tests that were executed from tests that merely exist in the repository. Report any failing tests and unresolved critical issues honestly.

## Final Execution Instruction

Inspect the existing codebase first, then implement the application in the phases defined above. Preserve working functionality unless a change is necessary and justified. Remove only genuinely unused code and dependencies after verifying that nothing relies on them.

Prioritize security boundaries, database integrity, API correctness, and testability over adding extra features. Validate every protected backend route, every write operation, every role transition, and every resource relationship.

Before declaring the project complete, run the actual available linting, type-checking, build, migration, unit, integration, security, and end-to-end commands. Verify frontend and backend behavior against the running application wherever possible.

Do not claim completion solely because the application compiles or the UI looks correct. The final result must demonstrate that authorized users can complete the intended workflows, unauthorized users are prevented from accessing or changing protected data, and developers can understand and integrate with the API through accurate documentation.