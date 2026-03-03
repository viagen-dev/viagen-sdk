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
  CheckCircle2,
  CircleDot,
  GitPullRequest,
  GitMerge,
  Play,
  Sparkles,
  Clock,
  Timer,
  Cpu,
  Ellipsis,
  AlertTriangle,
  XCircle,
  Trash2,
  Pencil,
  X,
  PanelRightClose,
  ExternalLink,
  Columns2,
  Code,
  Copy,
  Square,
  ChevronsUpDown,
  Settings,
} from "lucide-react";
import Markdown from "react-markdown";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
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
import { Textarea } from "~/components/ui/textarea";
import { Muted, Large, Small } from "~/components/ui/typography";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "~/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

import { Separator } from "~/components/ui/separator";
import { WorkspaceList } from "~/components/workspace-list";

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

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
}

type TaskStatus =
  | "ready"
  | "running"
  | "validating"
  | "completed"
  | "timed_out";

interface FeedTask {
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
  // Project context from the team-level API
  projectName: string;
  githubRepo: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
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

// ── Status config ─────────────────────────────────────────────────────────

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
    label: "PR Ready",
    icon: GitPullRequest,
    className: "text-yellow-500",
    badgeClassName:
      "gap-1.5 font-normal border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300",
  },
  completed: {
    label: "Merged",
    icon: GitMerge,
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

// ── Helpers ───────────────────────────────────────────────────────────────

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

function shortTaskId(id: string): string {
  return `VI-${id.slice(0, 4).toUpperCase()}`;
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

// ── Icons ─────────────────────────────────────────────────────────────────

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
  filterProjectId,
}: {
  onTaskCreated: (task: FeedTask) => void;
  integrations:
    | { github: boolean; vercel: boolean; claude: boolean }
    | undefined;
  projects: Project[];
  filterProjectId?: string | null;
}) {
  const [prompt, setPrompt] = useState("");
  const [branch, setBranch] = useState(
    () => `feat-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [ownProjectId, setOwnProjectId] = useState<string | null>(() => {
    if (typeof window === "undefined") return projects[0]?.id ?? null;
    const saved = localStorage.getItem("viagen-launcher-project");
    if (saved && projects.some((p) => p.id === saved)) return saved;
    return projects[0]?.id ?? null;
  });
  // When a project is selected in the header, use that; otherwise fall back to the launcher's own pick
  const selectedProjectId = filterProjectId ?? ownProjectId;
  const setSelectedProjectId = (id: string | null) => setOwnProjectId(id);
  const [projectOpen, setProjectOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleProjectSelect = useCallback((id: string) => {
    setSelectedProjectId(id);
    localStorage.setItem("viagen-launcher-project", id);
  }, []);

  const project = selectedProjectId
    ? (projects.find((p) => p.id === selectedProjectId) ?? null)
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
          {filterProjectId
            ? project && (
                <span className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground">
                  {project.name}
                </span>
              )
            : projects.length > 1 && (
                <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      role="combobox"
                      aria-expanded={projectOpen}
                      className="h-7 w-auto gap-1.5 text-xs"
                    >
                      {project ? project.name : "Select project"}
                      <ChevronDown className="size-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search projects..." />
                      <CommandList>
                        <CommandEmpty>No projects found.</CommandEmpty>
                        <CommandGroup>
                          {projects.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                handleProjectSelect(p.id);
                                setProjectOpen(false);
                              }}
                            >
                              {p.name}
                              <Check
                                className={cn(
                                  "ml-auto size-3.5",
                                  selectedProjectId === p.id
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
              <SelectItem value="claude-sonnet-4-20250514">
                Claude Sonnet 4
              </SelectItem>
              <SelectItem value="claude-opus-4-0520">Claude Opus 4</SelectItem>
              <SelectItem value="claude-3-5-haiku-20241022">
                Claude Haiku 3.5
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

// ── TaskDetailPanel ───────────────────────────────────────────────────────

function TaskDetailPanel({
  projectId,
  taskId,
  open,
  onClose,
  onTaskChanged,
  onStatusFilterChange,
  projects,
}: {
  projectId: string;
  taskId: string;
  open: boolean;
  onClose: () => void;
  onTaskChanged?: () => void;
  onStatusFilterChange?: (filter: string) => void;
  projects: Project[];
}) {
  const [task, setTask] = useState<FeedTask | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchElapsed, setLaunchElapsed] = useState(0);
  const launchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  // Inline workspace action state (for Result card footer)
  const [stoppingWs, setStoppingWs] = useState<string | null>(null);
  const [copiedWs, setCopiedWs] = useState<string | null>(null);

  // Cancel state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelClosePr, setCancelClosePr] = useState(false);
  const [cancelNewBranch, setCancelNewBranch] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit prompt state
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit branch state
  const [editingBranch, setEditingBranch] = useState(false);
  const [editBranch, setEditBranch] = useState("");
  const [savingBranch, setSavingBranch] = useState(false);

  // Change project state
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  // Assignee state
  interface TeamMember {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    role: string;
  }
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamMembersFetched, setTeamMembersFetched] = useState(false);

  // Fetch task
  const refreshTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) setTask((prev) => ({ ...prev, ...data.task }));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  // Fetch workspaces
  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sandbox`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.workspaces) {
          const linked = (data.workspaces as Workspace[]).filter(
            (w) => w.taskId === taskId,
          );
          setWorkspaces(linked);
        }
      }
    } catch {
      // silently fail
    }
  }, [projectId, taskId]);

  // Reset state when switching tasks
  useEffect(() => {
    setTask(null);
    setWorkspaces([]);
    setLoading(true);
    setError(null);
    setEditing(false);
    setEditPrompt("");
    setEditingBranch(false);
    setEditBranch("");
    setAssigneePickerOpen(false);
    setProjectPickerOpen(false);
    setCancelOpen(false);
    setDeleteOpen(false);
    setLaunching(false);
    setLaunchElapsed(0);
    refreshTask();
    refreshWorkspaces();
  }, [projectId, taskId]);

  // Initial load
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    refreshTask();
    refreshWorkspaces();
  }, [open, refreshTask, refreshWorkspaces]);

  // Poll when active
  const isActive = task?.status === "running" || task?.status === "validating";
  useEffect(() => {
    if (!open || !isActive) return;
    const timer = setInterval(() => {
      refreshTask();
      refreshWorkspaces();
    }, 5000);
    return () => clearInterval(timer);
  }, [open, isActive, refreshTask, refreshWorkspaces]);

  // Launch workspace
  const handleLaunch = async () => {
    if (!task) return;
    const isRun = task.status === "ready";
    setLaunching(true);
    setLaunchElapsed(0);
    setError(null);

    const timer = setInterval(() => setLaunchElapsed((p) => p + 1), 1000);
    launchTimerRef.current = timer;

    try {
      const res = await fetch(`/api/projects/${projectId}/sandbox`, {
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
        // Optimistically update status to running so the UI reacts immediately
        if (isRun) {
          setTask((prev) => (prev ? { ...prev, status: "running" } : prev));
        }
        refreshWorkspaces();
        refreshTask();
        onTaskChanged?.();
        // Switch to Review tab so user sees the now-running task
        if (isRun) {
          onStatusFilterChange?.("review");
        }
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

  // Merge PR
  const handleMerge = async () => {
    if (!task) return;
    setMerging(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${task.id}/merge`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Pull request merged");
        if (data.task)
          setTask((prev) => (prev ? { ...prev, ...data.task } : prev));
        onTaskChanged?.();
      } else {
        toast.error(data.error ?? "Failed to merge PR");
      }
    } catch {
      toast.error("Failed to merge PR");
    } finally {
      setMerging(false);
    }
  };

  const openCancelModal = (t: FeedTask) => {
    setCancelOpen(true);
    setCancelClosePr(false);
    setCancelNewBranch(`feat-${Math.random().toString(36).slice(2, 8)}`);
    setCancelling(false);
  };

  const confirmCancel = async () => {
    if (!task) return;
    setCancelling(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${task.id}/cancel`,
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
        refreshTask();
        refreshWorkspaces();
        setCancelOpen(false);
        onTaskChanged?.();
      } else {
        toast.error(data.error ?? "Failed to cancel task");
      }
    } catch {
      toast.error("Failed to cancel task");
    } finally {
      setCancelling(false);
    }
  };

  const confirmDelete = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${task.id}/delete`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Task deleted");
        setDeleteOpen(false);
        onTaskChanged?.();
        onClose();
      } else {
        toast.error(data.error ?? "Failed to delete task");
      }
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const savePrompt = async () => {
    if (!task || !editPrompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask((prev) => (prev ? { ...prev, ...data.task } : prev));
        setEditing(false);
        onTaskChanged?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save prompt");
      }
    } catch {
      toast.error("Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async () => {
    if (!task || !editBranch.trim() || editBranch.trim() === task.branch) {
      setEditingBranch(false);
      setEditBranch("");
      return;
    }
    setSavingBranch(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: editBranch.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask((prev) => (prev ? { ...prev, ...data.task } : prev));
        setEditingBranch(false);
        setEditBranch("");
        onTaskChanged?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save branch");
      }
    } catch {
      toast.error("Failed to save branch");
    } finally {
      setSavingBranch(false);
    }
  };

  // Fetch team members (lazy — only when assignee picker opens)
  const fetchTeamMembers = useCallback(async () => {
    if (teamMembersFetched) return;
    setTeamMembersLoading(true);
    try {
      const res = await fetch("/api/orgs/members", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setTeamMembersLoading(false);
      setTeamMembersFetched(true);
    }
  }, [teamMembersFetched]);

  const changeAssignee = async (userId: string) => {
    if (!task || userId === task.createdBy) {
      setAssigneePickerOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdBy: userId }),
      });
      if (res.ok) {
        const member = teamMembers.find((m) => m.id === userId);
        setTask((prev) =>
          prev
            ? {
                ...prev,
                createdBy: userId,
                creatorName: member?.name ?? prev.creatorName,
                creatorAvatarUrl: member?.avatarUrl ?? prev.creatorAvatarUrl,
              }
            : prev,
        );
        onTaskChanged?.();
        toast.success("Assignee updated");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to change assignee");
      }
    } catch {
      toast.error("Failed to change assignee");
    } finally {
      setAssigneePickerOpen(false);
    }
  };

  const changeProject = async (newProjectId: string) => {
    if (!task || newProjectId === task.projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: newProjectId }),
      });
      if (res.ok) {
        toast.success("Task moved to new project");
        onTaskChanged?.();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to move task");
      }
    } catch {
      toast.error("Failed to move task");
    }
  };

  const handleStopWorkspace = async (workspaceId: string) => {
    setStoppingWs(workspaceId);
    try {
      const res = await fetch(`/api/projects/${projectId}/sandbox`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
        // Refresh task so the status reverts (e.g. running → validating)
        refreshTask();
        onTaskChanged?.();
      }
    } catch {
      // ignore
    } finally {
      setStoppingWs(null);
    }
  };

  /** Extract sandbox domain and auth token from any workspace URL variant. */
  const parseWsUrl = (url: string) => {
    const match = url.match(/^(https?:\/\/[^/]+).*\/t\/([^/]+)$/);
    if (!match) return { domain: url, token: "" };
    return { domain: match[1], token: match[2] };
  };

  const statusConfig = task
    ? (STATUS_CONFIG[task.status] ?? STATUS_CONFIG.ready)
    : STATUS_CONFIG.ready;
  const StatusIcon = statusConfig.icon;
  // A task is "backlog" only when it's ready, or running without any review
  // artifacts. A running task that already has a PR or result is a preview
  // sandbox launched from the Review state — keep the Review layout.
  const isBacklog =
    task?.status === "ready" ||
    (task?.status === "running" && !task.prUrl && !task.result);

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex flex-col gap-4 p-6">
          {loading || !task ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : isBacklog ? (
            <>
              {/* ── Backlog layout ─────────────────────────────────── */}

              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <Button
                  onClick={handleLaunch}
                  disabled={launching || workspaces.length > 0}
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
                      Run
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <Ellipsis className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="ghost" size="icon-sm" onClick={onClose}>
                    <PanelRightClose className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Task ID + Status badge + Metadata */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {shortTaskId(task.id)}
                    </CardTitle>
                    <Muted>{timeAgo(task.createdAt)}</Muted>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusConfig.badgeClassName}
                  >
                    <StatusIcon
                      className={cn(
                        "size-3",
                        statusConfig.className,
                        task.status === "running" ? "animate-spin" : "",
                      )}
                    />
                    {statusConfig.label}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {/* Assignee */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Assignee</Small>
                    <Popover
                      open={assigneePickerOpen}
                      onOpenChange={(open) => {
                        setAssigneePickerOpen(open);
                        if (open) fetchTeamMembers();
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                        >
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
                          {task.creatorName ?? "Unknown"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Assign to..." />
                          <CommandList>
                            <CommandEmpty>
                              {teamMembersLoading
                                ? "Loading..."
                                : "No members found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {teamMembers.map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={member.name ?? member.email}
                                  onSelect={() => changeAssignee(member.id)}
                                >
                                  <Avatar size="sm">
                                    {member.avatarUrl ? (
                                      <AvatarImage
                                        src={member.avatarUrl}
                                        alt={member.name ?? ""}
                                      />
                                    ) : null}
                                    <AvatarFallback className="text-[0.5rem]">
                                      {member.name
                                        ? member.name
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)
                                        : member.email
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  {member.name ?? member.email}
                                  <Check
                                    className={cn(
                                      "ml-auto size-3.5",
                                      task.createdBy === member.id
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
                  </div>

                  {/* Project */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Project</Small>
                    <Popover
                      open={projectPickerOpen}
                      onOpenChange={setProjectPickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <VercelIcon />
                          {task.projectName}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Move to project..." />
                          <CommandList>
                            <CommandEmpty>No projects found.</CommandEmpty>
                            <CommandGroup>
                              {projects.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => {
                                    setProjectPickerOpen(false);
                                    changeProject(p.id);
                                  }}
                                >
                                  {p.name}
                                  <Check
                                    className={cn(
                                      "ml-auto size-3.5",
                                      task.projectId === p.id
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
                  </div>

                  {/* Branch */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Branch</Small>
                    {editingBranch ? (
                      <div className="flex items-center gap-1">
                        <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
                        <Input
                          value={editBranch}
                          onChange={(e) => setEditBranch(e.target.value)}
                          onBlur={saveBranch}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                            if (e.key === "Escape") {
                              setEditBranch("");
                              setEditingBranch(false);
                            }
                          }}
                          disabled={savingBranch}
                          autoFocus
                          className="h-auto px-2 py-1 text-sm"
                        />
                        {savingBranch && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditBranch(task.branch);
                          setEditingBranch(true);
                        }}
                      >
                        <GitBranch className="size-3.5" />
                        {task.branch}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Task description — inline editable */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">Task</CardTitle>
                  {saving && (
                    <Muted className="flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" />
                      Saving…
                    </Muted>
                  )}
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={editPrompt || task.prompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    onFocus={() => {
                      if (!editPrompt) setEditPrompt(task.prompt);
                    }}
                    onBlur={() => {
                      if (editPrompt && editPrompt.trim() !== task.prompt) {
                        savePrompt();
                      } else {
                        setEditPrompt("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        (e.target as HTMLTextAreaElement).blur();
                      }
                      if (e.key === "Escape") {
                        setEditPrompt("");
                        (e.target as HTMLTextAreaElement).blur();
                      }
                    }}
                    disabled={saving}
                    className="min-h-[60px] resize-none border-0 bg-transparent px-0 shadow-none text-sm text-muted-foreground leading-relaxed focus-visible:ring-0 focus-visible:text-foreground hover:text-foreground/80 transition-colors"
                  />
                </CardContent>
              </Card>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Active workspaces (if any spawned) */}
              {workspaces.length > 0 && (
                <div>
                  <WorkspaceList
                    projectId={projectId}
                    workspaces={workspaces}
                    onStopped={(id) =>
                      setWorkspaces((prev) => prev.filter((w) => w.id !== id))
                    }
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── Review / Completed / Other layout ── */}

              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {task.prUrl && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => window.open(task.prUrl!, "_blank")}
                          >
                            <GitPullRequest className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {task.status === "validating"
                            ? "Review PR"
                            : "View PR"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {(task.status === "validating" ||
                    task.status === "running" ||
                    task.status === "timed_out") &&
                    task.prUrl && (
                      <Button
                        size="sm"
                        disabled={merging || task.status === "running"}
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

                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <Ellipsis className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(task.status === "running" ||
                        task.status === "validating" ||
                        task.status === "timed_out") && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => openCancelModal(task)}
                        >
                          <XCircle className="size-3.5" />
                          Cancel Task
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="ghost" size="icon-sm" onClick={onClose}>
                    <PanelRightClose className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Task ID + Status badge + Metadata */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {shortTaskId(task.id)}
                    </CardTitle>
                    <Muted>{timeAgo(task.createdAt)}</Muted>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusConfig.badgeClassName}
                  >
                    <StatusIcon
                      className={cn(
                        "size-3",
                        statusConfig.className,
                        task.status === "running" ? "animate-spin" : "",
                      )}
                    />
                    {statusConfig.label}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {/* Assignee */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Assignee</Small>
                    <Popover
                      open={assigneePickerOpen}
                      onOpenChange={(open) => {
                        setAssigneePickerOpen(open);
                        if (open) fetchTeamMembers();
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                        >
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
                          {task.creatorName ?? "Unknown"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Assign to..." />
                          <CommandList>
                            <CommandEmpty>
                              {teamMembersLoading
                                ? "Loading..."
                                : "No members found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {teamMembers.map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={member.name ?? member.email}
                                  onSelect={() => changeAssignee(member.id)}
                                >
                                  <Avatar size="sm">
                                    {member.avatarUrl ? (
                                      <AvatarImage
                                        src={member.avatarUrl}
                                        alt={member.name ?? ""}
                                      />
                                    ) : null}
                                    <AvatarFallback className="text-[0.5rem]">
                                      {member.name
                                        ? member.name
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)
                                        : member.email
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  {member.name ?? member.email}
                                  <Check
                                    className={cn(
                                      "ml-auto size-3.5",
                                      task.createdBy === member.id
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
                  </div>

                  {/* Project */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Project</Small>
                    <Popover
                      open={projectPickerOpen}
                      onOpenChange={setProjectPickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <VercelIcon />
                          {task.projectName}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Move to project..." />
                          <CommandList>
                            <CommandEmpty>No projects found.</CommandEmpty>
                            <CommandGroup>
                              {projects.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => {
                                    setProjectPickerOpen(false);
                                    changeProject(p.id);
                                  }}
                                >
                                  {p.name}
                                  <Check
                                    className={cn(
                                      "ml-auto size-3.5",
                                      task.projectId === p.id
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
                  </div>

                  {/* Branch */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Branch</Small>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditBranch(task.branch);
                        setEditingBranch(true);
                      }}
                    >
                      <GitBranch className="size-3.5" />
                      {task.branch}
                    </Button>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Duration</Small>
                    <span className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                      <Timer className="size-3.5" />
                      {formatDuration(task.durationMs)}
                    </span>
                  </div>

                  {/* Tokens */}
                  <div className="flex items-center">
                    <Small className="w-28 shrink-0">Tokens</Small>
                    <span className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                      <Cpu className="size-3.5" />
                      {formatTokens(task.inputTokens ?? 0)} in /{" "}
                      {formatTokens(task.outputTokens ?? 0)} out
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Task description — read only */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Task</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm leading-relaxed text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <Markdown>{task.prompt}</Markdown>
                  </div>
                </CardContent>
              </Card>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Preview card — only for review states, not completed */}
              {task.status !== "completed" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Preview</CardTitle>
                    <CardDescription className="text-sm">
                      {workspaces.length > 0
                        ? "Your sandbox is running. Open the split view to inspect changes live."
                        : "Launch a sandbox to preview your changes in a live environment."}
                    </CardDescription>
                  </CardHeader>
                  {workspaces.length > 0 ? (
                    workspaces.map((ws) => {
                      const { domain, token } = parseWsUrl(ws.url);
                      const splitUrl = `${domain}/via/iframe/t/${token}`;
                      return (
                        <CardFooter key={ws.id} className="justify-between">
                          <Muted className="text-xs">
                            {timeAgo(ws.createdAt)}
                          </Muted>
                          <TooltipProvider>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    className="size-7"
                                    asChild
                                  >
                                    <a
                                      href={splitUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Columns2 className="size-3.5" />
                                    </a>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Split view</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    className="size-7"
                                    onClick={() => {
                                      navigator.clipboard.writeText(ws.url);
                                      setCopiedWs(ws.id);
                                      setTimeout(() => setCopiedWs(null), 2000);
                                    }}
                                  >
                                    {copiedWs === ws.id ? (
                                      <Check className="size-3.5" />
                                    ) : (
                                      <Copy className="size-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy URL</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    className="size-7 text-destructive hover:bg-destructive/10"
                                    disabled={stoppingWs === ws.id}
                                    onClick={() => handleStopWorkspace(ws.id)}
                                  >
                                    {stoppingWs === ws.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Square className="size-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Stop workspace</TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </CardFooter>
                      );
                    })
                  ) : (
                    <CardFooter className="justify-between">
                      <Muted className="text-xs">
                        Launch a sandbox to preview changes.
                      </Muted>
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
                            Preview
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              )}

              {/* Results card */}
              {task.result && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <Markdown>{task.result}</Markdown>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cancel task confirmation modal */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the sandbox and reset the task back to ready.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-2">
            {task?.prUrl && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="feed-cancel-close-pr" className="text-sm">
                  Also close the open pull request
                </Label>
                <Switch
                  id="feed-cancel-close-pr"
                  checked={cancelClosePr}
                  onCheckedChange={setCancelClosePr}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="feed-cancel-new-branch" className="text-sm">
                Restart on a new branch
              </Label>
              <Input
                id="feed-cancel-new-branch"
                value={cancelNewBranch}
                onChange={(e) => setCancelNewBranch(e.target.value)}
                placeholder="Leave empty to keep current branch"
                className="h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Current: {task?.branch}
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
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
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
    </>
  );
}

// ── TaskFeedItem ──────────────────────────────────────────────────────────

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
            {shortTaskId(task.id)}
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

            {task.githubRepo && (
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <GitHubIcon size={10} />
                {task.githubRepo}
              </Badge>
            )}

            {(task.vercelProjectName || task.vercelProjectId) && (
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <VercelIcon />
                {task.vercelProjectName ?? task.vercelProjectId}
              </Badge>
            )}

            {task.branch && (
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <GitBranch className="size-3" />
                {task.branch}
              </Badge>
            )}

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

  // Panel state driven by search params
  const panelTaskId = searchParams.get("task");
  const panelProjectId = searchParams.get("project");
  const panelOpen = !!(panelTaskId && panelProjectId);

  const openTaskPanel = useCallback(
    (task: FeedTask) => {
      setSearchParams(
        (prev) => {
          prev.set("task", task.id);
          prev.set("project", task.projectId);
          return prev;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const closeTaskPanel = useCallback(() => {
    setSearchParams(
      (prev) => {
        prev.delete("task");
        prev.delete("project");
        return prev;
      },
      { replace: false },
    );
  }, [setSearchParams]);

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

  const updateFilterProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    if (id) {
      localStorage.setItem("viagen-filter-project", id);
    } else {
      localStorage.removeItem("viagen-filter-project");
    }
  }, []);

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
        className={cn(
          "min-w-0 flex-1 transition-all duration-300 ease-in-out",
          panelOpen ? "max-w-none" : "mx-auto max-w-[1200px]",
        )}
      >
        {/* Task Launcher */}
        <Large className="mb-4">Create Task</Large>
        <DashboardTaskLauncher
          onTaskCreated={handleTaskCreated}
          integrations={integrations}
          projects={loaderData.projects}
          filterProjectId={selectedProjectId}
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

      {/* Task Detail Panel — inline sidebar */}
      {panelOpen && panelTaskId && panelProjectId && (
        <div className="w-[480px] shrink-0">
          <div className="fixed top-[60px] right-0 w-[480px] border-l border-border bg-background animate-in slide-in-from-right duration-300 h-[calc(100svh-60px)]">
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
