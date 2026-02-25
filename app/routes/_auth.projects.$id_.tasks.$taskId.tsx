import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { WorkspaceList } from "~/components/workspace-list";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Clock,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  GitMerge,
  Loader2,
  Play,
  Search,
  Sparkles,
  Timer,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string; taskId: string };
}) {
  const { org } = await requireAuth(request);

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    log.warn(
      { projectId: params.id, orgId: org.id },
      "task detail: project not found or not in org",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.id, params.taskId), eq(tasks.projectId, project.id)),
    );

  if (!task) {
    log.warn(
      { projectId: project.id, taskId: params.taskId },
      "task detail: task not found",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  log.debug(
    { projectId: project.id, taskId: task.id },
    "task detail page loaded",
  );

  return { task, project };
}

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

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

interface Workspace {
  id: string;
  sandboxId: string;
  url: string;
  expiresAt: string;
  branch: string;
  taskId: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  githubRepo: string | null;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: typeof CheckCircle2; className: string; badgeClassName: string }
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTokens(count: number | null): string {
  if (count == null) return "—";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskDetailRoute({
  loaderData,
}: {
  loaderData: { task: Task; project: Project };
}) {
  const { project } = loaderData;
  const [task, setTask] = useState<Task>(loaderData.task);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchElapsed, setLaunchElapsed] = useState(0);
  const launchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  // Merge the PR for this task
  const handleMerge = async () => {
    setMerging(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/tasks/${task.id}/merge`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Pull request merged");
        if (data.task) setTask(data.task);
      } else {
        toast.error(data.error ?? "Failed to merge PR");
      }
    } catch {
      toast.error("Failed to merge PR");
    } finally {
      setMerging(false);
    }
  };

  // Fetch task from API
  const refreshTask = useCallback(() => {
    fetch(`/api/projects/${project.id}/tasks/${task.id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.task) setTask(data.task);
      })
      .catch(() => {});
  }, [project.id, task.id]);

  // Fetch workspaces
  const refreshWorkspaces = useCallback(() => {
    fetch(`/api/projects/${project.id}/sandbox`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.workspaces) {
          // Only show workspaces linked to this task
          const linked = (data.workspaces as Workspace[]).filter(
            (w) => w.taskId === task.id,
          );
          setWorkspaces(linked);
        }
      })
      .catch(() => {});
  }, [project.id, task.id]);

  // Initial load
  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Poll when task is active
  const isActive = task.status === "running" || task.status === "validating";
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      refreshTask();
      refreshWorkspaces();
    }, 5000);
    return () => clearInterval(timer);
  }, [isActive, refreshTask, refreshWorkspaces]);

  // Launch workspace — "Run" includes prompt, "Preview" is empty session
  const handleLaunch = async () => {
    const isRun = task.status === "ready";
    setLaunching(true);
    setLaunchElapsed(0);
    setError(null);

    const timer = setInterval(() => setLaunchElapsed((p) => p + 1), 1000);
    launchTimerRef.current = timer;

    try {
      const res = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: task.branch,
          taskId: task.id,
          ...(isRun ? { prompt: task.prompt, model: task.model } : {}),
        }),
      });
      const data = await res.json();

      if (res.ok && data.workspace) {
        refreshWorkspaces();
        refreshTask();
      } else {
        setError(data.error ?? "Failed to launch workspace");
      }
    } catch {
      setError("Failed to launch workspace");
    } finally {
      setLaunching(false);
      clearInterval(timer);
      launchTimerRef.current = null;
    }
  };

  const statusConfig = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.ready;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="mx-auto max-w-3xl py-8 px-4">
      {/* Back link */}
      <Link
        to={`/projects/${project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-3.5" />
        {project.name}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className={statusConfig.badgeClassName}>
              <StatusIcon
                className={`size-3.5 ${statusConfig.className} ${task.status === "running" ? "animate-spin" : ""}`}
              />
              {statusConfig.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {timeAgo(task.createdAt)}
            </span>
          </div>
          <p className="text-base leading-relaxed">{task.prompt}</p>
        </div>
      </div>

      {/* Active workspace */}
      {workspaces.length > 0 && (
        <div className="mb-6">
          <WorkspaceList
            projectId={project.id}
            workspaces={workspaces}
            tasks={[{ id: task.id, prompt: task.prompt }]}
            onStopped={(id) =>
              setWorkspaces((prev) => prev.filter((w) => w.id !== id))
            }
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        {(task.status === "ready" || task.status === "validating" || task.status === "completed") &&
          workspaces.length === 0 && (
            <Button
              onClick={handleLaunch}
              disabled={launching}
              size="sm"
            >
              {launching ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Launching… {launchElapsed}s
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  {task.status === "ready" ? "Run" : "Preview"}
                </>
              )}
            </Button>
          )}
        {task.prUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(task.prUrl!, "_blank")}
          >
            <GitPullRequest className="size-3.5" />
            {task.status === "validating" ? "Review PR" : "View PR"}
          </Button>
        )}
        {task.status === "validating" && task.prUrl && (
          <Button
            size="sm"
            disabled={merging}
            onClick={handleMerge}
          >
            {merging ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Merging…
              </>
            ) : (
              <>
                <GitMerge className="size-3.5" />
                Merge
              </>
            )}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      {/* Result */}
      {task.result && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.result}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <GitBranch className="size-3.5" />
                Branch
              </dt>
              <dd className="font-mono mt-0.5">{task.branch}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Model
              </dt>
              <dd className="mt-0.5">{task.model}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Created
              </dt>
              <dd className="mt-0.5">{formatTimestamp(task.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Started
              </dt>
              <dd className="mt-0.5">{formatTimestamp(task.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Completed
              </dt>
              <dd className="mt-0.5">{formatTimestamp(task.completedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Timer className="size-3.5" />
                Duration
              </dt>
              <dd className="mt-0.5">{formatDuration(task.durationMs)}</dd>
            </div>
            {(task.inputTokens != null || task.outputTokens != null) && (
              <>
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5" />
                    Input Tokens
                  </dt>
                  <dd className="mt-0.5">{formatTokens(task.inputTokens)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5" />
                    Output Tokens
                  </dt>
                  <dd className="mt-0.5">{formatTokens(task.outputTokens)}</dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
