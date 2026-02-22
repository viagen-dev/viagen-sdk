import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Plus,
  Sparkles,
  Settings,
  Ellipsis,
  Circle,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  KeyRound,
  ExternalLink,
  GitMerge,
  GitBranch,
  Square,
  Triangle,
  Copy,
  Check,
} from "lucide-react";

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

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
  githubRepo: string | null;
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

type TaskStatus = "pending" | "running" | "completed";

interface Task {
  id: string;
  prompt: string;
  status: TaskStatus;
  createdAt: string;
}

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
};

function projectInitials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .map((w) => w[0])
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
  return `${days}d ago`;
}

export default function ProjectTasks({
  loaderData,
}: {
  loaderData: { project: Project; role: string };
}) {
  const { project, role } = loaderData;
  const isAdmin = role === "admin" || role === "owner";

  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showClaudeManage, setShowClaudeManage] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [launching, setLaunching] = useState(false);
  const [launchingQuick, setLaunchingQuick] = useState(false);
  const [launchElapsed, setLaunchElapsed] = useState(0);
  const launchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeWorkspaces, setActiveWorkspaces] = useState<Workspace[]>([]);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [branch, setBranch] = useState("feat");
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tick a counter every second while launching
  useEffect(() => {
    if (launching) {
      setLaunchElapsed(0);
      launchTimerRef.current = setInterval(
        () => setLaunchElapsed((s) => s + 1),
        1000,
      );
    } else {
      if (launchTimerRef.current) clearInterval(launchTimerRef.current);
      setLaunchElapsed(0);
    }
    return () => {
      if (launchTimerRef.current) clearInterval(launchTimerRef.current);
    };
  }, [launching]);

  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch project readiness status
  const refreshStatus = () => {
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
  };

  useEffect(() => {
    refreshStatus();
    // Check for active workspaces
    fetch(`/api/projects/${project.id}/sandbox`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.workspaces?.length) {
          setActiveWorkspaces(data.workspaces);
        }
      })
      .catch(() => {});
  }, [project.id]);

  // Shared fetch for both launch modes
  const launchWorkspace = async (opts?: { prompt?: string }) => {
    const res = await fetch(`/api/projects/${project.id}/sandbox`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch, prompt: opts?.prompt || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to launch sandbox");
    return data.workspace;
  };

  // Header button: create + auto-open
  const handleQuickLaunch = async () => {
    setLaunchingQuick(true);
    setSandboxError(null);
    try {
      const workspace = await launchWorkspace();
      setActiveWorkspaces((prev) => [workspace, ...prev]);
      window.open(workspace.url, "_blank");
    } catch (err) {
      setSandboxError(err instanceof Error ? err.message : "Failed to launch sandbox");
    } finally {
      setLaunchingQuick(false);
    }
  };

  // Task card button: create with prompt, show timer, clear form
  const handleLaunch = async () => {
    setLaunching(true);
    setSandboxError(null);
    try {
      const workspace = await launchWorkspace({ prompt: prompt.trim() });
      setActiveWorkspaces((prev) => [workspace, ...prev]);
      setPrompt("");
    } catch (err) {
      setSandboxError(err instanceof Error ? err.message : "Failed to launch sandbox");
    } finally {
      setLaunching(false);
    }
  };

  const handleStopWorkspace = async (workspaceId: string) => {
    setStoppingId(workspaceId);
    try {
      const res = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        setActiveWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      }
    } catch {
      // ignore
    } finally {
      setStoppingId(null);
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
      // Re-fetch project status
      refreshStatus();
    } catch {
      setKeyError("Failed to save key");
    } finally {
      setSavingKey(false);
    }
  };

  const githubLinked = status?.github.linked ?? !!project.githubRepo;
  const githubToken = status?.github.tokenAvailable ?? false;
  const vercelLinked = status?.vercel.linked ?? !!project.vercelProjectId;
  const vercelToken = status?.vercel.tokenAvailable ?? false;
  const claudeConnected = status?.claude.connected ?? false;
  const claudeExpired = status?.claude.expired ?? false;
  const allReady = status?.ready ?? false;

  // Determine which blocking step to prompt for (in priority order).
  // Only GitHub (repo + token) and Claude are hard requirements.
  // Vercel is optional — token availability is shown in badges but doesn't block.
  const missingStep =
    !githubLinked || !githubToken
      ? "github"
      : !claudeConnected || claudeExpired
        ? "claude"
        : null;

  const handleSubmit = () => {
    if (!prompt.trim() || submitting) return;

    setSubmitting(true);

    const newTask: Task = {
      id: crypto.randomUUID(),
      prompt: prompt.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setPrompt("");
    setSubmitting(false);
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4">
        {/* Top row: avatar + name + actions */}
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
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold leading-tight sm:text-2xl">
            {project.name}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              disabled={!allReady || launching || launchingQuick}
              onClick={handleQuickLaunch}
            >
              {launchingQuick ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {launchingQuick ? "Creating..." : "Create Workspace"}
            </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/projects/${project.id}/settings`}>
                  Project settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
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
              ? project.vercelProjectId
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
            onClick={() => claudeConnected && setShowClaudeManage((v) => !v)}
          >
            <Sparkles className="size-3" />
            {claudeExpired
              ? "Claude token expired"
              : claudeConnected
                ? "Claude connected"
                : "Claude not connected"}
          </Badge>
        </div>

        {/* Claude manage section (toggled by clicking badge) */}
        {showClaudeManage && claudeConnected && (
          <Card>
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
      </div>

      {/* Active workspaces */}
      {activeWorkspaces.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Active Workspaces
          </h2>
          <div className="flex flex-col gap-2">
            {activeWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">
                    {ws.branch}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(ws.createdAt)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    asChild
                  >
                    <a href={ws.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />
                      View
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(ws.url);
                      setCopiedId(ws.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                  >
                    {copiedId === ws.id ? (
                      <Check className="size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copiedId === ws.id ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                    disabled={stoppingId === ws.id}
                    onClick={() => handleStopWorkspace(ws.id)}
                  >
                    {stoppingId === ws.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Square className="size-3" />
                    )}
                    Stop
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                    The Claude OAuth token has expired. Re-authorize or add an
                    API key below.
                  </>
                ) : (
                  <>
                    An Anthropic API key is required to run tasks. Add one below
                    for this project, or set a shared key in{" "}
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
                  placeholder="main"
                  className="h-8 w-32 text-xs"
                />
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                disabled={!allReady || launching || launchingQuick}
                onClick={handleLaunch}
              >
                {launching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {launching
                  ? `Creating... ${launchElapsed}s`
                  : "Run task"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status summary */}
      {tasks.length > 0 && (
        <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Circle className="size-3" />
              {pendingCount} pending
            </span>
          )}
          {runningCount > 0 && (
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Loader2 className="size-3 animate-spin" />
              {runningCount} running
            </span>
          )}
          {completedCount > 0 && (
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-3" />
              {completedCount} completed
            </span>
          )}
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 && allReady ? (
        <Card className="border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center px-8 py-16">
            <Sparkles className="mb-3 size-8 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-semibold">No tasks yet</h3>
            <p className="text-center text-sm text-muted-foreground">
              Describe what you want to build and Claude will get to work.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const config = STATUS_CONFIG[task.status];
            const StatusIcon = config.icon;

            return (
              <Card key={task.id}>
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        {timeAgo(task.createdAt)}
                      </p>
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
    </div>
  );
}

function VercelIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 76 65"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

function GitHubIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
