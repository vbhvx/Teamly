"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  Trash2,
  AlertCircle,
  CheckCircle,
  Copy,
  Clock,
  Loader2,
  LogOut,
  FolderKanban,
  Edit,
} from "lucide-react";
import { apiRequest, ClientApiError } from "@/lib/api-client";

interface WorkspaceInfo {
  id: string;
  name: string;
  currentUserRole: "owner" | "admin" | "member" | "viewer";
}

interface MemberInfo {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
}

interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  createdBy: { name: string; email: string };
}

export default function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const resolvedParams = use(params);
  const workspaceId = resolvedParams.workspaceId;
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Workspace Name Edit
  const [newWsName, setNewWsName] = useState("");
  const [updatingName, setUpdatingName] = useState(false);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Error / Success Feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [workspaceId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const meData = await apiRequest("/api/v1/me");
      setCurrentUserId(meData.user.id);

      const wsData = await apiRequest(`/api/v1/workspaces/${workspaceId}`);
      setWorkspace(wsData);
      setNewWsName(wsData.name);

      const membersData = await apiRequest(`/api/v1/workspaces/${workspaceId}/members`);
      setMembers(membersData);

      if (wsData.currentUserRole === "owner" || wsData.currentUserRole === "admin") {
        const invData = await apiRequest(`/api/v1/workspaces/${workspaceId}/invitations`);
        setInvitations(invData || []);
      }
    } catch (err) {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!newWsName.trim()) return;

    try {
      setUpdatingName(true);
      await apiRequest(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newWsName.trim() }),
      });
      setActionSuccess("Workspace name updated successfully.");
      setWorkspace((prev) => (prev ? { ...prev, name: newWsName.trim() } : null));
    } catch (err: any) {
      setActionError(err.message || "Failed to update workspace name.");
    } finally {
      setUpdatingName(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setGeneratedInviteLink(null);

    try {
      setInviteLoading(true);
      const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const acceptUrl = `${window.location.origin}/invitations/accept?token=${result.invitationToken}`;
      setGeneratedInviteLink(acceptUrl);
      loadSettings();
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite member.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    setActionError(null);
    setActionSuccess(null);

    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/members/${targetUserId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      setActionSuccess("Member role updated successfully.");
      loadSettings();
    } catch (err: any) {
      setActionError(err.message || "Cannot change member role.");
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    const isSelf = targetUserId === currentUserId;
    const confirmMessage = isSelf
      ? "Are you sure you want to leave this workspace?"
      : "Are you sure you want to remove this member?";

    if (!confirm(confirmMessage)) return;

    setActionError(null);
    setActionSuccess(null);

    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/members/${targetUserId}`, {
        method: "DELETE",
      });
      if (isSelf) {
        router.push("/dashboard");
      } else {
        setActionSuccess("Member removed successfully.");
        loadSettings();
      }
    } catch (err: any) {
      setActionError(err.message || "Cannot remove member.");
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!confirm("Are you sure you want to permanently delete this workspace and all its tasks?")) {
      return;
    }

    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}`, {
        method: "DELETE",
      });
      router.push("/dashboard");
    } catch (err: any) {
      setActionError(err.message || "Failed to delete workspace.");
    }
  };

  const isOwner = workspace?.currentUserRole === "owner";
  const isAdmin = workspace?.currentUserRole === "admin";
  const canManageMembers = isOwner || isAdmin;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/workspaces/${workspaceId}`}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Back to Tasks"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Workspace Settings & Members
              </h1>
              <p className="text-xs text-slate-400">{workspace?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/workspaces/${workspaceId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <FolderKanban className="h-4 w-4" />
              View Tasks
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        {actionError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>{actionError}</div>
          </div>
        )}

        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>{actionSuccess}</div>
          </div>
        )}

        {/* Section 1: Team Members */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Workspace Members
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage roles and permissions according to the workspace authorization policy.
              </p>
            </div>

            {canManageMembers && (
              <button
                onClick={() => {
                  setGeneratedInviteLink(null);
                  setInviteError(null);
                  setInviteEmail("");
                  setShowInviteModal(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <UserPlus className="h-4 w-4" />
                Invite Member
              </button>
            )}
          </div>

          {/* Members Table */}
          <div className="mt-4 divide-y divide-slate-100">
            {members.map((m) => {
              const isSelf = m.userId === currentUserId;
              const isSoleOwner = m.role === "owner" && members.filter((x) => x.role === "owner").length === 1;

              return (
                <div
                  key={m.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {m.name}
                        {isSelf && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{m.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role Selector */}
                    {isOwner ? (
                      <select
                        value={m.role}
                        disabled={isSoleOwner}
                        onChange={(e) => handleChangeRole(m.userId, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-600 ${
                          isSoleOwner ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : isAdmin && m.role !== "owner" && m.role !== "admin" ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.userId, e.target.value)}
                        className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-600 cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-xs uppercase font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        {m.role}
                      </span>
                    )}

                    {/* Remove / Leave Button */}
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      disabled={isSoleOwner}
                      className={`p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition ${
                        isSoleOwner && "opacity-25 cursor-not-allowed"
                      }`}
                      title={isSelf ? "Leave workspace" : "Remove member"}
                    >
                      {isSelf ? <LogOut className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Pending Invitations */}
        {canManageMembers && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Mail className="h-4 w-4 text-amber-600" />
              Pending Invitations
            </h2>

            {invitations.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No pending invitations.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="py-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{inv.email}</span>
                      <span className="ml-2 uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
                        {inv.role}
                      </span>
                      <div className="text-slate-400 mt-0.5">
                        Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-slate-400 font-medium">Invited by {inv.createdBy.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 3: Workspace Settings (Owner Only) */}
        {isOwner && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Workspace Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage workspace profile and lifecycle.
              </p>
            </div>

            <form onSubmit={handleUpdateName} className="flex gap-3 max-w-md">
              <input
                type="text"
                required
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={updatingName}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {updatingName ? "Saving..." : "Save Name"}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-red-600">Danger Zone</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently delete this workspace and all associated tasks, assignments, and audit logs.
              </p>
              <button
                onClick={handleDeleteWorkspace}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Invite Team Member</h3>
            <p className="mt-1 text-xs text-slate-500">
              Generate a secure, expiring invitation token to join this workspace.
            </p>

            {inviteError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {inviteError}
              </div>
            )}

            {generatedInviteLink ? (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  Invitation created! Share this secure link with your colleague:
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono break-all text-slate-800">
                  {generatedInviteLink}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedInviteLink);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedLink ? "Copied to Clipboard!" : "Copy Invitation Link"}
                </button>
                <div className="text-center pt-2">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Workspace Role *
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="member">Member (Can create & manage own tasks)</option>
                    <option value="viewer">Viewer (Read-only observer)</option>
                    {isOwner && <option value="admin">Admin (Manage members & all tasks)</option>}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {inviteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Generate Invitation
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

