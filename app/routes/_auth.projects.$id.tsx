import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { H4 } from "~/components/ui/typography";
import { requireAuth, serializeCookie } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "~/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
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
  ExternalLink,
  Ellipsis,
  ArrowUp,
  Copy,
  Play,
  CircleDot,
  Search,
  GitPullRequest,
  GitMerge,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
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
  const { org, role, memberships } = await requireAuth(request);

  // Try current org first
  let [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

  if (project) {
    return { project, role };
  }

  // Project not in current org — check if user has access via another org
  const [anyProject] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id));

  if (!anyProject) {
    throw Response.json({ error: "Project not found" }, { status: 404 });
  }

  const match = memberships.find(
    (m) => m.organizationId === anyProject.organizationId,
  );

  if (!match) {
    throw Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Auto-switch org cookie and return the project
  return new Response(JSON.stringify({ project: anyProject, role: match.role }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": serializeCookie("viagen-org", match.organizationId, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: 60 * 60 * 24 * 365,
      }),
    },
  });
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

type TaskStatus = "ready" | "running" | "validating" | "completed";

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
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

type FilterTab = "ready" | "in_review" | "completed";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
];

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
  const [filterTab, setFilterTab] = useState<FilterTab>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`viagen:tab:${project.id}`);
      if (saved === "ready" || saved === "in_review" || saved === "completed") return saved;
    }
    return "ready";
  });
  const [launchingTasks, setLaunchingTasks] = useState<Map<string, number>>(new Map());
  const launchTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const [mergingTasks, setMergingTasks] = useState<Set<string>>(new Set());

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
      const quickBranch = `feat-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: quickBranch }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to launch sandbox");
      }
      refreshWorkspaces();
      window.open(data.workspace.url, "_blank");
    } catch (err) {
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
          ? { ...t, status: "running" as TaskStatus, startedAt: new Date().toISOString() }
          : t,
      ),
    );
    prevTaskStatusesRef.current.set(task.id, "running");

    try {
      const sandboxRes = await fetch(
        `/api/projects/${project.id}/sandbox`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch: task.branch,
            prompt: task.prompt,
            model: task.model,
            taskId: task.id,
          }),
        },
      );
      const sandboxData = await sandboxRes.json();

      if (sandboxRes.ok && sandboxData.workspace) {
        // Server already linked workspace to task and set status to running
        // Update local task with workspaceId so buttons appear immediately
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "running" as TaskStatus, workspaceId: sandboxData.workspace.id }
              : t,
          ),
        );
        // Refresh workspaces from server so WorkspaceList picks it up
        refreshWorkspaces();
        fetchTasks();
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "ready" as TaskStatus, startedAt: null } : t,
          ),
        );
        prevTaskStatusesRef.current.set(task.id, "ready");
        setSandboxError(sandboxData.error ?? "Failed to launch sandbox");
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "ready" as TaskStatus, startedAt: null } : t,
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
      const sandboxRes = await fetch(
        `/api/projects/${project.id}/sandbox`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch: task.branch,
            taskId: task.id,
            // No prompt or model - this creates a preview session
          }),
        },
      );
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

  const readyTasks = tasks.filter((t) => t.status === "ready");
  const inReviewTasks = tasks.filter((t) => t.status !== "ready" && t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const filterCounts: Record<FilterTab, number> = {
    ready: readyTasks.length,
    in_review: inReviewTasks.length,
    completed: completedTasks.length,
  };

  const tabTasks: Record<FilterTab, Task[]> = {
    ready: readyTasks,
    in_review: inReviewTasks,
    completed: completedTasks,
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
            tasks={tasks}
            onStopped={(id) =>
              setActiveWorkspaces((prev) =>
                prev.filter((w) => w.id !== id),
              )
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

        {/* Task list with tabs: Ready | In Review | Completed */}
        {tasks.length > 0 && (
          <>
            <H4 className="mb-4 mt-2">Tasks</H4>
            <Tabs
              value={filterTab}
              onValueChange={(v) => {
                setFilterTab(v as FilterTab);
                localStorage.setItem(`viagen:tab:${project.id}`, v);
              }}
            >
              <TabsList variant="line" className="mb-4">
                {FILTER_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="gap-1.5"
                  >
                    {tab.label}
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs"
                    >
                      {filterCounts[tab.value]}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {FILTER_TABS.map((tab) => (
                <TabsContent key={tab.value} value={tab.value}>
                  {tabTasks[tab.value].length === 0 ? (
                    <Card className="border-dashed bg-muted/50">
                      <CardContent className="flex flex-col items-center justify-center px-8 py-10">
                        <p className="text-sm text-muted-foreground">
                          {tab.value === "ready"
                            ? "No tasks ready to run"
                            : tab.value === "in_review"
                              ? "No tasks in review"
                              : "No completed tasks"}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {tabTasks[tab.value].map((task) => (
                        <Item key={task.id} variant="outline">
                          <ItemContent>
                            <ItemTitle>
                              <Link
                                to={`/projects/${project.id}/tasks/${task.id}`}
                                className="hover:underline"
                              >
                                {task.prompt}
                              </Link>
                            </ItemTitle>
                            <ItemDescription>
                              <span className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {timeAgo(task.createdAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <GitBranch className="size-3" />
                                  {task.branch}
                                </span>
                              </span>
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            {/* Ready — Run button (or launching timer) */}
                            {task.status === "ready" && (() => {
                              const elapsed = launchingTasks.get(task.id);
                              const isLaunching = elapsed !== undefined;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="default"
                                        size="icon-sm"
                                        className="sm:w-auto sm:px-2.5 sm:h-8"
                                        disabled={isLaunching}
                                        onClick={() => runTask(task)}
                                      >
                                        {isLaunching ? (
                                          <>
                                            <Loader2 className="size-3.5 animate-spin" />
                                            <span className="hidden sm:inline">
                                              Launching… {elapsed}s
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <Play className="size-3.5" />
                                            <span className="hidden sm:inline">
                                              Run
                                            </span>
                                          </>
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Launch sandbox for this task
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                            {/* In Review — Preview button and PR link */}
                            {task.status === "validating" && (() => {
                              const elapsed = launchingTasks.get(task.id);
                              const isLaunching = elapsed !== undefined;
                              return (
                                <>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="icon-sm"
                                          className="sm:w-auto sm:px-2.5 sm:h-8"
                                          disabled={isLaunching}
                                          onClick={() => previewTask(task)}
                                        >
                                          {isLaunching ? (
                                            <>
                                              <Loader2 className="size-3.5 animate-spin" />
                                              <span className="hidden sm:inline">
                                                Launching… {elapsed}s
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="size-3.5" />
                                              <span className="hidden sm:inline">
                                                Preview
                                              </span>
                                            </>
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Launch sandbox to preview changes
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {task.prUrl && (
                                    <>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="icon-sm"
                                              className="sm:w-auto sm:px-2.5 sm:h-8"
                                              onClick={() =>
                                                window.open(task.prUrl!, "_blank")
                                              }
                                            >
                                              <GitPullRequest className="size-3.5" />
                                              <span className="hidden sm:inline">
                                                Review PR
                                              </span>
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Review pull request
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="default"
                                              size="icon-sm"
                                              className="sm:w-auto sm:px-2.5 sm:h-8"
                                              disabled={mergingTasks.has(task.id)}
                                              onClick={() => mergeTask(task)}
                                            >
                                              {mergingTasks.has(task.id) ? (
                                                <>
                                                  <Loader2 className="size-3.5 animate-spin" />
                                                  <span className="hidden sm:inline">
                                                    Merging…
                                                  </span>
                                                </>
                                              ) : (
                                                <>
                                                  <GitMerge className="size-3.5" />
                                                  <span className="hidden sm:inline">
                                                    Merge
                                                  </span>
                                                </>
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Merge pull request
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </>
                                  )}
                                </>
                              );
                            })()}
                            {/* Completed — PR link */}
                            {task.status === "completed" && task.prUrl && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="default"
                                      size="icon-sm"
                                      className="sm:w-auto sm:px-2.5 sm:h-8"
                                      onClick={() =>
                                        window.open(task.prUrl!, "_blank")
                                      }
                                    >
                                      <GitPullRequest className="size-3.5" />
                                      <span className="hidden sm:inline">
                                        View PR
                                      </span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    View pull request
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </ItemActions>
                        </Item>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
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
  const [autoStartedTaskId, setAutoStartedTaskId] = useState<string | null>(null);

  // Track elapsed time for the auto-started task
  const autoStartElapsed = autoStartedTaskId !== null
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
          <Input
            type="text"
            leadingIcon={<GitBranch className="size-3.5 overflow-visible" />}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="feat-abc123"
            className="h-7 w-40 text-xs"
          />
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
          className={isAutoLaunching ? "h-7 rounded-lg px-2.5 text-xs" : "size-7 rounded-lg"}
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
