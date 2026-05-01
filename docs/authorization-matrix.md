# Authorization & RBAC Matrix

## Role Definitions

| Role | Description |
|---|---|
| **Owner** | Full workspace authority. Can manage workspace settings, transfer ownership, manage all members and roles, manage all tasks, or delete the workspace. |
| **Admin** | Workspace administrator. Can invite members, update roles of members/viewers, remove members/viewers, and manage all workspace tasks. Cannot modify owners or other admins. |
| **Member** | Workspace contributor. Can view all workspace tasks, create tasks, and edit tasks they created or are assigned to. Can delete tasks they personally created. |
| **Viewer** | Read-only observer. Can view workspace details, members, tasks, and task activity history. Cannot create, modify, or delete any resources. |

---

## Workspace-Level Permissions

| Action | Owner | Admin | Member | Viewer |
|---|:---:|:---:|:---:|:---:|
| View workspace details | ✅ | ✅ | ✅ | ✅ |
| Update workspace settings | ✅ | ❌ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |
| View member list | ✅ | ✅ | ✅ | ✅ |
| Invite new members | ✅ | ✅ | ❌ | ❌ |
| Promote member to Admin | ✅ | ✅ | ❌ | ❌ |
| Demote Admin to Member | ✅ | ❌ | ❌ | ❌ |
| Promote to Owner | ✅ | ❌ | ❌ | ❌ |
| Demote / Remove Sole Owner | ❌ *(Blocked)* | ❌ | ❌ | ❌ |
| Remove Member / Viewer | ✅ | ✅ | ❌ | ❌ |
| Remove Admin | ✅ | ❌ | ❌ | ❌ |
| Leave workspace (Self-removal) | ✅ *(If not sole owner)* | ✅ | ✅ | ✅ |

---

## Task-Level Permissions

| Action | Owner | Admin | Member | Viewer |
|---|:---:|:---:|:---:|:---:|
| View workspace tasks | ✅ | ✅ | ✅ | ✅ |
| Create new task | ✅ | ✅ | ✅ | ❌ |
| Edit task (Created by user) | ✅ | ✅ | ✅ | ❌ |
| Edit task (Assigned to user) | ✅ | ✅ | ✅ | ❌ |
| Edit task (Unassigned / Other's task) | ✅ | ✅ | ❌ | ❌ |
| Assign task to workspace member | ✅ | ✅ | ✅ *(For permitted tasks)* | ❌ |
| Assign task to non-member | ❌ *(Blocked)* | ❌ *(Blocked)* | ❌ *(Blocked)* | ❌ *(Blocked)* |
| Delete task (Created by user) | ✅ | ✅ | ✅ | ❌ |
| Delete task (Created by other) | ✅ | ✅ | ❌ | ❌ |
| View task audit history | ✅ | ✅ | ✅ | ✅ |

---

## Invariants & Protection Rules

1. **Sole Owner Protection**: The only owner of a workspace cannot be demoted or removed, and cannot leave without designating a successor owner or deleting the workspace.
2. **Cross-Workspace Assignment Guard**: A task in Workspace A can only be assigned to a user who possesses an active membership in Workspace A.
3. **Cross-Workspace Data Concealment**: Attempting to access tasks or workspaces where the user is not a member returns `404 Not Found` rather than `403 Forbidden` to prevent private resource discovery.
4. **Immutable Fields**: System fields `id`, `workspaceId`, `createdBy`, and `createdAt` cannot be overwritten or impersonated by client requests.

