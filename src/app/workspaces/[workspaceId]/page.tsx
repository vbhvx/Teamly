"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowLeft,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  History,
  X,
  Loader2,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
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
  role: string;
}

interface TaskItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; name: string; email: string };
  assignee: { id: string; name: string; email: string } | null;
}

interface ActivityItem {
  id: string;
  action: string;
  changeSummary: any;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export default function WorkspaceTasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const resolvedParams = use(params);
  const workspaceId = resolvedParams.workspaceId;
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [activeHistoryTask, setActiveHistoryTask] = useState<TaskItem | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form State
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: "",
    dueAt: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadWorkspaceAndMembers();
  }, [workspaceId]);

  useEffect(() => {
    loadTasks();
  }, [workspaceId, page, statusFilter, priorityFilter, search]);

  const loadWorkspaceAndMembers = async () => {
    try {
      const meData = await apiRequest("/api/v1/me");
      setCurrentUserId(meData.user.id);

      const wsData = await apiRequest(`/api/v1/workspaces/${workspaceId}`);
      setWorkspace(wsData);

      const membersData = await apiRequest(`/api/v1/workspaces/${workspaceId}/members`);
      setMembers(membersData);
    } catch (err) {
      router.push("/dashboard");
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (statusFilter) queryParams.set("status", statusFilter);
      if (priorityFilter) queryParams.set("priority", priorityFilter);
      if (search.trim()) queryParams.set("search", search.trim());

      const res = await apiRequest(
        `/api/v1/workspaces/${workspaceId}/tasks?${queryParams.toString()}`
      );
      setTasks(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!taskForm.title.trim()) {
      setFormError("Task title is required.");
      return;
    }

    try {
      setFormLoading(true);
      await apiRequest(`/api/v1/workspaces/${workspaceId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description || null,
          status: taskForm.status,
          priority: taskForm.priority,
          assigneeId: taskForm.assigneeId || null,
          dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
        }),
      });

      setShowCreateModal(false);
      resetTaskForm();
      loadTasks();
    } catch (err: any) {
      setFormError(err.message || "Failed to create task");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setFormError(null);

    try {
      setFormLoading(true);
      await apiRequest(`/api/v1/workspaces/${workspaceId}/tasks/${editingTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description || null,
          status: taskForm.status,
          priority: taskForm.priority,
          assigneeId: taskForm.assigneeId || null,
          dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
        }),
      });

      setEditingTask(null);
      resetTaskForm();
      loadTasks();
    } catch (err: any) {
      setFormError(err.message || "Failed to update task");
    } finally {
      setFormLoading(false);
    }
  };

  const handleQuickStatusChange = async (task: TaskItem, newStatus: string) => {
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      loadTasks();
    } catch (err: any) {
      alert(err.message || "Cannot change status");
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/tasks/${deletingTaskId}`, {
        method: "DELETE",
      });
      setDeletingTaskId(null);
      loadTasks();
    } catch (err: any) {
      alert(err.message || "Failed to delete task");
    }
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      assigneeId: task.assignee?.id || "",
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : "",
    });
    setFormError(null);
  };

  const openHistoryModal = async (task: TaskItem) => {
    setActiveHistoryTask(task);
    try {
      setHistoryLoading(true);
      const data = await apiRequest(
        `/api/v1/workspaces/${workspaceId}/tasks/${task.id}/activity`
      );
      setActivities(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: "",
      dueAt: "",
    });
    setFormError(null);
  };

  const isViewer = workspace?.currentUserRole === "viewer";
  const canCreate = !isViewer;

  const canEditTask = (task: TaskItem) => {
    if (workspace?.currentUserRole === "owner" || workspace?.currentUserRole === "admin") {
      return true;
    }
    if (workspace?.currentUserRole === "member") {
      return task.creator.id === currentUserId || task.assignee?.id === currentUserId;
    }
    return false;
  };

  const canDeleteTask = (task: TaskItem) => {
    if (workspace?.currentUserRole === "owner" || workspace?.currentUserRole === "admin") {
      return true;
    }
    if (workspace?.currentUserRole === "member") {
      return task.creator.id === currentUserId;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {workspace?.name}
                <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {workspace?.currentUserRole}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/workspaces/${workspaceId}/settings`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <Settings className="h-4 w-4" />
              Members & Settings
            </Link>

            {canCreate && (
              <button
                onClick={() => {
                  resetTaskForm();
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold bg-slate-100 border-none rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold bg-slate-100 border-none rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No tasks found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {search || statusFilter || priorityFilter
                ? "Try clearing filters to view all tasks."
                : "Create a task to kickstart your project."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {tasks.map((task) => {
              const isOverdue =
                task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "done";
              const editable = canEditTask(task);
              const deletable = canDeleteTask(task);

              return (
                <div
                  key={task.id}
                  className="p-5 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-base font-semibold text-slate-900">
                        {task.title}
                      </span>

                      {/* Priority Badge */}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                          task.priority === "urgent"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : task.priority === "high"
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : task.priority === "medium"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {task.priority}
                      </span>

                      {/* Due Date Indicator */}
                      {task.dueAt && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                            isOverdue
                              ? "bg-red-50 text-red-700 font-bold border border-red-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {isOverdue && <AlertTriangle className="h-3 w-3" />}
                          {new Date(task.dueAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-sm text-slate-500 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                      <span>Created by: {task.creator.name}</span>
                      <span>•</span>
                      <span>
                        Assignee:{" "}
                        <strong className="text-slate-600 font-medium">
                          {task.assignee ? task.assignee.name : "Unassigned"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="flex items-center gap-3">
                    <select
                      value={task.status}
                      disabled={!editable}
                      onChange={(e) => handleQuickStatusChange(task, e.target.value)}
                      className={`text-xs font-semibold rounded-xl px-3 py-1.5 border transition cursor-pointer ${
                        task.status === "done"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : task.status === "in_progress"
                          ? "bg-blue-50 text-blue-800 border-blue-300"
                          : task.status === "blocked"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      } ${!editable && "opacity-75 cursor-not-allowed"}`}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>

                    <button
                      onClick={() => openHistoryModal(task)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                      title="View Audit Trail"
                    >
                      <History className="h-4 w-4" />
                    </button>

                    {editable && (
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Edit Task"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}

                    {deletable && (
                      <button
                        onClick={() => setDeletingTaskId(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete Task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create / Edit Task Modal */}
      {(showCreateModal || editingTask) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingTask ? "Edit Task" : "Create New Task"}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTask(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            <form
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g. Design user authentication flow"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Details, acceptance criteria, or links..."
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Status
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as any })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Assignee (Members Only)
                  </label>
                  <select
                    value={taskForm.assigneeId}
                    onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueAt}
                    onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTask(null);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTaskId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center">
            <Trash2 className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">Delete Task</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to delete this task? This action will be recorded in the audit trail.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Audit History Modal */}
      {activeHistoryTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-600" />
                  Audit Trail
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeHistoryTask.title}</p>
              </div>
              <button
                onClick={() => setActiveHistoryTask(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {historyLoading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : activities.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  No activity records found.
                </div>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-blue-700 uppercase tracking-wide">
                        {act.action.replace("_", " ")}
                      </span>
                      <span className="text-slate-400 font-normal">
                        {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Actor: {act.actor ? act.actor.name : "System / Deleted User"}
                    </div>
                    <pre className="mt-1 p-2 bg-white rounded border border-slate-200 text-[11px] text-slate-700 overflow-x-auto">
                      {JSON.stringify(act.changeSummary, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

