import { describe, it, expect } from "vitest";
import { AuthorizationPolicy, type Role, type TaskResource } from "@/server/authorization/policies";

describe("Centralized Authorization Policies (Unit)", () => {
  const dummyTask: TaskResource = {
    id: "task_1",
    workspaceId: "ws_1",
    createdBy: "usr_alice",
    assigneeId: "usr_bob",
  };

  describe("Workspace Settings & Deletion", () => {
    it("should allow only Owner to update workspace settings", () => {
      expect(AuthorizationPolicy.canUpdateWorkspace("owner")).toBe(true);
      expect(AuthorizationPolicy.canUpdateWorkspace("admin")).toBe(false);
      expect(AuthorizationPolicy.canUpdateWorkspace("member")).toBe(false);
      expect(AuthorizationPolicy.canUpdateWorkspace("viewer")).toBe(false);
    });

    it("should allow only Owner to delete workspace", () => {
      expect(AuthorizationPolicy.canDeleteWorkspace("owner")).toBe(true);
      expect(AuthorizationPolicy.canDeleteWorkspace("admin")).toBe(false);
      expect(AuthorizationPolicy.canDeleteWorkspace("member")).toBe(false);
      expect(AuthorizationPolicy.canDeleteWorkspace("viewer")).toBe(false);
    });
  });

  describe("Member Invitations", () => {
    it("should allow Owner and Admin to invite members", () => {
      expect(AuthorizationPolicy.canInviteMembers("owner")).toBe(true);
      expect(AuthorizationPolicy.canInviteMembers("admin")).toBe(true);
      expect(AuthorizationPolicy.canInviteMembers("member")).toBe(false);
      expect(AuthorizationPolicy.canInviteMembers("viewer")).toBe(false);
    });
  });

  describe("Member Role Updates & Safeguards", () => {
    it("should prevent demoting the sole owner under all circumstances", () => {
      expect(
        AuthorizationPolicy.canUpdateMemberRole("owner", "owner", "admin", true)
      ).toBe(false);
      expect(
        AuthorizationPolicy.canUpdateMemberRole("owner", "owner", "member", true)
      ).toBe(false);
    });

    it("should allow Owner to update roles when not the sole owner or designating new owner", () => {
      expect(
        AuthorizationPolicy.canUpdateMemberRole("owner", "admin", "owner", false)
      ).toBe(true);
      expect(
        AuthorizationPolicy.canUpdateMemberRole("owner", "member", "admin", false)
      ).toBe(true);
    });

    it("should allow Admin to promote Member to Admin or Viewer", () => {
      expect(
        AuthorizationPolicy.canUpdateMemberRole("admin", "member", "admin", false)
      ).toBe(true);
      expect(
        AuthorizationPolicy.canUpdateMemberRole("admin", "member", "viewer", false)
      ).toBe(true);
    });

    it("should prevent Admin from modifying Owner or promoting to Owner", () => {
      expect(
        AuthorizationPolicy.canUpdateMemberRole("admin", "owner", "admin", false)
      ).toBe(false);
      expect(
        AuthorizationPolicy.canUpdateMemberRole("admin", "member", "owner", false)
      ).toBe(false);
    });

    it("should prevent Admin from modifying another Admin", () => {
      expect(
        AuthorizationPolicy.canUpdateMemberRole("admin", "admin", "member", false)
      ).toBe(false);
    });

    it("should prevent Members and Viewers from changing any roles", () => {
      expect(
        AuthorizationPolicy.canUpdateMemberRole("member", "viewer", "member", false)
      ).toBe(false);
      expect(
        AuthorizationPolicy.canUpdateMemberRole("viewer", "viewer", "member", false)
      ).toBe(false);
    });
  });

  describe("Member Removal & Leaving Safeguards", () => {
    it("should prevent removing or leaving if target is sole owner", () => {
      expect(
        AuthorizationPolicy.canRemoveMember("owner", "owner", true, true)
      ).toBe(false);
    });

    it("should allow any non-sole-owner to leave the workspace", () => {
      expect(
        AuthorizationPolicy.canRemoveMember("member", "member", true, false)
      ).toBe(true);
      expect(
        AuthorizationPolicy.canRemoveMember("admin", "admin", true, false)
      ).toBe(true);
      expect(
        AuthorizationPolicy.canRemoveMember("viewer", "viewer", true, false)
      ).toBe(true);
    });

    it("should allow Admin to remove Members and Viewers, but not Owners or Admins", () => {
      expect(
        AuthorizationPolicy.canRemoveMember("admin", "member", false, false)
      ).toBe(true);
      expect(
        AuthorizationPolicy.canRemoveMember("admin", "viewer", false, false)
      ).toBe(true);
      expect(
        AuthorizationPolicy.canRemoveMember("admin", "admin", false, false)
      ).toBe(false);
      expect(
        AuthorizationPolicy.canRemoveMember("admin", "owner", false, false)
      ).toBe(false);
    });
  });

  describe("Task Operations RBAC", () => {
    it("should allow Owner, Admin, and Member to create tasks, but forbid Viewer", () => {
      expect(AuthorizationPolicy.canCreateTask("owner")).toBe(true);
      expect(AuthorizationPolicy.canCreateTask("admin")).toBe(true);
      expect(AuthorizationPolicy.canCreateTask("member")).toBe(true);
      expect(AuthorizationPolicy.canCreateTask("viewer")).toBe(false);
    });

    it("should allow Owner and Admin to edit any task", () => {
      expect(AuthorizationPolicy.canEditTask("owner", dummyTask, "usr_stranger")).toBe(true);
      expect(AuthorizationPolicy.canEditTask("admin", dummyTask, "usr_stranger")).toBe(true);
    });

    it("should allow Member to edit task if they created it", () => {
      expect(AuthorizationPolicy.canEditTask("member", dummyTask, "usr_alice")).toBe(true);
    });

    it("should allow Member to edit task if they are assigned to it", () => {
      expect(AuthorizationPolicy.canEditTask("member", dummyTask, "usr_bob")).toBe(true);
    });

    it("should forbid Member from editing a task they did not create and are not assigned to", () => {
      expect(AuthorizationPolicy.canEditTask("member", dummyTask, "usr_stranger")).toBe(false);
    });

    it("should forbid Viewer from editing any task", () => {
      expect(AuthorizationPolicy.canEditTask("viewer", dummyTask, "usr_alice")).toBe(false);
      expect(AuthorizationPolicy.canEditTask("viewer", dummyTask, "usr_bob")).toBe(false);
      expect(AuthorizationPolicy.canEditTask("viewer", dummyTask, "usr_stranger")).toBe(false);
    });

    it("should allow Owner, Admin, and Task Creator (Member) to delete task", () => {
      expect(AuthorizationPolicy.canDeleteTask("owner", dummyTask, "usr_stranger")).toBe(true);
      expect(AuthorizationPolicy.canDeleteTask("admin", dummyTask, "usr_stranger")).toBe(true);
      expect(AuthorizationPolicy.canDeleteTask("member", dummyTask, "usr_alice")).toBe(true); // creator
    });

    it("should forbid Member from deleting another user's task", () => {
      expect(AuthorizationPolicy.canDeleteTask("member", dummyTask, "usr_bob")).toBe(false); // assignee, not creator
      expect(AuthorizationPolicy.canDeleteTask("member", dummyTask, "usr_stranger")).toBe(false);
    });

    it("should forbid Viewer from deleting any task", () => {
      expect(AuthorizationPolicy.canDeleteTask("viewer", dummyTask, "usr_alice")).toBe(false);
    });
  });
});

