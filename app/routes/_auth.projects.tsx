import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Link,
  useNavigate,
  useRouteLoaderData,
  useSearchParams,
  useRevalidator,
} from "react-router";
import { toast } from "sonner";
import {
  ChevronDown,
  ArrowUp,
  Loader2,
  GitBranch,
  Check,
  GitPullRequest,
  GitMerge,
  Settings,
  Plus,
  Terminal,
  Ellipsis,
  Square,
  Columns2,
  ExternalLink,
} from "lucide-react";
import {
  TaskDetailPanel,
  STATUS_CONFIG,
  timeAgo,
  shortTaskId,
  formatDuration,
  formatTokens,
  VercelIcon,
  GitHubIcon,
} from "~/components/task-detail-panel";
import type { FeedTask, Project, TaskStatus } from "~/components/task-detail-panel";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Muted, Large } from "~/components/ui/typography";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";


import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

// ── Loader ────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id));
  return { projects: rows };
}

// ── Types ─────────────────────────────────────────────────────────────────

interface GithubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  url: string;
}

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
}

interface ParentData {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  currentOrg: { id: string; name: string };
  organizations: { id: string; name: string; role: string }[];
  integrations: { github: boolean; vercel: boolean; claude: boolean };
}

// ── Selector Components (shadcn Combobox) ─────────────────────────────────

