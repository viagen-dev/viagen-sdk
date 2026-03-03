import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { H4 } from "~/components/ui/typography";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardFooter } from "~/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { Badge } from "~/components/ui/badge";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Switch } from "~/components/ui/switch";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "~/components/ui/tooltip";
import {
  Plus,
  Sparkles,
  CheckCircle2,
  Loader2,
  GitBranch,
  Clock,
  Ellipsis,
  ArrowUp,
  Play,
  CircleDot,
  Search,
  GitPullRequest,
  GitMerge,
  Eye,
  LayoutGrid,
  List,
  ChevronDown,
  AlertTriangle,
  XCircle,
  Trash2,
} from "lucide-react";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import Markdown from "react-markdown";
import { WorkspaceList } from "~/components/workspace-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org, role } = await requireAuth(request);
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    throw Response.json({ error: "Project not found" }, { status: 404 });
  }

  return { project, role };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
  vercelEnvSync: Record<string, boolean> | null;
  createdAt: string;
  updatedAt: string;
}

interface Workspace {
  id: string;
  sandboxId: string;
  url: string;
  expiresAt: string;
  branch: string;
  taskId: string | null;
  createdAt: string;
}

interface ClaudeStatus {
  connected: boolean;
  source?: "project" | "org" | "user";
  keyPrefix?: string;
  expired?: boolean;
}

interface ProjectStatus {
  ready: boolean;
  github: { linked: boolean; tokenAvailable: boolean };
  vercel: { linked: boolean; tokenAvailable: boolean };
  claude: ClaudeStatus;
}

type TaskStatus =
  | "ready"
  | "running"
  | "validating"
  | "completed"
  | "timed_out";

type BoardColumn = "backlog" | "review" | "completed";
type DisplayMode = "board" | "list";

