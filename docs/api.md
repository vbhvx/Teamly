# Teamly REST API Documentation (v1)

Base URL: `/api/v1`

## Response Envelope Conventions

### Successful Responses
Single resource:
```json
{
  "data": {
    "id": "task_abc123",
    "title": "Security audit",
    ...
  }
}
```

Paginated collections:
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Error Envelope
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "code": "TOO_SHORT",
        "message": "Title is required"
      }
    ],
    "requestId": "req_8b9f1a2"
  }
}
```

## Standard HTTP Status Codes

- `200 OK`: Successful read or update.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Malformed payload or validation schema error.
- `401 Unauthorized`: Missing, expired, or invalid session token.
- `403 Forbidden`: Authenticated user lacks permission for this action.
- `404 Not Found`: Target resource does not exist, or intentionally hidden to prevent enumeration.
- `409 Conflict`: Unique constraint violation (e.g. email or membership already exists).
- `422 Unprocessable Content`: Semantic failure (e.g. assigning task to non-member).
- `429 Too Many Requests`: Rate limit exceeded for sensitive endpoints.
- `500 Internal Server Error`: Server unexpected failure.

## Endpoints Summary

### Authentication
- `POST /api/v1/auth/register`: Create a new user account.
- `POST /api/v1/auth/login`: Authenticate with email and password.
- `POST /api/v1/auth/logout`: Invalidate session and clear cookie.
- `GET /api/v1/me`: Retrieve current user profile and workspaces.

### Workspaces
- `GET /api/v1/workspaces`: List workspaces for current user.
- `POST /api/v1/workspaces`: Create a new workspace.
- `GET /api/v1/workspaces/:workspaceId`: Retrieve workspace details.
- `PATCH /api/v1/workspaces/:workspaceId`: Update workspace name (Owner only).
- `DELETE /api/v1/workspaces/:workspaceId`: Delete workspace (Owner only).

### Workspace Members & Invitations
- `GET /api/v1/workspaces/:workspaceId/members`: List workspace members.
- `PATCH /api/v1/workspaces/:workspaceId/members/:userId`: Change a member's role.
- `DELETE /api/v1/workspaces/:workspaceId/members/:userId`: Remove member or leave workspace.
- `GET /api/v1/workspaces/:workspaceId/invitations`: List pending invitations.
- `POST /api/v1/workspaces/:workspaceId/invitations`: Invite a member by email and role.
- `POST /api/v1/invitations/accept`: Accept an invitation via token.

### Tasks
- `GET /api/v1/workspaces/:workspaceId/tasks`: List and filter tasks (status, priority, assignee, search, pagination).
- `POST /api/v1/workspaces/:workspaceId/tasks`: Create a task.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId`: Retrieve task details.
- `PATCH /api/v1/workspaces/:workspaceId/tasks/:taskId`: Update task fields.
- `DELETE /api/v1/workspaces/:workspaceId/tasks/:taskId`: Delete task.

### Audit & Activity
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/activity`: Retrieve task audit history.
- `GET /api/v1/workspaces/:workspaceId/activity`: Retrieve workspace activity log.

