import { useState, useEffect } from "react";
import { Link, useRouteLoaderData } from "react-router";
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
  GitBranch,
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
  Triangle,
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
  gitBranch: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClaudeStatus {
  connected: boolean;
  source?: "project" | "org" | "user";
  keyPrefix?: string;
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

interface ParentData {
  integrations: { github: boolean; vercel: boolean };
}

export default function ProjectTasks({
  loaderData,
}: {
  loaderData: { project: Project; role: string };
}) {
  const { project, role } = loaderData;
  const isAdmin = role === "admin";
  const parentData = useRouteLoaderData("routes/_auth") as ParentData;
  const orgGithub = parentData?.integrations?.github ?? false;
  const orgVercel = parentData?.integrations?.vercel ?? false;

  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Claude connection status
  useEffect(() => {
    setClaudeLoading(true);
    fetch(`/api/projects/${project.id}/claude`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setClaudeStatus(data))
      .catch(() => setClaudeStatus({ connected: false }))
      .finally(() => setClaudeLoading(false));
  }, [project.id]);

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
      // Re-fetch status
      const statusRes = await fetch(`/api/projects/${project.id}/claude`, {
        credentials: "include",
      });
      setClaudeStatus(await statusRes.json());
    } catch {
      setKeyError("Failed to save key");
    } finally {
      setSavingKey(false);
    }
  };

  const claudeConnected = claudeStatus?.connected ?? false;
  const githubConnected = !!project.githubRepo;
  const vercelConnected = !!project.vercelProjectId;
  const allConnected = githubConnected && vercelConnected && claudeConnected;

  // Determine which missing connection to prompt for (in order)
  const missingStep = !githubConnected
    ? "github"
    : !vercelConnected
      ? "vercel"
      : !claudeConnected
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
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link to={`/projects/${project.id}/workspace`}>
                <ExternalLink className="size-4" />
                View Workspace
              </Link>
            </Button>
            <Button size="icon" asChild className="sm:hidden">
              <Link to={`/projects/${project.id}/workspace`}>
                <ExternalLink className="size-4" />
              </Link>
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
            variant={project.githubRepo ? "secondary" : "outline"}
            className={
              project.githubRepo
                ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                : "gap-1.5 font-normal text-muted-foreground"
            }
          >
            <GitHubIcon />
            {project.githubRepo ?? "GitHub not connected"}
          </Badge>
          <Badge
            variant={project.vercelProjectId ? "secondary" : "outline"}
            className={
              project.vercelProjectId
                ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                : "gap-1.5 font-normal text-muted-foreground"
            }
          >
            <VercelIcon />
            {project.vercelProjectId ?? "Vercel not connected"}
          </Badge>
          <Badge
            variant={claudeConnected ? "secondary" : "outline"}
            className={
              claudeConnected
                ? "gap-1.5 font-normal border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                : "gap-1.5 font-normal text-muted-foreground"
            }
          >
            <Sparkles className="size-3" />
            {claudeConnected ? "Claude connected" : "Claude not connected"}
          </Badge>
        </div>
      </div>

      {/* Task input or connection prompts */}
      {claudeLoading ? (
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
                Connect GitHub to get started
              </h3>
              <p className="text-sm text-muted-foreground">
                {!orgGithub
                  ? "Your team needs to connect a GitHub account first."
                  : "This project needs to be linked to a GitHub repository."}
              </p>
            </div>
            {!orgGithub ? (
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
                  Go to project settings
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : missingStep === "vercel" ? (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center gap-4 px-8 py-10">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <VercelIcon size={24} />
            </div>
            <div className="text-center">
              <h3 className="mb-1 text-lg font-semibold">
                Connect Vercel to get started
              </h3>
              <p className="text-sm text-muted-foreground">
                {!orgVercel
                  ? "Your team needs to connect a Vercel account first."
                  : "This project needs to be linked to a Vercel project."}
              </p>
            </div>
            {!orgVercel ? (
              <Button asChild>
                <a
                  href={`/api/integrations/vercel/start?return_to=/projects/${project.id}`}
                >
                  Connect Vercel
                </a>
              </Button>
            ) : (
              <Button asChild>
                <Link to={`/projects/${project.id}/settings`}>
                  Go to project settings
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
                Connect Claude to get started
              </h3>
              <p className="text-sm text-muted-foreground">
                An Anthropic API key is required to run tasks. Add one below for
                this project, or set a shared key in{" "}
                <Link
                  to="/settings"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  team settings
                </Link>
                .
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
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 shrink-0 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Describe a task for Claude to work on..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                className="flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!prompt.trim() || submitting}
              >
                <Send className="size-4" />
                Send
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
      {tasks.length === 0 && allConnected ? (
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