const BOARD_COLUMNS: {
  key: BoardColumn;
  label: string;
  statuses: TaskStatus[];
}[] = [
  { key: "backlog", label: "Backlog", statuses: ["ready", "running"] },
  { key: "review", label: "Review", statuses: ["validating", "timed_out"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
];

interface Task {
  id: string;
  projectId: string;
  prompt: string;
  model: string;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  prUrl: string | null;
  workspaceId: string | null;
  branch: string;
  createdBy: string;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

function shortTaskId(id: string): string {
  return `VI-${id.slice(0, 4).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
    badgeClassName: string;
  }
> = {
  ready: {
    label: "Ready",
    icon: CircleDot,
    className: "text-muted-foreground",
    badgeClassName: "gap-1.5 font-normal",
  },
  running: {
    label: "Running",
    icon: Loader2,
    className: "text-blue-500",
    badgeClassName:
      "gap-1.5 font-normal border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  },
  validating: {
    label: "In Review",
    icon: Search,
    className: "text-yellow-500",
    badgeClassName:
      "gap-1.5 font-normal border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-green-500",
    badgeClassName:
      "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
  },
  timed_out: {
    label: "Timed Out",
    icon: AlertTriangle,
    className: "text-red-500",
    badgeClassName:
      "gap-1.5 font-normal border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectInitials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectTasks({
  loaderData,
}: {
  loaderData: { project: Project; role: string };
}) {
  const { project, role } = loaderData;
  const isAdmin = role === "admin" || role === "owner";

  // --- Project status ---
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showClaudeManage, setShowClaudeManage] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // --- Workspaces ---
  const [launchingQuick, setLaunchingQuick] = useState(false);
  const [activeWorkspaces, setActiveWorkspaces] = useState<Workspace[]>([]);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  // --- Tasks ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");

  const [launchingTasks, setLaunchingTasks] = useState<Map<string, number>>(
    new Map(),
  );
  const launchTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const [mergingTasks, setMergingTasks] = useState<Set<string>>(new Set());

  // Cancel modal state
  const [cancellingTask, setCancellingTask] = useState<Task | null>(null);
  const [cancelClosePr, setCancelClosePr] = useState(false);
  const [cancelNewBranch, setCancelNewBranch] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Delete modal state
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Track previously-seen task statuses for completion notifications
  const prevTaskStatusesRef = useRef<Map<string, TaskStatus>>(new Map());
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const refreshStatus = useCallback(() => {
    setStatusLoading(true);
    fetch(`/api/projects/${project.id}/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() =>
        setStatus({
          ready: false,
          github: { linked: false, tokenAvailable: false },
          vercel: { linked: false, tokenAvailable: false },
          claude: { connected: false },
        }),
      )
      .finally(() => setStatusLoading(false));
  }, [project.id]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.tasks) {
        // Normalize legacy statuses from before schema migration
        const incoming = (data.tasks as Task[]).map((t) => {
          const statusMap: Record<string, TaskStatus> = {
            queued: "ready",
            pending: "running",
            failed: "completed",
          };
          return statusMap[t.status]
            ? { ...t, status: statusMap[t.status] }
            : t;
        });

        // Check for newly completed/failed tasks to fire toasts
        const prev = prevTaskStatusesRef.current;
        for (const task of incoming) {
          const old = prev.get(task.id);
          if (old && old !== task.status) {
            if (task.status === "completed") {
              toast.success(`Task completed`, {
                description: task.prUrl
                  ? "Pull request created"
                  : task.prompt.length > 80
                    ? task.prompt.slice(0, 80) + "..."
                    : task.prompt,
              });
            } else if (task.status === "timed_out") {
              toast.error(`Task timed out`, {
                description: "Agent did not respond within 40 minutes",
              });
            }
          }
        }

        // Update the ref
        const next = new Map<string, TaskStatus>();
        for (const t of incoming) next.set(t.id, t.status);
        prevTaskStatusesRef.current = next;

        setTasks(incoming);
      }
    } catch {
      // silently fail on poll — tasks already shown from previous fetch
    } finally {
      setTasksLoading(false);
    }
  }, [project.id]);

  // Refresh workspaces from API
  const refreshWorkspaces = useCallback(() => {
    fetch(`/api/projects/${project.id}/sandbox`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.workspaces) setActiveWorkspaces(data.workspaces);
      })
      .catch(() => {});
  }, [project.id]);

  // Initial load
  useEffect(() => {
    refreshStatus();
    fetchTasks();
    refreshWorkspaces();
  }, [project.id, refreshStatus, fetchTasks, refreshWorkspaces]);

  // Polling — 5s when there are running/validating tasks, 30s otherwise
  const hasActiveTasks = tasks.some(
    (t) => t.status === "running" || t.status === "validating",
  );
  useEffect(() => {
    const interval = hasActiveTasks ? 5000 : 30000;

    const timer = setInterval(() => {
      fetchTasks();
    }, interval);

    return () => clearInterval(timer);
  }, [hasActiveTasks, fetchTasks]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleQuickLaunch = async () => {
    setLaunchingQuick(true);
    setSandboxError(null);
    try {
      // 1. Create a task so the workspace is tracked in the task system
      console.log("[QuickLaunch] Creating task for project:", project.id);
      const quickBranch = `feat-${Math.random().toString(36).slice(2, 8)}`;
      const taskRes = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Quick workspace session",
          branch: quickBranch,
          model: "claude-sonnet-4-20250514",
        }),
      });

      const taskText = await taskRes.text();
      console.log(
        "[QuickLaunch] Task response status:",
        taskRes.status,
        "body:",
        taskText,
      );
      let taskData: any;
      try {
        taskData = JSON.parse(taskText);
      } catch {
        throw new Error(
          `Task creation returned non-JSON (status ${taskRes.status}): ${taskText.slice(0, 200)}`,
        );
      }
      if (!taskRes.ok) {
        throw new Error(taskData.error ?? "Failed to create task");
      }
      const task = taskData.task as Task;
      console.log("[QuickLaunch] Task created:", task.id);

      // 2. Launch the sandbox workspace
      console.log("[QuickLaunch] Launching sandbox...");
      const res = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: quickBranch,
          model: "claude-sonnet-4-20250514",
        }),
      });

      const sandboxText = await res.text();
      console.log(
        "[QuickLaunch] Sandbox response status:",
        res.status,
        "body:",
        sandboxText.slice(0, 300),
      );
      let data: any;
      try {
        data = JSON.parse(sandboxText);
      } catch {
        throw new Error(
          `Sandbox launch returned non-JSON (status ${res.status}): ${sandboxText.slice(0, 200)}`,
        );
      }
      if (!res.ok) {
        // Sandbox failed but task was created — leave as pending
        handleTaskCreated(task);
        throw new Error(data.error ?? "Failed to launch sandbox");
      }

      // 3. Link workspace to the task and mark as running
      console.log(
        "[QuickLaunch] Linking workspace",
        data.workspace.id,
        "to task",
        task.id,
      );
      await fetch(`/api/projects/${project.id}/tasks/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "running",
          workspaceId: data.workspace.id,
        }),
      });

      const updatedTask: Task = {
        ...task,
        status: "running",
        workspaceId: data.workspace.id,
        startedAt: new Date().toISOString(),
      };

      handleTaskCreated(updatedTask, data.workspace);
      console.log("[QuickLaunch] Success — opening workspace URL");
      window.open(data.workspace.url, "_blank");
    } catch (err) {
      console.error("[QuickLaunch] Error:", err);
      setSandboxError(
        err instanceof Error ? err.message : "Failed to launch workspace",
      );
    } finally {
      setLaunchingQuick(false);
    }
  };

  const handleDisconnectClaude = async () => {
    setDisconnecting(true);
    try {
      await fetch(`/api/projects/${project.id}/claude`, {
        method: "DELETE",
        credentials: "include",
      });
      setShowClaudeManage(false);
      refreshStatus();
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim() || savingKey) return;
    setSavingKey(true);
    setKeyError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/claude`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setKeyError(data.error ?? "Failed to save key");
        setSavingKey(false);
        return;
      }
      setApiKeyInput("");
      setShowClaudeManage(false);
      refreshStatus();
    } catch {
      setKeyError("Failed to save key");
    } finally {
      setSavingKey(false);
    }
  };

  /**
   * Called by WorkspaceLauncher after creating a task + workspace.
   * We optimistically add the task and refresh from API.
   */
  const handleTaskCreated = (task: Task, workspace?: Workspace) => {
    setTasks((prev) => [task, ...prev]);
    prevTaskStatusesRef.current.set(task.id, task.status);
    if (workspace) {
      setActiveWorkspaces((prev) => [workspace, ...prev]);
    }
    // Refresh to get accurate server state
    setTimeout(() => fetchTasks(), 1000);
  };

  // Launch timer helpers — supports multiple concurrent launches
  const startLaunchTimer = (taskId: string) => {
    setLaunchingTasks((prev) => new Map(prev).set(taskId, 0));
    const timer = setInterval(() => {
      setLaunchingTasks((prev) => {
        const next = new Map(prev);
        const cur = next.get(taskId);
        if (cur !== undefined) next.set(taskId, cur + 1);
        return next;
      });
    }, 1000);
    launchTimersRef.current.set(taskId, timer);
  };
  const stopLaunchTimer = (taskId: string) => {
    setLaunchingTasks((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    const timer = launchTimersRef.current.get(taskId);
    if (timer) {
      clearInterval(timer);
      launchTimersRef.current.delete(taskId);
    }
  };

  /**
   * Launch a sandbox for a pending task (run from backlog).
   */
  const runTask = async (task: Task) => {
    // Start the elapsed-time counter
    startLaunchTimer(task.id);

    // Optimistically mark as running in the UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "running" as TaskStatus,
              startedAt: new Date().toISOString(),
            }
          : t,
      ),
    );
    prevTaskStatusesRef.current.set(task.id, "running");

    try {
      const sandboxRes = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: task.branch,
          prompt: task.prompt,
          model: task.model,
          taskId: task.id,
        }),
      });
      const sandboxData = await sandboxRes.json();

      if (sandboxRes.ok && sandboxData.workspace) {
        // Server already linked workspace to task and set status to running
        // Update local task with workspaceId so buttons appear immediately
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: "running" as TaskStatus,
                  workspaceId: sandboxData.workspace.id,
                }
              : t,
          ),
        );
        // Refresh workspaces from server so WorkspaceList picks it up
        refreshWorkspaces();
        fetchTasks();
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "ready" as TaskStatus, startedAt: null }
              : t,
          ),
        );
        prevTaskStatusesRef.current.set(task.id, "ready");
        setSandboxError(sandboxData.error ?? "Failed to launch sandbox");
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: "ready" as TaskStatus, startedAt: null }
            : t,
        ),
      );
      prevTaskStatusesRef.current.set(task.id, "ready");
      setSandboxError("Failed to launch sandbox");
    } finally {
      stopLaunchTimer(task.id);
    }
  };

  /**
   * Launch a sandbox for a task in preview mode (no prompt).
   */
  const previewTask = async (task: Task) => {
    // Start the elapsed-time counter
    startLaunchTimer(task.id);

    try {
      const sandboxRes = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: task.branch,
          taskId: task.id,
          // No prompt or model - this creates a preview session
        }),
      });
      const sandboxData = await sandboxRes.json();

      if (sandboxRes.ok && sandboxData.workspace) {
        // Refresh workspaces from server so WorkspaceList picks it up
        refreshWorkspaces();
        fetchTasks();
      } else {
        setSandboxError("Failed to launch preview sandbox");
      }
    } catch {
      setSandboxError("Failed to launch preview sandbox");
    } finally {
      stopLaunchTimer(task.id);
    }
  };

  /**
   * Merge the PR for a task and mark it completed.
   */
  const mergeTask = async (task: Task) => {
    setMergingTasks((prev) => new Set(prev).add(task.id));
    try {
      const res = await fetch(
        `/api/projects/${project.id}/tasks/${task.id}/merge`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Pull request merged");
        fetchTasks();
      } else {
        toast.error(data.error ?? "Failed to merge PR");
      }
    } catch {
      toast.error("Failed to merge PR");
    } finally {
      setMergingTasks((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  /**
   * Open the cancel confirmation modal for a task.
   */
  const openCancelModal = (task: Task) => {
    setCancellingTask(task);
    setCancelClosePr(false);
    setCancelNewBranch(`feat-${Math.random().toString(36).slice(2, 8)}`);
    setCancelling(false);
  };

  /**
   * Confirm cancel: stop sandbox, optionally close PR, reset task.
   */
  const confirmCancel = async () => {
    if (!cancellingTask) return;
    setCancelling(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/tasks/${cancellingTask.id}/cancel`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            closePr: cancelClosePr,
            newBranch: cancelNewBranch.trim() || undefined,
          }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Task cancelled");
        fetchTasks();
        refreshWorkspaces();
        setCancellingTask(null);
      } else {
        toast.error(data.error ?? "Failed to cancel task");
      }
    } catch {
      toast.error("Failed to cancel task");
    } finally {
      setCancelling(false);
    }
  };

  /**
   * Open the delete confirmation modal for a task.
   */
  const openDeleteModal = (task: Task) => {
    setDeletingTask(task);
    setDeleting(false);
  };

  /**
   * Confirm delete: permanently delete the task and any associated workspace.
   */
  const confirmDelete = async () => {
    if (!deletingTask) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/tasks/${deletingTask.id}/delete`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Task deleted");
        fetchTasks();
        refreshWorkspaces();
        setDeletingTask(null);
      } else {
        toast.error(data.error ?? "Failed to delete task");
      }
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const githubLinked = status?.github.linked ?? !!project.githubRepo;
  const githubToken = status?.github.tokenAvailable ?? false;
  const vercelLinked = status?.vercel.linked ?? !!project.vercelProjectId;
  const vercelToken = status?.vercel.tokenAvailable ?? false;
  const claudeConnected = status?.claude.connected ?? false;
  const claudeExpired = status?.claude.expired ?? false;
  const allReady = status?.ready ?? false;

  const missingStep =
    !githubLinked || !githubToken
      ? "github"
      : !claudeConnected || claudeExpired
        ? "claude"
        : null;

  const boardTasks: Record<BoardColumn, Task[]> = {
    backlog: tasks.filter(
      (t) => t.status === "ready" || t.status === "running",
    ),
    review: tasks.filter(
      (t) => t.status === "validating" || t.status === "timed_out",
    ),
    completed: tasks.filter((t) => t.status === "completed"),
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {project.vercelProjectId && (
              <AvatarImage
                src={`https://${project.vercelProjectId}.vercel.app/favicon.ico`}
                alt={project.name}
              />
            )}
            <AvatarFallback className="bg-foreground text-background text-sm font-semibold">
              {projectInitials(project.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold leading-tight sm:text-2xl">
              {project.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant={githubLinked && githubToken ? "secondary" : "outline"}
                className={
                  githubLinked && githubToken
                    ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                    : "gap-1.5 font-normal text-muted-foreground"
                }
              >
                <GitHubIcon />
                {project.githubRepo ?? "Not linked"}
              </Badge>
              <Badge
                variant={vercelToken ? "secondary" : "outline"}
                className={
                  vercelToken
                    ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                    : "gap-1.5 font-normal text-muted-foreground"
                }
              >
                <VercelIcon />
                {project.vercelProjectId
                  ? (project.vercelProjectName ?? project.vercelProjectId)
                  : "Not linked"}
              </Badge>
              <Badge
                variant={
                  claudeConnected && !claudeExpired ? "secondary" : "outline"
                }
                className={`cursor-pointer ${
                  claudeExpired
                    ? "gap-1.5 font-normal border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                    : claudeConnected
                      ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                      : "gap-1.5 font-normal text-muted-foreground"
                }`}
                onClick={() =>
                  claudeConnected && setShowClaudeManage((v) => !v)
                }
              >
                <Sparkles className="size-3" />
                {claudeExpired
                  ? "Claude token expired"
                  : claudeConnected
                    ? "Claude connected"
                    : "Claude not connected"}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              disabled={!allReady || launchingQuick}
              onClick={handleQuickLaunch}
            >
              {launchingQuick ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {launchingQuick ? "Creating..." : "Quick Workspace"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/projects/${project.id}/settings`}>
                    Project Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div>
        {/* Claude manage section (toggled by clicking badge) */}
        {showClaudeManage && claudeConnected && (
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">Claude</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {status?.claude.source} level
                    {status?.claude.keyPrefix && (
                      <> ({status.claude.keyPrefix})</>
                    )}
                  </span>
                </div>
                {isAdmin && status?.claude.source === "project" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectClaude}
                    disabled={disconnecting}
                    className="text-destructive hover:text-destructive/80"
                  >
                    {disconnecting ? "Removing..." : "Disconnect"}
                  </Button>
                )}
              </div>
              {isAdmin && (
                <>
                  {keyError && (
                    <Alert variant="destructive">
                      <AlertDescription>{keyError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="sk-ant-api... (replaces current key)"
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                    />
                    <Button
                      onClick={handleSaveKey}
                      disabled={!apiKeyInput.trim() || savingKey}
                      size="sm"
                    >
                      {savingKey ? "Saving..." : "Update"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {sandboxError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{sandboxError}</AlertDescription>
          </Alert>
        )}

        {/* Active workspaces — always visible at the top */}
        {activeWorkspaces.length > 0 && (
          <WorkspaceList
            projectId={project.id}
            workspaces={activeWorkspaces}
            onStopped={(id) =>
              setActiveWorkspaces((prev) => prev.filter((w) => w.id !== id))
            }
          />
        )}

        {/* Create a Task */}
        <H4 className="mb-4">Create a Task</H4>
        {statusLoading ? (
          <Card className="mb-6">
            <CardContent>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">Checking connections...</span>
              </div>
            </CardContent>
          </Card>
        ) : missingStep === "github" ? (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center gap-4 px-8 py-10">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <GitHubIcon size={24} />
              </div>
              <div className="text-center">
                <h3 className="mb-1 text-lg font-semibold">
                  {!githubToken
                    ? "Connect GitHub to get started"
                    : "Link a GitHub repository"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {!githubToken
                    ? "Connect your GitHub account to access repositories."
                    : "This project needs to be linked to a GitHub repository."}
                </p>
              </div>
              {!githubToken ? (
                <Button asChild>
                  <a
                    href={`/api/integrations/github/start?return_to=/projects/${project.id}`}
                  >
                    Connect GitHub
                  </a>
                </Button>
              ) : (
                <Button asChild>
                  <Link to={`/projects/${project.id}/settings`}>
                    Link Repository
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : missingStep === "claude" ? (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center gap-4 px-8 py-10">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Sparkles className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="mb-1 text-lg font-semibold">
                  {claudeExpired
                    ? "Claude token expired"
                    : "Connect Claude to get started"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {claudeExpired ? (
                    <>
                      The Claude OAuth token has expired. Re-authorize or add an
                      API key below.
                    </>
                  ) : (
                    <>
                      An Anthropic API key is required to run tasks. Add one
                      below for this project, or set a shared key in{" "}
                      <Link
                        to="/settings"
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        team settings
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>

              {keyError && (
                <Alert variant="destructive" className="w-full max-w-md">
                  <AlertDescription>{keyError}</AlertDescription>
                </Alert>
              )}

              <div className="flex w-full max-w-md gap-2">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-api..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                />
                <Button
                  onClick={handleSaveKey}
                  disabled={!apiKeyInput.trim() || savingKey}
                >
                  {savingKey ? "Saving..." : "Connect"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <TaskLauncher
            projectId={project.id}
            allReady={allReady}
            launchingTasks={launchingTasks}
            onTaskCreated={handleTaskCreated}
            onRunTask={runTask}
            onError={(message) => setSandboxError(message)}
          />
        )}

        {/* Task board — Kanban columns: Backlog | Review | Merged */}
        {tasks.length > 0 && (
          <>
            <div className="mb-4 mt-2 flex items-center justify-between">
              <H4 className="mb-0">Tasks</H4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Display
                    <ChevronDown className="size-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setDisplayMode("board")}
                    className={displayMode === "board" ? "bg-accent" : ""}
                  >
                    <LayoutGrid className="size-3.5" />
                    Board
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDisplayMode("list")}
                    className={displayMode === "list" ? "bg-accent" : ""}
                  >
                    <List className="size-3.5" />
                    List
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {displayMode === "board" ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {BOARD_COLUMNS.map((col) => {
                  const colTasks = boardTasks[col.key];
                  return (
                    <div key={col.key} className="flex flex-col">
                      {/* Column header */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {col.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {colTasks.length}
                        </span>
                      </div>

                      {/* Column body */}
                      <div className="flex flex-col gap-3">
                        {colTasks.length === 0 ? (
                          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                            {col.key === "backlog"
                              ? "No tasks in backlog"
                              : col.key === "review"
                                ? "No tasks in review"
                                : "No merged tasks"}
                          </div>
                        ) : (
                          colTasks.map((task) => {
                            const elapsed = launchingTasks.get(task.id);
                            const isLaunching = elapsed !== undefined;
                            return (
                              <Link
                                key={task.id}
                                to={`/projects/${project.id}/tasks/${task.id}`}
                                className="group block"
                              >
                                <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
                                  {/* Top row: short ID + avatar */}
                                  <div className="mb-1.5 flex items-start justify-between">
                                    <span className="text-sm font-semibold">
                                      {shortTaskId(task.id)}
                                    </span>
                                    <Avatar size="sm">
                                      {task.creatorAvatarUrl && (
                                        <AvatarImage
                                          src={task.creatorAvatarUrl}
                                          alt={task.creatorName ?? "User"}
                                        />
                                      )}
                                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                                        {task.creatorName
                                          ? task.creatorName
                                              .split(/\s+/)
                                              .map((w) => w[0])
                                              .join("")
                                              .slice(0, 2)
                                              .toUpperCase()
                                          : "??"}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>

                                  {/* Description */}
                                  <div className="mb-3 text-sm text-muted-foreground line-clamp-2 prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>*]:m-0">
                                    <Markdown>{task.prompt}</Markdown>
                                  </div>

                                  {/* Status badges */}
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    {task.status === "running" && (
                                      <Badge
                                        variant="secondary"
                                        className="gap-1 text-xs font-normal border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                                      >
                                        <Loader2 className="size-3 animate-spin" />
                                        Running
                                      </Badge>
                                    )}
                                    {task.prUrl && (
                                      <Badge
                                        variant="outline"
                                        className="gap-1 text-xs font-normal"
                                      >
                                        <GitPullRequest className="size-3" />
                                        PR
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Timestamp */}
                                  <p className="text-xs text-muted-foreground">
                                    Updated{" "}
                                    {timeAgo(task.startedAt ?? task.createdAt)}
                                  </p>

                                  {/* Action buttons — stop propagation so they don't navigate */}
                                  {(task.status === "ready" ||
                                    task.status === "running" ||
                                    task.status === "validating" ||
                                    task.status === "timed_out") && (
                                    <div
                                      className="mt-3 flex items-center gap-2 border-t pt-3"
                                      onClick={(e) => e.preventDefault()}
                                    >
                                      {task.status === "ready" && (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          className="h-7 text-xs"
                                          disabled={isLaunching}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            runTask(task);
                                          }}
                                        >
                                          {isLaunching ? (
                                            <>
                                              <Loader2 className="size-3 animate-spin" />
                                              Launching… {elapsed}s
                                            </>
                                          ) : (
                                            <>
                                              <Play className="size-3" />
                                              Run
                                            </>
                                          )}
                                        </Button>
                                      )}
                                      {task.status === "validating" && (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs"
                                            disabled={isLaunching}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              previewTask(task);
                                            }}
                                          >
                                            {isLaunching ? (
                                              <>
                                                <Loader2 className="size-3 animate-spin" />
                                                Launching… {elapsed}s
                                              </>
                                            ) : (
                                              <>
                                                <Eye className="size-3" />
                                                Preview
                                              </>
                                            )}
                                          </Button>
                                          {task.prUrl && (
                                            <>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  window.open(
                                                    task.prUrl!,
                                                    "_blank",
                                                  );
                                                }}
                                              >
                                                <GitPullRequest className="size-3" />
                                                Review PR
                                              </Button>
                                              <Button
                                                variant="default"
                                                size="sm"
                                                className="h-7 text-xs"
                                                disabled={mergingTasks.has(
                                                  task.id,
                                                )}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  mergeTask(task);
                                                }}
                                              >
                                                {mergingTasks.has(task.id) ? (
                                                  <>
                                                    <Loader2 className="size-3 animate-spin" />
                                                    Merging…
                                                  </>
                                                ) : (
                                                  <>
                                                    <GitMerge className="size-3" />
                                                    Merge
                                                  </>
                                                )}
                                              </Button>
                                            </>
                                          )}
                                        </>
                                      )}
                                      {task.status === "timed_out" && (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          className="h-7 text-xs"
                                          disabled={isLaunching}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            runTask(task);
                                          }}
                                        >
                                          {isLaunching ? (
                                            <>
                                              <Loader2 className="size-3 animate-spin" />
                                              Launching… {elapsed}s
                                            </>
                                          ) : (
                                            <>
                                              <Play className="size-3" />
                                              Retry
                                            </>
                                          )}
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openCancelModal(task);
                                        }}
                                      >
                                        <XCircle className="size-3" />
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openDeleteModal(task);
                                        }}
                                      >
                                        <Trash2 className="size-3" />
                                        Delete
                                      </Button>
                                    </div>
                                  )}
                                  {task.status === "completed" &&
                                    task.prUrl && (
                                      <div
                                        className="mt-3 flex items-center gap-2 border-t pt-3"
                                        onClick={(e) => e.preventDefault()}
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            window.open(task.prUrl!, "_blank");
                                          }}
                                        >
                                          <GitPullRequest className="size-3" />
                                          View PR
                                        </Button>
                                      </div>
                                    )}
                                </div>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ---- List view ---- */
              <div className="flex flex-col gap-6">
                {BOARD_COLUMNS.map((col) => {
                  const colTasks = boardTasks[col.key];
                  return (
                    <div key={col.key}>
                      {/* Section header */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {col.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {colTasks.length}
                        </span>
                      </div>

                      {/* Section rows */}
                      <div className="flex flex-col gap-2">
                        {colTasks.length === 0 ? (
                          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                            {col.key === "backlog"
                              ? "No tasks in backlog"
                              : col.key === "review"
                                ? "No tasks in review"
                                : "No merged tasks"}
                          </div>
                        ) : (
                          colTasks.map((task) => {
                            const config = STATUS_CONFIG[task.status];
                            const StatusIcon = config.icon;
                            const elapsed = launchingTasks.get(task.id);
                            const isLaunching = elapsed !== undefined;
                            return (
                              <Link
                                key={task.id}
                                to={`/projects/${project.id}/tasks/${task.id}`}
                                className="group block"
                              >
                                <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
                                  {/* Avatar */}
                                  <Avatar size="sm" className="shrink-0">
                                    {task.creatorAvatarUrl && (
                                      <AvatarImage
                                        src={task.creatorAvatarUrl}
                                        alt={task.creatorName ?? "User"}
                                      />
                                    )}
                                    <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                                      {task.creatorName
                                        ? task.creatorName
                                            .split(/\s+/)
                                            .map((w) => w[0])
                                            .join("")
                                            .slice(0, 2)
                                            .toUpperCase()
                                        : "??"}
                                    </AvatarFallback>
                                  </Avatar>

                                  {/* Task info */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        {shortTaskId(task.id)}
                                      </span>
                                      <span className="truncate text-sm font-medium prose prose-sm dark:prose-invert max-w-none [&>*]:inline [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>*]:m-0">
                                        <Markdown>{task.prompt}</Markdown>
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="size-3" />
                                        {timeAgo(
                                          task.startedAt ?? task.createdAt,
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Status badge */}
                                  <Badge
                                    variant="secondary"
                                    className={config.badgeClassName}
                                  >
                                    <StatusIcon
                                      className={`size-3 ${config.className} ${task.status === "running" ? "animate-spin" : ""}`}
                                    />
                                    {config.label}
                                  </Badge>

                                  {/* Actions */}
                                  <div
                                    className="flex shrink-0 items-center gap-2"
                                    onClick={(e) => e.preventDefault()}
                                  >
                                    {task.status === "ready" && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-7 text-xs"
                                        disabled={isLaunching}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          runTask(task);
                                        }}
                                      >
                                        {isLaunching ? (
                                          <>
                                            <Loader2 className="size-3 animate-spin" />
                                            Launching… {elapsed}s
                                          </>
                                        ) : (
                                          <>
                                            <Play className="size-3" />
                                            Run
                                          </>
                                        )}
                                      </Button>
                                    )}
                                    {task.status === "validating" && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-xs"
                                          disabled={isLaunching}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            previewTask(task);
                                          }}
                                        >
                                          {isLaunching ? (
                                            <>
                                              <Loader2 className="size-3 animate-spin" />
                                              Launching… {elapsed}s
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="size-3" />
                                              Preview
                                            </>
                                          )}
                                        </Button>
                                        {task.prUrl && (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 text-xs"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                window.open(
                                                  task.prUrl!,
                                                  "_blank",
                                                );
                                              }}
                                            >
                                              <GitPullRequest className="size-3" />
                                              Review PR
                                            </Button>
                                            <Button
                                              variant="default"
                                              size="sm"
                                              className="h-7 text-xs"
                                              disabled={mergingTasks.has(
                                                task.id,
                                              )}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                mergeTask(task);
                                              }}
                                            >
                                              {mergingTasks.has(task.id) ? (
                                                <>
                                                  <Loader2 className="size-3 animate-spin" />
                                                  Merging…
                                                </>
                                              ) : (
                                                <>
                                                  <GitMerge className="size-3" />
                                                  Merge
                                                </>
                                              )}
                                            </Button>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {task.status === "timed_out" && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-7 text-xs"
                                        disabled={isLaunching}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          runTask(task);
                                        }}
                                      >
                                        {isLaunching ? (
                                          <>
                                            <Loader2 className="size-3 animate-spin" />
                                            Launching… {elapsed}s
                                          </>
                                        ) : (
                                          <>
                                            <Play className="size-3" />
                                            Retry
                                          </>
                                        )}
                                      </Button>
                                    )}
                                    {(task.status === "running" ||
                                      task.status === "validating" ||
                                      task.status === "timed_out") && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openCancelModal(task);
                                        }}
                                      >
                                        <XCircle className="size-3" />
                                        Cancel
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        openDeleteModal(task);
                                      }}
                                    >
                                      <Trash2 className="size-3" />
                                      Delete
                                    </Button>
                                    {task.status === "completed" &&
                                      task.prUrl && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            window.open(task.prUrl!, "_blank");
                                          }}
                                        >
                                          <GitPullRequest className="size-3" />
                                          View PR
                                        </Button>
                                      )}
                                  </div>
                                </div>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel task confirmation modal */}
      <AlertDialog
        open={cancellingTask !== null}
        onOpenChange={(open) => !open && setCancellingTask(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the sandbox and reset the task back to ready.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-2">
            {cancellingTask?.prUrl && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cancel-close-pr" className="text-sm">
                  Also close the open pull request
                </Label>
                <Switch
                  id="cancel-close-pr"
                  checked={cancelClosePr}
                  onCheckedChange={setCancelClosePr}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="cancel-new-branch" className="text-sm">
                Restart on a new branch
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cancel-new-branch"
                  value={cancelNewBranch}
                  onChange={(e) => setCancelNewBranch(e.target.value)}
                  placeholder="Leave empty to keep current branch"
                  className="h-8 text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Current: {cancellingTask?.branch}
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Keep Running
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Cancel Task"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete task confirmation modal */}
      <AlertDialog
        open={deletingTask !== null}
        onOpenChange={(open) => !open && setDeletingTask(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task and any associated
              workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete Task"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskLauncher — Creates a persisted task then launches the sandbox
// ---------------------------------------------------------------------------

function TaskLauncher({
  projectId,
  allReady,
  launchingTasks,
  onTaskCreated,
  onRunTask,
  onError,
}: {
  projectId: string;
  allReady: boolean;
  launchingTasks: Map<string, number>;
  onTaskCreated: (task: Task, workspace?: Workspace) => void;
  onRunTask: (task: Task) => void;
  onError: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [branch, setBranch] = useState(
    () => `feat-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [autoStart, setAutoStart] = useState(false);
  const [creating, setCreating] = useState(false);
  const [autoStartedTaskId, setAutoStartedTaskId] = useState<string | null>(
    null,
  );

  // Track elapsed time for the auto-started task
  const autoStartElapsed =
    autoStartedTaskId !== null
      ? launchingTasks.get(autoStartedTaskId)
      : undefined;
  const isAutoLaunching = autoStartElapsed !== undefined;

  // Clear auto-started task ID when launch finishes
  useEffect(() => {
    if (autoStartedTaskId && !launchingTasks.has(autoStartedTaskId)) {
      setAutoStartedTaskId(null);
    }
  }, [autoStartedTaskId, launchingTasks]);

  const handleLaunch = async () => {
    if (creating || isAutoLaunching || !prompt.trim()) return;
    setCreating(true);

    try {
      const taskRes = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          branch,
          model,
        }),
      });
      const taskData = await taskRes.json();
      if (!taskRes.ok) {
        onError(taskData.error ?? "Failed to create task");
        return;
      }

      const task = taskData.task as Task;
      onTaskCreated(task);
      setPrompt("");

      if (autoStart) {
        setAutoStartedTaskId(task.id);
        onRunTask(task);
      }
    } catch {
      onError("Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent>
        <Textarea
          placeholder="Describe a task for Claude to work on..."
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleLaunch();
            }
          }}
          rows={2}
          className="resize-none overflow-hidden border-0 shadow-none focus-visible:ring-0"
        />
      </CardContent>
      <CardFooter className="border-t justify-between">
        <div className="flex items-center gap-4">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger size="sm" className="h-7 w-auto gap-1.5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet-4-20250514">
                Claude Sonnet 4
              </SelectItem>
              <SelectItem value="claude-opus-4-0520">Claude Opus 4</SelectItem>
              <SelectItem value="claude-3-5-haiku-20241022">
                Claude Haiku 3.5
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <GitBranch className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feat-abc123"
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Switch
              checked={autoStart}
              onCheckedChange={setAutoStart}
              className="scale-75"
            />
            <span className="text-xs text-muted-foreground select-none">
              Auto-start
            </span>
          </label>
        </div>
        <Button
          size={isAutoLaunching ? "sm" : "icon-sm"}
          disabled={!allReady || creating || isAutoLaunching || !prompt.trim()}
          onClick={handleLaunch}
          className={
            isAutoLaunching
              ? "h-7 rounded-lg px-2.5 text-xs"
              : "size-7 rounded-lg"
          }
        >
          {isAutoLaunching ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Launching… {autoStartElapsed}s
            </>
          ) : creating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function VercelIcon() {
  return (
    <svg viewBox="0 0 76 65" className="size-3 fill-current" aria-hidden>
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

function GitHubIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
