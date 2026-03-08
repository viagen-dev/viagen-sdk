import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  ChevronDown,
  Loader2,
  GitBranch,
  Check,
  CheckCircle2,
  CircleDot,
  GitPullRequest,
  GitMerge,
  Play,
  Timer,
  Cpu,
  Ellipsis,
  AlertTriangle,
  XCircle,
  Trash2,
  PanelRightClose,
  ExternalLink,
  Columns2,
  Copy,
  Square,
  ArrowLeft,
  Pencil,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import Markdown from "react-markdown";

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
import { Muted, Small } from "~/components/ui/typography";
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
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { WorkspaceList } from "~/components/workspace-list";

// ── Types ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  templateId: string | null;
  taskPrefix: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | "ready"
  | "running"
  | "validating"
  | "completed"
  | "timed_out";

export interface FeedTask {
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
  taskNumber: number | null;
  createdBy: string;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  projectName: string;
  taskPrefix: string | null;
  githubRepo: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  prReviewStatus: string | null;
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

// ── Status config ─────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
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

export function timeAgo(dateStr: string): string {
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

/** Infer a short prefix from a project name, e.g. "My Cool App" → "MCA", "viagen-sdk" → "VGS" */
export function inferPrefix(name: string): string {
  // If it has spaces or mixed case, use initials
  const words = name.split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 4);
  }
  // Single word: take consonants (skip vowels) to shorten, fall back to first 3 chars
  const word = words[0] ?? name;
  const consonants = word.replace(/[aeiou]/gi, "");
  if (consonants.length >= 2) {
    return consonants.toUpperCase().slice(0, 4);
  }
  return word.toUpperCase().slice(0, 3);
}

export function shortTaskId(
  id: string,
  opts?: { prefix?: string | null; projectName?: string | null; taskNumber?: number | null },
): string {
  const prefix = opts?.prefix || (opts?.projectName ? inferPrefix(opts.projectName) : null) || "VI";
  const num = opts?.taskNumber;
  if (num != null) {
    return `${prefix}-${num}`;
  }
  return `${prefix}-${id.slice(0, 4).toUpperCase()}`;
}