function GithubRepoSelector({
  selectedRepo,
  onSelect,
  disabled,
}: {
  selectedRepo: GithubRepo | null;
  onSelect: (repo: GithubRepo) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  const loadRepos = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos?per_page=100", {
        credentials: "include",
      });
      if (res.status === 400) {
        setError("not_connected");
        return;
      }
      if (res.status === 401) {
        setError("expired");
        return;
      }
      if (!res.ok) {
        setError("Failed to load repos");
        return;
      }
      const data = await res.json();
      setRepos(data.repos ?? []);
    } catch {
      setError("Failed to load repos");
      fetched.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadRepos();
  };

  if (error === "not_connected") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        asChild
      >
        <a href="/api/integrations/github/start?return_to=/">
          <GitHubIcon size={11} />
          Connect GitHub
        </a>
      </Button>
    );
  }

  if (error === "expired") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        asChild
      >
        <a href="/api/integrations/github/start?return_to=/">
          <GitHubIcon size={11} />
          Reconnect GitHub
        </a>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-7 w-auto gap-1.5 text-xs"
        >
          <GitHubIcon size={11} />
          {selectedRepo ? selectedRepo.fullName : "Select repo"}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search repositories..." />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>No repositories found.</CommandEmpty>
                <CommandGroup>
                  {repos.map((repo) => (
                    <CommandItem
                      key={repo.id}
                      value={repo.fullName}
                      onSelect={() => {
                        onSelect(repo);
                        setOpen(false);
                      }}
                    >
                      {repo.fullName}
                      <Check
                        className={cn(
                          "ml-auto size-3.5",
                          selectedRepo?.id === repo.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function VercelProjectSelector({
  selectedProject,
  onSelect,
  disabled,
}: {
  selectedProject: VercelProject | null;
  onSelect: (project: VercelProject) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  const loadProjects = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vercel/projects?limit=50", {
        credentials: "include",
      });
      if (res.status === 400) {
        setError("not_connected");
        return;
      }
      if (!res.ok) {
        setError("Failed to load projects");
        return;
      }
      const data = await res.json();
      setVercelProjects(data.projects ?? []);
    } catch {
      setError("Failed to load projects");
      fetched.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadProjects();
  };

  if (error === "not_connected") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        asChild
      >
        <a href="/api/integrations/vercel/start?return_to=/">
          <VercelIcon />
          Connect Vercel
        </a>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-7 w-auto gap-1.5 text-xs"
        >
          <VercelIcon />
          {selectedProject ? selectedProject.name : "Select project"}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search Vercel projects..." />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup>
                  {vercelProjects.map((vp) => (
                    <CommandItem
                      key={vp.id}
                      value={vp.name}
                      onSelect={() => {
                        onSelect(vp);
                        setOpen(false);
                      }}
                    >
                      {vp.name}
                      {vp.framework && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {vp.framework}
                        </span>
                      )}
                      <Check
                        className={cn(
                          "ml-auto size-3.5",
                          selectedProject?.id === vp.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── TaskLauncher ──────────────────────────────────────────────────────────

function DashboardTaskLauncher({
  onTaskCreated,
  integrations,
  projects,
  projectId,
}: {
  onTaskCreated: (task: FeedTask) => void;
  integrations:
    | { github: boolean; vercel: boolean; claude: boolean }
    | undefined;
  projects: Project[];
  projectId: string | null;
}) {
  const [prompt, setPrompt] = useState("");
  const [branch, setBranch] = useState(
    () => `feat-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [creating, setCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const project = projectId
    ? (projects.find((p) => p.id === projectId) ?? null)
    : null;

  const needsClaude = !integrations?.claude;
  const canSubmit =
    project !== null && !needsClaude && !creating && prompt.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !project) return;
    setCreating(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          branch: branch.trim(),
          model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to create task");
        return;
      }

      // Augment with project context for the feed
      const task = data.task as FeedTask;
      if (!task.projectName) {
        task.projectId = project.id;
        task.projectName = project.name;
        task.githubRepo = project.githubRepo;
        task.vercelProjectId = project.vercelProjectId;
        task.vercelProjectName = project.vercelProjectName;
      }

      onTaskCreated(task);
      setPrompt("");
      setBranch(`feat-${Math.random().toString(36).slice(2, 8)}`);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      toast.success("Task created");
    } catch {
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="mb-8">
      {needsClaude && (
        <CardHeader className="pb-0">
          <CardDescription className="text-xs">
            Connect{" "}
            <Link to="/settings?tab=settings" className="underline font-medium">
              Claude API key
            </Link>{" "}
            to get started.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={needsClaude ? "pt-3" : ""}>
        <Textarea
          ref={textareaRef}
          placeholder={
            !project
              ? "Select a project to start creating tasks..."
              : needsClaude
                ? "Connect your Claude API key to start creating tasks..."
                : `Describe a task for ${project.name}...`
          }
          value={prompt}
          disabled={!project || needsClaude}
          onChange={(e) => {
            setPrompt(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          className="resize-none overflow-hidden border-0 shadow-none focus-visible:ring-0"
        />
      </CardContent>
      <CardFooter className="border-t justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <GitBranch className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feat-abc123"
              className="h-7 w-40 pl-7 text-xs bg-background"
            />
          </div>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger
              size="sm"
              className="h-7 w-auto gap-1.5 text-xs bg-background"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet-4-6">
                Claude Sonnet 4.6
              </SelectItem>
              <SelectItem value="claude-opus-4-6">Claude Opus 4.6</SelectItem>
              <SelectItem value="claude-haiku-4-5-20251001">
                Claude Haiku 4.5
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="icon-sm"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="size-7 rounded-lg"
        >
          {creating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}


function TaskFeedItem({
  task,
  onOpen,
  isSelected,
}: {
  task: FeedTask;
  onOpen: (task: FeedTask) => void;
  isSelected?: boolean;
}) {
  const config = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.ready;
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-lg border border-border p-4 transition-all hover:border-foreground/20 cursor-pointer",
        isSelected ? "bg-muted -ml-2 pl-6 shadow-sm" : "bg-background",
      )}
      onClick={() => onOpen(task)}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        <Avatar size="sm">
          {task.creatorAvatarUrl ? (
            <AvatarImage
              src={task.creatorAvatarUrl}
              alt={task.creatorName ?? ""}
            />
          ) : null}
          <AvatarFallback className="text-[0.5rem]">
            {task.creatorName
              ? task.creatorName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "?"}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Top row: user, task ID, time + badges right-aligned */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">
            {task.creatorName ?? "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {shortTaskId(task.id, { prefix: task.taskPrefix, projectName: task.projectName, taskNumber: task.taskNumber })}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(task.createdAt)}
          </span>

          {/* Meta badges — right-aligned */}
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <Badge variant="outline" className={config.badgeClassName}>
              <StatusIcon
                className={cn(
                  "size-3",
                  config.className,
                  task.status === "running" ? "animate-spin" : "",
                )}
              />
              {config.label}
            </Badge>

            {task.prUrl && (
              <Badge
                variant="outline"
                className="gap-1 text-xs font-normal cursor-pointer hover:bg-secondary/80"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(task.prUrl!, "_blank");
                }}
              >
                <GitPullRequest className="size-3" />
                PR
              </Badge>
            )}
          </div>
        </div>

        {/* Prompt */}
        <p className="text-sm leading-relaxed line-clamp-2 text-foreground">
          {task.prompt}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function Dashboard({
  loaderData,
}: {
  loaderData: { projects: Project[] };
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const parentData = useRouteLoaderData("routes/_auth") as
    | ParentData
    | undefined;
  const integrations = parentData?.integrations;

  // Panel state — local for instant response, synced to URL for deep-linking
  const [panelTaskId, setPanelTaskId] = useState<string | null>(
    () => searchParams.get("task"),
  );
  const [panelProjectId, setPanelProjectId] = useState<string | null>(
    () => searchParams.get("project"),
  );
  const panelOpen = !!(panelTaskId && panelProjectId);

  // Sync local state → URL in the background (non-blocking)
  useEffect(() => {
    const urlTask = searchParams.get("task");
    const urlProject = searchParams.get("project");
    if (urlTask === panelTaskId && urlProject === panelProjectId) return;
    setSearchParams(
      (prev) => {
        if (panelTaskId && panelProjectId) {
          prev.set("task", panelTaskId);
          prev.set("project", panelProjectId);
        } else {
          prev.delete("task");
          prev.delete("project");
        }
        return prev;
      },
      { replace: true },
    );
  }, [panelTaskId, panelProjectId]);

  const openTaskPanel = useCallback((task: FeedTask) => {
    setPanelTaskId(task.id);
    setPanelProjectId(task.projectId);
  }, []);

  const closeTaskPanel = useCallback(() => {
    setPanelTaskId(null);
    setPanelProjectId(null);
  }, []);

  // Task feed state
  const [tasks, setTasks] = useState<FeedTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>("backlog");

  // Flag to skip closing panel when tab change is programmatic (e.g. after launching a task)
  const skipPanelCloseRef = useRef(false);

  // Track previous statusFilter to detect changes
  const statusFilterRef = useRef(statusFilter);

  // Sync statusFilter from localStorage after hydration
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    const saved = localStorage.getItem("viagen-status-filter");
    let resolved = "backlog";
    if (saved === "planning") resolved = "backlog";
    else if (saved === "merged") resolved = "completed";
    else if (saved) resolved = saved;
    if (resolved !== "backlog") {
      skipPanelCloseRef.current = true;
      statusFilterRef.current = resolved;
      setStatusFilter(resolved);
    }
  }, []);

  const updateStatusFilter = useCallback((val: string) => {
    setStatusFilter(val);
    localStorage.setItem("viagen-status-filter", val);
  }, []);

  useEffect(() => {
    if (statusFilterRef.current === statusFilter) return;
    statusFilterRef.current = statusFilter;
    if (skipPanelCloseRef.current) {
      skipPanelCloseRef.current = false;
      return;
    }
    if (panelOpen) {
      closeTaskPanel();
    }
  }, [statusFilter, panelOpen, closeTaskPanel]);

  // Switch tab without closing the panel (used when a task changes status from the panel)
  const switchStatusFilter = useCallback((val: string) => {
    skipPanelCloseRef.current = true;
    setStatusFilter(val);
    localStorage.setItem("viagen-status-filter", val);
  }, []);

  // Project filter state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      const saved = localStorage.getItem("viagen-filter-project");
      if (saved && loaderData.projects.some((p) => p.id === saved))
        return saved;
      return null;
    },
  );
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const selectedProject = selectedProjectId
    ? (loaderData.projects.find((p) => p.id === selectedProjectId) ?? null)
    : null;

  // The project the launcher/dropdown targets — always has a value
  const [launcherProjectId, setLauncherProjectId] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return loaderData.projects[0]?.id ?? null;
      const saved = localStorage.getItem("viagen-launcher-project");
      if (saved && loaderData.projects.some((p) => p.id === saved)) return saved;
      return loaderData.projects[0]?.id ?? null;
    },
  );
  const [launcherPickerOpen, setLauncherPickerOpen] = useState(false);
  const launcherProject = launcherProjectId
    ? (loaderData.projects.find((p) => p.id === launcherProjectId) ?? null)
    : null;

  const updateLauncherProject = useCallback((id: string) => {
    setLauncherProjectId(id);
    localStorage.setItem("viagen-launcher-project", id);
  }, []);

  const updateFilterProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    if (id) {
      localStorage.setItem("viagen-filter-project", id);
    } else {
      localStorage.removeItem("viagen-filter-project");
    }
  }, []);

  // Active standalone workspace (not linked to a task) for launcher project
  interface StandaloneWorkspace {
    id: string;
    url: string;
    status: string;
    taskId: string | null;
    createdAt: string;
  }
  const [standaloneWs, setStandaloneWs] = useState<StandaloneWorkspace | null>(null);
  const [stoppingWs, setStoppingWs] = useState(false);

  // Poll for active workspaces on the launcher project
  useEffect(() => {
    if (!launcherProjectId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/projects/${launcherProjectId}/sandbox`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const standalone = (data.workspaces ?? []).find(
          (ws: StandaloneWorkspace) => !ws.taskId,
        );
        if (!cancelled) setStandaloneWs(standalone ?? null);
      } catch {
        // ignore
      }
    };
    check();
    // Poll faster while provisioning, slower once running
    const interval = setInterval(check, standaloneWs?.status === "provisioning" ? 3_000 : 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [launcherProjectId, standaloneWs?.status]);

  const parseWsUrl = (url: string) => {
    const match = url.match(/^(https?:\/\/[^/]+).*\/t\/([^/]+)$/);
    if (!match) return { domain: url, token: "" };
    return { domain: match[1], token: match[2] };
  };

  const handleStopStandaloneWs = async () => {
    if (!standaloneWs || !launcherProjectId || stoppingWs) return;
    setStoppingWs(true);
    try {
      const res = await fetch(`/api/projects/${launcherProjectId}/sandbox`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: standaloneWs.id }),
      });
      if (res.ok) {
        setStandaloneWs(null);
        toast.success("Workspace stopped");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to stop workspace");
      }
    } catch {
      toast.error("Failed to stop workspace");
    } finally {
      setStoppingWs(false);
    }
  };

  // Handle ?connected= and ?error= query params from OAuth redirects
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected) {
      const label =
        connected === "github"
          ? "GitHub"
          : connected === "vercel"
            ? "Vercel"
            : connected;
      toast.success(`${label} connected successfully`);
      setSearchParams(
        (prev) => {
          prev.delete("connected");
          return prev;
        },
        { replace: true },
      );
      revalidator.revalidate();
    }

    if (error) {
      const label =
        error === "github" ? "GitHub" : error === "vercel" ? "Vercel" : error;
      toast.error(`Failed to connect ${label}. Please try again.`);
      setSearchParams(
        (prev) => {
          prev.delete("error");
          return prev;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams, revalidator]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } catch {
      // silently fail, tasks will show as empty
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    setTasksLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  // Poll for task updates (running tasks)
  const hasActiveTasks = tasks.some(
    (t) => t.status === "running" || t.status === "validating",
  );

  useEffect(() => {
    if (!hasActiveTasks) return;
    const timer = setInterval(fetchTasks, 8000);
    return () => clearInterval(timer);
  }, [hasActiveTasks, fetchTasks]);

  // Handle new task created from the launcher
  const handleTaskCreated = useCallback((task: FeedTask) => {
    setTasks((prev) => [task, ...prev]);
  }, []);

  // Project-scoped tasks
  const projectTasks = useMemo(
    () =>
      selectedProjectId
        ? tasks.filter((t) => t.projectId === selectedProjectId)
        : tasks,
    [tasks, selectedProjectId],
  );

  // Filter counts (respect project filter)
  const counts = useMemo(() => {
    const backlog = projectTasks.filter((t) => t.status === "ready").length;
    const review = projectTasks.filter(
      (t) =>
        t.status === "running" ||
        t.status === "validating" ||
        t.status === "timed_out",
    ).length;
    const completed = projectTasks.filter(
      (t) => t.status === "completed",
    ).length;
    return { backlog, review, completed };
  }, [projectTasks]);

  return (
    <div className="flex gap-0">
      {/* Main content */}
      <div
        className="min-w-0 flex-1 mx-auto max-w-[1200px]"
      >
        {/* Task Launcher */}
        <div className="mb-4 flex items-center justify-between">
          <Large>Create Task</Large>
          <div className="flex items-center gap-1.5">
            {loaderData.projects.length > 1 && (
              <Popover open={launcherPickerOpen} onOpenChange={setLauncherPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    role="combobox"
                    aria-expanded={launcherPickerOpen}
                    className="h-8 w-auto gap-1.5 text-sm"
                  >
                    {launcherProject ? launcherProject.name : "Select project"}
                    <ChevronDown className="size-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search projects..." />
                    <CommandList>
                      <CommandEmpty>No projects found.</CommandEmpty>
                      <CommandGroup>
                        {loaderData.projects.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() => {
                              updateLauncherProject(p.id);
                              setLauncherPickerOpen(false);
                            }}
                          >
                            {p.name}
                            <Check
                              className={cn(
                                "ml-auto size-3.5",
                                launcherProjectId === p.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          {standaloneWs && (() => {
            const isProvisioning = standaloneWs.status === "provisioning";
            if (isProvisioning) {
              return (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Launching…</span>
                </div>
              );
            }
            const { domain, token } = parseWsUrl(standaloneWs.url);
            const splitUrl = `${domain}/via/iframe/t/${token}`;
            return (
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  asChild
                  title="Open workspace"
                >
                  <a href={standaloneWs.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  asChild
                  title="Split view"
                >
                  <a href={splitUrl} target="_blank" rel="noopener noreferrer">
                    <Columns2 className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={stoppingWs}
                  onClick={handleStopStandaloneWs}
                  title="Stop workspace"
                >
                  {stoppingWs ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Square className="size-3.5" />
                  )}
                </Button>
              </div>
            );
          })()}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm">
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!standaloneWs && (
                <>
                  <DropdownMenuItem
                    onClick={async () => {
                      const pid = launcherProjectId ?? loaderData.projects[0]?.id;
                      if (!pid) {
                        toast.error("No project selected");
                        return;
                      }
                      const branch = `sandbox-${Math.random().toString(36).slice(2, 8)}`;
                      try {
                        const res = await fetch(`/api/projects/${pid}/sandbox`, {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ branch }),
                        });
                        const data = await res.json();
                        if (res.ok && data.workspace) {
                          toast.success("Workspace launched");
                          setStandaloneWs(data.workspace);
                          window.open(data.workspace.url, "_blank");
                        } else {
                          toast.error(data.error ?? "Failed to launch workspace");
                        }
                      } catch {
                        toast.error("Failed to launch workspace");
                      }
                    }}
                  >
                    <Terminal className="size-3.5" />
                    Launch Workspace
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to="/projects/new">
                  <Plus className="size-3.5" />
                  New Project
                </Link>
              </DropdownMenuItem>
              {launcherProjectId && (
                <DropdownMenuItem asChild>
                  <Link to={`/projects/${launcherProjectId}/settings`}>
                    <Settings className="size-3.5" />
                    Project Settings
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        <DashboardTaskLauncher
          onTaskCreated={handleTaskCreated}
          integrations={integrations}
          projects={loaderData.projects}
          projectId={launcherProjectId}
        />

        {/* Feed tabs + project filter */}
        <Tabs
          value={statusFilter ?? "backlog"}
          onValueChange={updateStatusFilter}
        >
          <div className="mb-4 flex items-center gap-4">
            <Large className="whitespace-nowrap">Task Feed</Large>

            <div className="flex items-center gap-1">
              {loaderData.projects.length > 1 && (
                <Popover
                  open={projectPickerOpen}
                  onOpenChange={setProjectPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      role="combobox"
                      aria-expanded={projectPickerOpen}
                      className="h-8 w-auto gap-1.5 text-sm"
                    >
                      {selectedProject ? selectedProject.name : "All Projects"}
                      <ChevronDown className="size-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search projects..." />
                      <CommandList>
                        <CommandEmpty>No projects found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__all__"
                            onSelect={() => {
                              updateFilterProject(null);
                              setProjectPickerOpen(false);
                            }}
                          >
                            All Projects
                            <Check
                              className={cn(
                                "ml-auto size-3.5",
                                selectedProjectId === null
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                          {loaderData.projects.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.name}
                              onSelect={() => {
                                updateFilterProject(project.id);
                                setProjectPickerOpen(false);
                              }}
                            >
                              {project.name}
                              <Check
                                className={cn(
                                  "ml-auto size-3.5",
                                  selectedProjectId === project.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              {selectedProjectId && (
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link to={`/projects/${selectedProjectId}/settings`}>
                    <Settings className="size-3.5" />
                  </Link>
                </Button>
              )}
            </div>

            <TabsList>
              <TabsTrigger value="backlog">
                Backlog
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 min-w-4 px-1 text-[10px]"
                >
                  {counts.backlog}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="review">
                Review
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 min-w-4 px-1 text-[10px]"
                >
                  {counts.review}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 min-w-4 px-1 text-[10px]"
                >
                  {counts.completed}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Task Feed */}
          {tasksLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTasks(projectTasks, statusFilter).length === 0 ? (
            <Card className="border-dashed bg-muted/50">
              <CardContent className="flex flex-col items-center justify-center px-8 py-16">
                {projectTasks.length === 0 ? (
                  <>
                    <Large className="mb-2">No tasks yet</Large>
                    <Muted className="text-center">
                      {selectedProjectId
                        ? "No tasks in this project yet."
                        : "Use the input above to describe what you'd like Claude to build."}
                    </Muted>
                  </>
                ) : (
                  <>
                    <Large className="mb-2">No matching tasks</Large>
                    <Muted className="text-center mb-3">
                      No tasks match the current filter.
                    </Muted>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatusFilter("backlog")}
                    >
                      Show backlog
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTasks(projectTasks, statusFilter).map((task) => (
                <TaskFeedItem
                  key={task.id}
                  task={task}
                  onOpen={openTaskPanel}
                  isSelected={panelOpen && panelTaskId === task.id}
                />
              ))}
            </div>
          )}
        </Tabs>
      </div>

      {/* Task Detail Panel — overlay sidebar */}
      {panelOpen && panelTaskId && panelProjectId && (
        <div className="fixed top-[60px] right-0 w-[480px] border-l border-border bg-background animate-in slide-in-from-right duration-300 h-[calc(100svh-60px)] z-40">
          <TaskDetailPanel
            projectId={panelProjectId}
            taskId={panelTaskId}
            open={panelOpen}
            onClose={closeTaskPanel}
            onTaskChanged={fetchTasks}
            onStatusFilterChange={switchStatusFilter}
            projects={loaderData.projects}
          />
        </div>
      )}
    </div>
  );
}

// ── Feed filtering helper ─────────────────────────────────────────────────

function filteredTasks(
  tasks: FeedTask[],
  statusFilter: string | null,
): FeedTask[] {
  if (!statusFilter) return tasks;
  if (statusFilter === "backlog") {
    return tasks.filter((t) => t.status === "ready");
  }
  if (statusFilter === "review") {
    return tasks.filter(
      (t) =>
        t.status === "running" ||
        t.status === "validating" ||
        t.status === "timed_out",
    );
  }
  if (statusFilter === "completed") {
    return tasks.filter((t) => t.status === "completed");
  }
  return tasks.filter((t) => t.status === statusFilter);
}
