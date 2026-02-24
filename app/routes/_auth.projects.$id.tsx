import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { ProjectSettingsPanel } from "~/components/project-settings";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardAction,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import {
  Plus,
  Sparkles,
  Circle,
  CheckCircle2,
  Loader2,
  GitBranch,
  Clock,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceList } from "~/components/workspace-list";

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

type TaskStatus = "pending" | "running" | "completed" | "failed";

interface Task {
  id: string;
  projectId: string;
  prompt: string;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  workspaceId: string | null;
  branch: string;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

type FilterTab = "all" | TaskStatus;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string;
    icon: typeof Circle;
    className: string;
    badgeClassName: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Circle,
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
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-green-500",
    badgeClassName:
      "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "text-destructive",
    badgeClassName:
      "gap-1.5 font-normal border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  },
};

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

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
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Track previously-seen task statuses for completion notifications
  const prevTaskStatusesRef = useRef<Map<string, TaskStatus>>(new Map());

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
        const incoming = data.tasks as Task[];

        // Check for newly completed/failed tasks to fire toasts
        const prev = prevTaskStatusesRef.current;
        for (const task of incoming) {
          const old = prev.get(task.id);
          if (old && old !== task.status) {
            if (task.status === "completed") {
              toast.success(`Task completed`, {
                description:
                  task.prompt.length > 80
                    ? task.prompt.slice(0, 80) + "..."
                    : task.prompt,
              });
            } else if (task.status === "failed") {
              toast.error(`Task failed`, {
                description: task.error ?? "Something went wrong",
              });
            }
          }
        }

        // Update the ref
        const next = new Map<string, TaskStatus>();
        for (const t of incoming) next.set(t.id, t.status);
        prevTaskStatusesRef.current = next;

        setTasks(incoming);

        // Keep selected task in sync if the sheet is open
        if (selectedTask) {
          const updated = incoming.find((t) => t.id === selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }
    } catch {
      // silently fail on poll — tasks already shown from previous fetch
    } finally {
      setTasksLoading(false);
    }
  }, [project.id, selectedTask]);

  // Initial load
  useEffect(() => {
    refreshStatus();
    fetchTasks();
    // Check for active workspaces
    fetch(`/api/projects/${project.id}/sandbox`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.workspaces?.length) {
          setActiveWorkspaces(data.workspaces);
        }
      })
      .catch(() => {});
  }, [project.id, refreshStatus, fetchTasks]);

  // Polling — 5s when there are running/pending tasks, 30s otherwise
  useEffect(() => {
    const hasActive = tasks.some(
      (t) => t.status === "running" || t.status === "pending",
    );
    const interval = hasActive ? 5000 : 30000;

    const timer = setInterval(() => {
      fetchTasks();
    }, interval);

    return () => clearInterval(timer);
  }, [tasks, fetchTasks]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleQuickLaunch = async () => {
    setLaunchingQuick(true);
    setSandboxError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: "feat" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to launch sandbox");
      setActiveWorkspaces((prev) => [data.workspace, ...prev]);
      window.open(data.workspace.url, "_blank");
    } catch (err) {
      setSandboxError(
        err instanceof Error ? err.message : "Failed to launch sandbox",
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

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;

  const filteredTasks =
    filterTab === "all" ? tasks : tasks.filter((t) => t.status === filterTab);

  const filterCounts: Record<FilterTab, number> = {
    all: tasks.length,
    pending: pendingCount,
    running: runningCount,
    completed: completedCount,
    failed: failedCount,
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
                {project.githubRepo ?? "GitHub not connected"}
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
                  ? project.name
                  : vercelToken
                    ? "Vercel ready"
                    : "Vercel not connected"}
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
              {launchingQuick ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── Tasks tab ── */}
        <TabsContent value="tasks">
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

          {/* Task input or connection prompts */}
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
                        The Claude OAuth token has expired. Re-authorize or add
                        an API key below.
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
              onTaskCreated={handleTaskCreated}
              onError={(message) => setSandboxError(message)}
            />
          )}

          {/* Filter tabs + status summary */}
          {tasks.length > 0 && (
            <div className="mb-4 flex items-center gap-2 overflow-x-auto">
              {FILTER_TABS.map((tab) => {
                const count = filterCounts[tab.value];
                if (tab.value !== "all" && count === 0) return null;
                return (
                  <Button
                    key={tab.value}
                    variant={filterTab === tab.value ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setFilterTab(tab.value)}
                  >
                    {tab.label}
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs"
                    >
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          )}

          {/* Task list */}
          {tasksLoading && tasks.length === 0 ? (
            <Card className="border-dashed bg-muted/50">
              <CardContent className="flex items-center justify-center px-8 py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : tasks.length === 0 && allReady ? (
            <Card className="border-dashed bg-muted/50">
              <CardContent className="flex flex-col items-center justify-center px-8 py-16">
                <Sparkles className="mb-3 size-8 text-muted-foreground/50" />
                <h3 className="mb-1 text-lg font-semibold">No tasks yet</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Describe what you want to build and Claude will get to work.
                </p>
              </CardContent>
            </Card>
          ) : filteredTasks.length === 0 && tasks.length > 0 ? (
            <Card className="border-dashed bg-muted/50">
              <CardContent className="flex flex-col items-center justify-center px-8 py-10">
                <p className="text-sm text-muted-foreground">
                  No {filterTab} tasks
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setFilterTab("all")}
                >
                  Show all tasks
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredTasks.map((task) => {
                const config = STATUS_CONFIG[task.status];
                const StatusIcon = config.icon;

                return (
                  <Card
                    key={task.id}
                    className="cursor-pointer transition-colors hover:border-foreground/20"
                    onClick={() => {
                      setSelectedTask(task);
                      setSheetOpen(true);
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <StatusIcon
                          className={`mt-0.5 size-5 shrink-0 ${config.className} ${
                            task.status === "running" ? "animate-spin" : ""
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-relaxed">
                            {task.prompt}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {timeAgo(task.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitBranch className="size-3" />
                              {task.branch}
                            </span>
                          </div>
                        </div>
                      </div>
                      <CardAction>
                        <Badge
                          variant="secondary"
                          className={config.badgeClassName}
                        >
                          {config.label}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Task detail sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="right">
              {selectedTask && (
                <TaskDetail
                  task={selectedTask}
                  projectId={project.id}
                  workspaces={activeWorkspaces}
                />
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* ── Workspaces tab ── */}
        <TabsContent value="workspaces">
          <WorkspaceList
            projectId={project.id}
            workspaces={activeWorkspaces}
            onStopped={(id) =>
              setActiveWorkspaces((prev) => prev.filter((w) => w.id !== id))
            }
          />
          {activeWorkspaces.length === 0 && (
            <Card className="border-dashed bg-muted/50">
              <CardContent className="flex flex-col items-center justify-center px-8 py-16">
                <h3 className="mb-1 text-lg font-semibold">
                  No active workspaces
                </h3>
                <p className="text-center text-sm text-muted-foreground">
                  Run a task to spin up a sandbox workspace.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Settings tab ── */}
        <TabsContent value="settings">
          <ProjectSettingsPanel project={project} role={role} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskLauncher — Creates a persisted task then launches the sandbox
// ---------------------------------------------------------------------------

function TaskLauncher({
  projectId,
  allReady,
  onTaskCreated,
  onError,
}: {
  projectId: string;
  allReady: boolean;
  onTaskCreated: (task: Task, workspace?: Workspace) => void;
  onError: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [branch, setBranch] = useState("feat");
  const [launching, setLaunching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (launching) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [launching]);

  const handleLaunch = async () => {
    if (launching || !prompt.trim()) return;
    setLaunching(true);

    try {
      // 1. Create the task in the DB
      const taskRes = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), branch }),
      });
      const taskData = await taskRes.json();
      if (!taskRes.ok) {
        onError(taskData.error ?? "Failed to create task");
        return;
      }

      const task = taskData.task as Task;

      // 2. Launch the sandbox workspace
      const sandboxRes = await fetch(`/api/projects/${projectId}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          prompt: prompt.trim(),
        }),
      });
      const sandboxData = await sandboxRes.json();

      if (sandboxRes.ok && sandboxData.workspace) {
        // 3. Link the workspace to the task and mark as running
        await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "running",
            workspaceId: sandboxData.workspace.id,
          }),
        });

        const updatedTask = {
          ...task,
          status: "running" as TaskStatus,
          workspaceId: sandboxData.workspace.id,
          startedAt: new Date().toISOString(),
        };

        onTaskCreated(updatedTask, sandboxData.workspace);
      } else {
        // Sandbox failed but task was created — leave as pending
        onTaskCreated(task);
        onError(sandboxData.error ?? "Failed to launch sandbox");
      }

      setPrompt("");
    } catch {
      onError("Failed to create task");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card className="mb-6 border-0 shadow-none">
      <CardContent className="flex flex-col gap-3">
        <textarea
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
          rows={1}
          className="w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <GitBranch className="size-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feat"
              className="h-8 w-32 text-xs"
            />
          </div>
          <div className="flex-1" />
          <Button
            size="sm"
            disabled={!allReady || launching || !prompt.trim()}
            onClick={handleLaunch}
          >
            {launching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {launching ? `Creating... ${elapsed}s` : "Run task"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TaskDetail — Shown inside the Sheet panel
// ---------------------------------------------------------------------------

function TaskDetail({
  task,
  projectId,
  workspaces,
}: {
  task: Task;
  projectId: string;
  workspaces: Workspace[];
}) {
  const config = STATUS_CONFIG[task.status];
  const StatusIcon = config.icon;
  const workspace = workspaces.find((w) => w.id === task.workspaceId);

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={config.badgeClassName}>
            <StatusIcon
              className={`size-3.5 ${config.className} ${
                task.status === "running" ? "animate-spin" : ""
              }`}
            />
            {config.label}
          </Badge>
        </div>
        <SheetTitle className="text-base leading-relaxed">
          {task.prompt}
        </SheetTitle>
        <SheetDescription>
          <span className="flex items-center gap-1">
            <GitBranch className="size-3" />
            {task.branch}
          </span>
        </SheetDescription>
      </SheetHeader>

      {/* Timeline */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium">Timeline</h4>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Circle className="size-3" />
            <span>Created {formatTimestamp(task.createdAt)}</span>
          </div>
          {task.startedAt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3" />
              <span>Started {formatTimestamp(task.startedAt)}</span>
            </div>
          )}
          {task.completedAt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              {task.status === "completed" ? (
                <CheckCircle2 className="size-3 text-green-500" />
              ) : (
                <AlertCircle className="size-3 text-destructive" />
              )}
              <span>
                {task.status === "completed" ? "Completed" : "Failed"}{" "}
                {formatTimestamp(task.completedAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Workspace */}
      {workspace && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium">Workspace</h4>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={workspace.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3" />
                Open workspace
              </a>
            </Button>
            <span className="text-xs text-muted-foreground">
              {workspace.branch}
            </span>
          </div>
        </div>
      )}

      {/* Result */}
      {task.result && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium">Result</h4>
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="whitespace-pre-wrap text-sm">{task.result}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium text-destructive">Error</h4>
          <Alert variant="destructive">
            <AlertDescription>{task.error}</AlertDescription>
          </Alert>
        </div>
      )}
    </>
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