export function formatDuration(ms: number | null): string {
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

export function formatTokens(count: number | null): string {
  if (count == null) return "—";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// ── Icons ─────────────────────────────────────────────────────────────────

export function VercelIcon() {
  return (
    <svg viewBox="0 0 76 65" className="size-3 fill-current" aria-hidden>
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

export function GitHubIcon({ size = 12 }: { size?: number }) {
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

// ── TaskDetailPanel ───────────────────────────────────────────────────────

export function TaskDetailPanel({
  projectId,
  taskId,
  open,
  onClose,
  onTaskChanged,
  onStatusFilterChange,
  projects,
  variant = "drawer",
}: {
  projectId: string;
  taskId: string;
  open: boolean;
  onClose: () => void;
  onTaskChanged?: () => void;
  onStatusFilterChange?: (filter: string) => void;
  projects: Project[];
  variant?: "drawer" | "page";
}) {
  const navigate = useNavigate();
  const [task, setTask] = useState<FeedTask | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchElapsed, setLaunchElapsed] = useState(0);
  const launchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [reviewing, setReviewing] = useState(false);

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
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Edit branch state
  const [editingBranch, setEditingBranch] = useState(false);
  const [editBranch, setEditBranch] = useState("");
  const [savingBranch, setSavingBranch] = useState(false);

  // Model state
  const [savingModel, setSavingModel] = useState(false);

  // Auto-size prompt textarea on open
  useEffect(() => {
    const el = promptRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  });

  // Collapsible section state
  const [taskOpen, setTaskOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);

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
        if (isRun) {
          setTask((prev) => (prev ? { ...prev, status: "running" } : prev));
        }
        refreshWorkspaces();
        refreshTask();
        onTaskChanged?.();
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

  // Launch AI review workspace
  const handleReview = async () => {
    if (!task) return;
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: task.branch,
          taskId: task.id,
          reviewMode: true,
          model: task.model,
        }),
      });
      const data = await res.json();
      if (res.ok && data.workspace) {
        toast.success("Review workspace launched");
        refreshWorkspaces();
        refreshTask();
        onTaskChanged?.();
      } else {
        setError(data.error ?? "Failed to launch review workspace");
      }
    } catch {
      setError("Failed to launch review workspace");
    } finally {
      setReviewing(false);
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
        body: JSON.stringify({ prompt: editPrompt.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask((prev) => (prev ? { ...prev, ...data.task } : prev));
        setEditing(false);
        setEditPrompt("");
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

  const MODELS = [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ] as const;

  const changeModel = async (newModel: string) => {
    if (!task || newModel === task.model) return;
    setSavingModel(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModel }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask((prev) => (prev ? { ...prev, ...data.task } : prev));
        onTaskChanged?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update model");
      }
    } catch {
      toast.error("Failed to update model");
    } finally {
      setSavingModel(false);
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
        refreshTask();
        onTaskChanged?.();
      }
    } catch {
      // ignore
    } finally {
      setStoppingWs(null);
    }
  };

  const parseWsUrl = (url: string) => {
    const match = url.match(/^(https?:\/\/[^/]+).*\/t\/([^/]+)$/);
    if (!match) return { domain: url, token: "" };
    return { domain: match[1], token: match[2] };
  };

  const statusConfig = task
    ? (STATUS_CONFIG[task.status] ?? STATUS_CONFIG.ready)
    : STATUS_CONFIG.ready;
  const StatusIcon = statusConfig.icon;
  const isBacklog =
    task?.status === "ready" ||
    (task?.status === "running" && !task.prUrl && !task.result);

  // Close button: in page variant, navigate back to dashboard
  const handleClose = () => {
    if (variant === "page") {
      navigate("/");
    } else {
      onClose();
    }
  };

  // ── Shared sub-components ───────────────────────────────────────────────

  const assigneeSection = task && (
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
                {teamMembersLoading ? "Loading..." : "No members found."}
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
                          : member.email.slice(0, 2).toUpperCase()}
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
  );

  const projectSection = task && (
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
  );

  const branchSectionEditable = task && (
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
  );

  const branchSectionReadonly = task && (
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
  );

  const modelSection = task && (
    <div className="flex items-center">
      <Small className="w-28 shrink-0">Model</Small>
      {task.status === "ready" ? (
        <Select
          value={task.model}
          onValueChange={changeModel}
          disabled={savingModel}
        >
          <SelectTrigger className="h-auto w-auto gap-1.5 border-0 bg-transparent px-2 py-1 text-sm text-muted-foreground shadow-none hover:text-foreground focus:ring-0">
            <Cpu className="size-3.5 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
          <Cpu className="size-3.5" />
          {MODELS.find((m) => m.value === task.model)?.label ?? task.model}
        </span>
      )}
    </div>
  );

  const taskDescriptionCard = task && (
    <Card>
      <CardHeader
        className="flex flex-row items-center justify-between space-y-0 cursor-pointer select-none"
        onClick={() => setTaskOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={cn("size-3.5 transition-transform", taskOpen ? "" : "-rotate-90")} />
          <CardTitle className="text-sm">Task</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {saving && (
            <Muted className="flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </Muted>
          )}
          {!editing && taskOpen && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditPrompt(task.prompt);
                setEditing(true);
              }}
            >
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      {taskOpen && (
        <CardContent>
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                ref={promptRef}
                value={editPrompt}
                onChange={(e) => {
                  setEditPrompt(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onFocus={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onBlur={(e) => {
                  // Don't save on blur if clicking the Save/Cancel buttons
                  if (e.relatedTarget?.closest("[data-prompt-actions]")) return;
                  if (editPrompt.trim() && editPrompt.trim() !== task.prompt) {
                    savePrompt();
                  } else {
                    setEditing(false);
                    setEditPrompt("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditing(false);
                    setEditPrompt("");
                  }
                }}
                disabled={saving}
                autoFocus
                className="min-h-[60px] resize-none overflow-hidden border-0 bg-transparent px-0 shadow-none text-sm leading-relaxed focus-visible:ring-0 transition-colors"
              />
              <div className="flex items-center justify-end gap-2" data-prompt-actions>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setEditPrompt("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={savePrompt}
                  disabled={saving || !editPrompt.trim() || editPrompt.trim() === task.prompt}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm leading-relaxed text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown>{task.prompt}</Markdown>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );

  const previewCard = task && task.status !== "completed" && (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setPreviewOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={cn("size-3.5 transition-transform", previewOpen ? "" : "-rotate-90")} />
          <CardTitle className="text-sm">Preview</CardTitle>
        </div>
        {previewOpen && (
          <CardDescription className="text-sm">
            {workspaces.length > 0
              ? "Your sandbox is running. Open the split view to inspect changes live."
              : "Launch a sandbox to preview your changes in a live environment."}
          </CardDescription>
        )}
      </CardHeader>
      {previewOpen && (
        <>
          {workspaces.length > 0 ? (
            workspaces.map((ws) => {
              const { domain, token } = parseWsUrl(ws.url);
              const splitUrl = `${domain}/via/iframe/t/${token}`;
              return (
                <CardFooter key={ws.id} className="justify-between">
                  <Muted className="text-xs">
                    {timeAgo(ws.createdAt)}
                  </Muted>
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
        </>
      )}
    </Card>
  );

  const resultsCard = task?.result && (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setResultsOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={cn("size-3.5 transition-transform", resultsOpen ? "" : "-rotate-90")} />
          <CardTitle className="text-sm">Results</CardTitle>
        </div>
      </CardHeader>
      {resultsOpen && (
        <CardContent>
          <div className="text-sm leading-relaxed text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Markdown>{task.result}</Markdown>
          </div>
        </CardContent>
      )}
    </Card>
  );

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden">
        <div className={cn("flex flex-col gap-4 p-4 sm:p-6", variant === "page" && "mx-auto w-full max-w-2xl")}>
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

                  {variant === "drawer" && task && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => window.open(`/projects/${projectId}/tasks/${taskId}`, "_blank")}
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                    {variant === "page" ? (
                      <ArrowLeft className="size-4" />
                    ) : (
                      <PanelRightClose className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Task ID + Status badge + Metadata */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {shortTaskId(task.id, { prefix: task.taskPrefix, projectName: task.projectName, taskNumber: task.taskNumber })}
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
                  {assigneeSection}
                  {projectSection}
                  {branchSectionEditable}
                  {modelSection}
                </CardContent>
              </Card>

              {/* Task description — editable with pencil toggle, collapsible */}
              {taskDescriptionCard}

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
                  {task.status === "validating" && task.prUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewing}
                      onClick={handleReview}
                    >
                      {reviewing ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Reviewing…
                        </>
                      ) : (
                        <>
                          <Eye className="size-3.5" />
                          Review
                        </>
                      )}
                    </Button>
                  )}
                  {task.prReviewStatus && (
                    <Badge
                      variant={
                        task.prReviewStatus === "pass"
                          ? "default"
                          : task.prReviewStatus === "flag"
                            ? "secondary"
                            : "destructive"
                      }
                      className={
                        task.prReviewStatus === "pass"
                          ? "bg-green-600 text-white"
                          : task.prReviewStatus === "flag"
                            ? "bg-amber-500 text-white"
                            : ""
                      }
                    >
                      {task.prReviewStatus === "pass" && <ShieldCheck className="size-3 mr-1" />}
                      {task.prReviewStatus === "flag" && <ShieldAlert className="size-3 mr-1" />}
                      {task.prReviewStatus === "fail" && <ShieldX className="size-3 mr-1" />}
                      {task.prReviewStatus}
                    </Badge>
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

                  {variant === "drawer" && task && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => window.open(`/projects/${projectId}/tasks/${taskId}`, "_blank")}
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                    {variant === "page" ? (
                      <ArrowLeft className="size-4" />
                    ) : (
                      <PanelRightClose className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Task ID + Status badge + Metadata */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {shortTaskId(task.id, { prefix: task.taskPrefix, projectName: task.projectName, taskNumber: task.taskNumber })}
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
                  {assigneeSection}
                  {projectSection}
                  {branchSectionReadonly}
                  {modelSection}

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

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {previewCard}
              {resultsCard}

              {/* Task description — editable with pencil toggle, collapsible */}
              {taskDescriptionCard}
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
