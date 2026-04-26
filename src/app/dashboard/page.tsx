"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Plus,
  LogOut,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  User,
  ArrowRight,
  Layers,
  Loader2,
  Settings,
} from "lucide-react";
import { apiRequest } from "@/lib/api-client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
  createdBy: string;
}

interface TaskItem {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: string | null;
  workspaceId: string;
  assignee?: { id: string; name: string } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWsId, setSelectedWsId] = useState<string>("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [createWsLoading, setCreateWsLoading] = useState(false);

  useEffect(() => {
    loadUserAndWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWsId) {
      loadWorkspaceTasks(selectedWsId);
    }
  }, [selectedWsId]);

  const loadUserAndWorkspaces = async () => {
    try {
      setLoading(true);
      const meData = await apiRequest("/api/v1/me");
      setUser(meData.user);

      const wsList = await apiRequest<WorkspaceSummary[]>("/api/v1/workspaces");
      setWorkspaces(wsList);
      if (wsList.length > 0) {
        setSelectedWsId(wsList[0].id);
      }
    } catch (err) {
      // If unauthorized, redirect to login
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceTasks = async (wsId: string) => {
    try {
      setTasksLoading(true);
      const res = await apiRequest<{ data: TaskItem[]; pagination: any }>(
        `/api/v1/workspaces/${wsId}/tasks?limit=100`
      );
      setTasks(res as any || []);
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      setCreateWsLoading(true);
      const newWs = await apiRequest("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newWsName }),
      });
      setWorkspaces([newWs, ...workspaces]);
      setSelectedWsId(newWs.id);
      setNewWsName("");
      setShowCreateWsModal(false);
    } catch (err) {
      alert("Failed to create workspace. Please check name length.");
    } finally {
      setCreateWsLoading(false);
    }
  };

  const handleLogout = async () => {
    await apiRequest("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm">Loading Teamly workspace...</p>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const totalTasks = tasks.length;
  const todoTasks = tasks.filter((t) => t.status === "todo").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  const myTasks = user ? tasks.filter((t) => t.assignee?.id === user.id) : [];

  const now = new Date();
  const overdueTasks = tasks.filter(
    (t) => t.dueAt && new Date(t.dueAt) < now && t.status !== "done"
  );
  const upcomingTasks = tasks.filter(
    (t) => t.dueAt && new Date(t.dueAt) >= now && t.status !== "done"
  );

  const currentWorkspace = workspaces.find((w) => w.id === selectedWsId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">Teamly</span>
            </Link>

            {/* Workspace Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Workspace:</span>
              <select
                value={selectedWsId}
                onChange={(e) => setSelectedWsId(e.target.value)}
                className="text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border-none rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.role})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowCreateWsModal(true)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
                title="Create Workspace"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              API Reference
            </Link>

            {currentWorkspace && (
              <Link
                href={`/workspaces/${currentWorkspace.id}/settings`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings & Members
              </Link>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                {user?.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {workspaces.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto mt-12 shadow-sm">
            <FolderKanban className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">No Workspaces Found</h2>
            <p className="mt-2 text-sm text-slate-600">
              Create your first team workspace to start managing tasks with verified security boundaries.
            </p>
            <button
              onClick={() => setShowCreateWsModal(true)}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </button>
          </div>
        ) : (
          <div>
            {/* Workspace Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{currentWorkspace?.name}</h1>
                  <span className="text-xs uppercase font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Role: {currentWorkspace?.role}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Workspace ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{currentWorkspace?.id}</code>
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/workspaces/${selectedWsId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition"
                >
                  <FolderKanban className="h-4 w-4" />
                  Manage Tasks
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/workspaces/${selectedWsId}/settings`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                >
                  Members & Settings
                </Link>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-slate-500">Total Tasks</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">{totalTasks}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-slate-500">To Do</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-700">{todoTasks}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-blue-600">In Progress</div>
                <div className="mt-2 text-2xl font-extrabold text-blue-700">{inProgressTasks}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-amber-600">Blocked</div>
                <div className="mt-2 text-2xl font-extrabold text-amber-700">{blockedTasks}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
                <div className="text-xs font-semibold text-emerald-600">Done</div>
                <div className="mt-2 text-2xl font-extrabold text-emerald-700">{doneTasks}</div>
              </div>
            </div>

            {/* Two-Column Section: Assigned To Me & Deadlines */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* My Assigned Tasks */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    <h2 className="text-base font-bold text-slate-900">Assigned to Me</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
                      {myTasks.length}
                    </span>
                  </div>
                  <Link
                    href={`/workspaces/${selectedWsId}`}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    View all
                  </Link>
                </div>

                <div className="space-y-3 flex-1">
                  {myTasks.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      No tasks currently assigned to you.
                    </div>
                  ) : (
                    myTasks.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">{t.title}</span>
                          <span className="text-xs text-slate-400">
                            Status: <span className="capitalize">{t.status.replace("_", " ")}</span>
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${
                            t.priority === "urgent"
                              ? "bg-red-100 text-red-700"
                              : t.priority === "high"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Deadlines & Overdue Tasks */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                    <h2 className="text-base font-bold text-slate-900">Task Deadlines</h2>
                  </div>
                  {overdueTasks.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {overdueTasks.length} overdue
                    </span>
                  )}
                </div>

                <div className="space-y-3 flex-1">
                  {overdueTasks.length === 0 && upcomingTasks.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      No due dates scheduled.
                    </div>
                  ) : (
                    <>
                      {overdueTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between"
                        >
                          <div>
                            <span className="text-sm font-semibold text-red-900">{t.title}</span>
                            <div className="text-xs text-red-600">
                              Overdue since: {new Date(t.dueAt!).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded bg-red-200 text-red-800 font-bold">
                            Overdue
                          </span>
                        </div>
                      ))}

                      {upcomingTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl border border-slate-100 flex items-center justify-between"
                        >
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{t.title}</span>
                            <div className="text-xs text-slate-400">
                              Due: {new Date(t.dueAt!).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                            Upcoming
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Workspace Modal */}
      {showCreateWsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Create New Workspace</h3>
            <p className="mt-1 text-sm text-slate-500">
              Each workspace provides strict data isolation and independent roles.
            </p>

            <form onSubmit={handleCreateWorkspace} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Core Engineering"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-600 sm:text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWsLoading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {createWsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

