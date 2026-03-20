import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  useTaskStore,
  useTask,
  useWorkspaces,
  useIsLaunching,
} from "~/store/task-store";
import { toast } from "sonner";
import {
  ChevronDown,
  Loader2,
  GitBranch,
  Check,
  Box,
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
  Paperclip,
} from "lucide-react";
import Markdown from "react-markdown";
import { AnthropicIcon } from "~/components/icons/anthropic-icon";

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
import {
  TaskAttachments,
  type Attachment,
} from "~/components/task-attachments";

// ── Types (re-exported from ~/types/task) ─────────────────────────────────
export type {
  Environment,
  TaskStatus,
  FeedTask,
  Workspace,
} from "~/types/task";
import type { Environment, FeedTask, TaskStatus } from "~/types/task";

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
    className: "text-purple-500",
    badgeClassName:
      "gap-1.5 font-normal bg-purple-500 hover:bg-purple-500 text-white border-transparent",
  },
  validating: {
    label: "PR Ready",
    icon: GitPullRequest,
    className: "text-teal-500",
    badgeClassName:
      "gap-1.5 font-normal bg-teal-500 hover:bg-teal-500 text-white border-transparent",
  },
  completed: {
    label: "Merged",
    icon: GitMerge,
    className: "text-indigo-500",
    badgeClassName:
      "gap-1.5 font-normal bg-indigo-500 hover:bg-indigo-500 text-white border-transparent",
  },
  timed_out: {
    label: "Timed Out",
    icon: AlertTriangle,
    className: "text-red-500",
    badgeClassName:
      "gap-1.5 font-normal bg-red-500 hover:bg-red-500 text-white border-transparent",
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

/** Infer a short prefix from a project name, e.g. "My Cool Environment" → "MCA", "viagen-sdk" → "VGS" */
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
  opts?: {
    prefix?: string | null;
    environmentName?: string | null;
    taskNumber?: number | null;
  },
): string {
  const prefix =
    opts?.prefix ||
    (opts?.environmentName ? inferPrefix(opts.environmentName) : null) ||
    "VI";
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
  environmentId,
  taskId,
  open,
  onClose,
  onStatusFilterChange,
  onRegisterDeleteTrigger,
  environments,
  variant = "drawer",
}: {
  environmentId: string;
  taskId: string;
  open: boolean;
  onClose: () => void;
  onStatusFilterChange?: (filter: string) => void;
  /** Called once on mount with a function that opens the delete dialog */
  onRegisterDeleteTrigger?: (trigger: () => void) => void;
  environments: Environment[];
  variant?: "drawer" | "page";
}) {
  const navigate = useNavigate();

  // ── Store-backed state ──────────────────────────────────────────────────
  const task = useTask(taskId) ?? null;
  const workspaces = useWorkspaces(taskId);
  const launching = useIsLaunching(taskId);
  const store = useTaskStore;
  const loading = !task;

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

  // Expose delete trigger to parent (used by page-variant header)
  useEffect(() => {
    onRegisterDeleteTrigger?.(() => setDeleteOpen(true));
  }, [onRegisterDeleteTrigger]);

  // Edit prompt state
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Edit title state
  const [editTitle, setEditTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

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
  const [appPickerOpen, setAppPickerOpen] = useState(false);

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

  // Store fetch helpers
  const refreshTask = useCallback(() => {
    store.getState().fetchTask(environmentId, taskId);
  }, [environmentId, taskId]);

  const refreshWorkspaces = useCallback(() => {
    store.getState().fetchWorkspaces(environmentId, taskId);
  }, [environmentId, taskId]);

  // Reset local UI state when switching tasks
  useEffect(() => {
    setError(null);
    setEditing(false);
    setEditPrompt("");
    setEditingBranch(false);
    setEditBranch("");
    setAssigneePickerOpen(false);
    setAppPickerOpen(false);
    setCancelOpen(false);
    setDeleteOpen(false);
  }, [environmentId, taskId]);

  // Detail polling: fetches this task + workspaces every 5 s while active
  useEffect(() => {
    if (!open) return;
    return store.getState().startDetailPolling(environmentId, taskId);
  }, [open, environmentId, taskId]);

  // Launch workspace
  const handleLaunch = async () => {
    if (!task) return;
    const isRun = task.status === "ready";
    store.getState().setLaunching(taskId, true);
    setError(null);

    try {
      const res = await fetch(`/api/environments/${environmentId}/sandbox`, {
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
          store.getState().setTask({ ...task, status: "running" });
        }
        refreshWorkspaces();
        refreshTask();
        if (isRun) {
          onStatusFilterChange?.("review");
        }
      } else {
        setError(data.error ?? "Failed to launch workspace");
      }
    } catch {
      setError("Failed to launch workspace");
    } finally {
      store.getState().setLaunching(taskId, false);
    }
  };

  // Merge PR
  const handleMerge = async () => {
    if (!task) return;
    setMerging(true);
    try {
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}/merge`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Pull request merged");
        if (data.task) store.getState().setTask({ ...task, ...data.task });
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
      const res = await fetch(`/api/environments/${environmentId}/sandbox`, {
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
        `/api/environments/${environmentId}/tasks/${task.id}/cancel`,
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
        `/api/environments/${environmentId}/tasks/${task.id}/delete`,
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
        store.getState().removeTask(taskId);
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

  const saveTitle = async () => {
    if (!task) return;
    const trimmed = editTitle.trim();
    // Allow clearing the title (empty string → null)
    if (trimmed === (task.title ?? "")) return;
    setSavingTitle(true);
    try {
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed || null }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        store.getState().setTask({ ...task, ...data.task });
        setEditTitle("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save title");
      }
    } catch {
      toast.error("Failed to save title");
    } finally {
      setSavingTitle(false);
    }
  };

  const savePrompt = async () => {
    if (!task || !editPrompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: editPrompt.trim() }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (task) store.getState().setTask({ ...task, ...data.task });
        setEditing(false);
        setEditPrompt("");
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
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branch: editBranch.trim() }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (task) store.getState().setTask({ ...task, ...data.task });
        setEditingBranch(false);
        setEditBranch("");
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
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: newModel }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (task) store.getState().setTask({ ...task, ...data.task });
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
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ createdBy: userId }),
        },
      );
      if (res.ok) {
        const member = teamMembers.find((m) => m.id === userId);
        if (task) {
          store.getState().setTask({
            ...task,
            createdBy: userId,
            creatorName: member?.name ?? task.creatorName,
            creatorAvatarUrl: member?.avatarUrl ?? task.creatorAvatarUrl,
          });
        }
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

  const changeApp = async (newAppId: string) => {
    if (!task || newAppId === task.environmentId) return;
    try {
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: newAppId }),
        },
      );
      if (res.ok) {
        toast.success("Task moved to new app");
        store.getState().fetchAllTasks();
        if (variant === "page") {
          // Stay on the task detail page but update the URL to reflect the new project
          navigate(`/environments/${newAppId}/tasks/${task.id}?from=tasks`, {
            replace: true,
          });
        }
        // Drawer variant: the panel stays open; the store refresh updates the task in place
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
      const res = await fetch(`/api/environments/${environmentId}/sandbox`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        // Update workspaces in store
        store.getState().fetchWorkspaces(environmentId, taskId);
        refreshTask();
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
      navigate("/dashboard");
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

  const appSection = task && (
    <div className="flex items-center">
      <Small className="w-28 shrink-0">Environment</Small>
      <Popover
        open={task.status === "ready" ? appPickerOpen : false}
        onOpenChange={task.status === "ready" ? setAppPickerOpen : undefined}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={task.status !== "ready"}
            className="h-auto gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Box className="size-3.5 shrink-0" />
            {task.environmentName}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Move to app..." />
            <CommandList>
              <CommandEmpty>No environments found.</CommandEmpty>
              <CommandGroup>
                {environments.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => {
                      setAppPickerOpen(false);
                      changeApp(p.id);
                    }}
                  >
                    {p.name}
                    <Check
                      className={cn(
                        "ml-auto size-3.5",
                        task.environmentId === p.id
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

  const taskTitleInput = task && (
    <div className="flex flex-col gap-1">
      <input
        ref={titleRef}
        type="text"
        value={
          editTitle !== "" || document.activeElement === titleRef.current
            ? editTitle
            : (task.title ?? "")
        }
        placeholder="Add a title…"
        disabled={savingTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        onFocus={() => setEditTitle(task.title ?? "")}
        onBlur={() => {
          const trimmed = editTitle.trim();
          if (trimmed !== (task.title ?? "")) {
            saveTitle();
          } else {
            setEditTitle("");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setEditTitle(task.title ?? "");
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full border-0 bg-transparent px-0 text-xl font-semibold shadow-none leading-snug focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/40 placeholder:font-normal disabled:opacity-50"
      />
    </div>
  );

  const taskDescriptionCard = task && (
    <Card>
      <CardHeader
        className="flex flex-row items-center justify-between space-y-0 cursor-pointer select-none"
        onClick={() => setTaskOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              taskOpen ? "" : "-rotate-90",
            )}
          />
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
                placeholder="Add a prompt…"
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
              <div
                className="flex items-center justify-end gap-2"
                data-prompt-actions
              >
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
                  disabled={
                    saving ||
                    !editPrompt.trim() ||
                    editPrompt.trim() === task.prompt
                  }
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
          {(task.attachments?.length || task.status === "ready") && (
            <div className="mt-3 pt-3 border-t">
              <TaskAttachments
                environmentId={environmentId}
                taskId={task.id}
                attachments={task.attachments ?? []}
                onChanged={(atts) => {
                  if (task)
                    store.getState().setTask({ ...task, attachments: atts });
                }}
                readOnly={task.status !== "ready"}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );

  // ── Page-variant inline attachment uploader ref ──────────────────────────
  const pageAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [pageUploading, setPageUploading] = useState(false);

  const handlePageUpload = async (file: File) => {
    if (!task) return;
    setPageUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/environments/${environmentId}/tasks/${task.id}/attachments`,
        { method: "POST", credentials: "include", body: form },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      store.getState().setTask({
        ...task,
        attachments: [...(task.attachments ?? []), data.attachment],
      });
      toast.success(`Attached ${file.name}`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setPageUploading(false);
      if (pageAttachmentInputRef.current)
        pageAttachmentInputRef.current.value = "";
    }
  };

  // ── Sandbox section (flat, matches mockup) ───────────────────────────────
  const buildWorkspaces = workspaces.filter((ws) => ws.taskType !== "review");
  const reviewWorkspaces = workspaces.filter((ws) => ws.taskType === "review");

  const renderWorkspaceRows = (
    wsList: typeof workspaces,
    activeStatus: string,
    title = "Sandbox",
  ) =>
    wsList.map((ws) => {
      const { domain, token } = parseWsUrl(ws.url);
      const splitUrl = `${domain}/via/iframe/t/${token}`;
      const isProvisioning = ws.status === "provisioning";
      const isActive = ws.status === "running";
      const buttonsEnabled = isActive && task?.status === activeStatus;
      const statusLabel = isProvisioning ? "Building" : "Built";
      return (
        <div key={ws.id} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500 hover:bg-purple-500 text-white text-xs">
              {statusLabel}
            </Badge>
            <span className="text-base font-semibold">{title}</span>
            <span className="text-sm text-muted-foreground">
              {timeAgo(ws.createdAt)}
            </span>
            {isProvisioning && (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-8 shadow-none"
                  disabled={!buttonsEnabled}
                  asChild={buttonsEnabled}
                >
                  {buttonsEnabled ? (
                    <a
                      href={splitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Columns2 className="size-3.5" />
                    </a>
                  ) : (
                    <Columns2 className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-8 shadow-none"
                  disabled={!buttonsEnabled}
                  onClick={() => {
                    if (!buttonsEnabled) return;
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
                  className="size-8 shadow-none"
                  disabled={!buttonsEnabled || stoppingWs === ws.id}
                  onClick={() => {
                    if (buttonsEnabled) handleStopWorkspace(ws.id);
                  }}
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
        </div>
      );
    });

  const sandboxSection = task && buildWorkspaces.length > 0 && (
    <div className="flex flex-col gap-3">
      <hr className="border-border" />
      {renderWorkspaceRows(buildWorkspaces, "running")}
    </div>
  );

  // ── Pull request section (flat, matches mockup) ───────────────────────────
  const pullRequestSection = task && task.prUrl && (
    <div className="flex flex-col gap-4">
      <hr className="border-border" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge className="bg-teal-500 hover:bg-teal-500 text-white text-xs shrink-0">
          PR ready
        </Badge>
        <span className="text-base font-semibold">Pull request</span>
      </div>

      {/* PR result / description */}
      {task.result && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {task.result}
        </p>
      )}

      {/* Duration + Tokens rows */}
      <div className="flex flex-col gap-1">
        {task.durationMs != null && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20 shrink-0">
              Duration
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <Timer className="size-3.5 text-muted-foreground" />
              {formatDuration(task.durationMs)}
            </span>
          </div>
        )}
        {(task.inputTokens != null || task.outputTokens != null) && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20 shrink-0">
              Tokens
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <Cpu className="size-3.5 text-muted-foreground" />
              {formatTokens(task.inputTokens ?? 0)} in /{" "}
              {formatTokens(task.outputTokens ?? 0)} out
            </span>
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="shadow-none gap-1.5"
            onClick={() => window.open(task.prUrl!, "_blank")}
          >
            <GitPullRequest className="size-3.5" />
            View PR
          </Button>
          {task.status === "validating" && (
            <Button
              size="sm"
              variant="outline"
              className="shadow-none gap-1.5"
              disabled={reviewing}
              onClick={handleReview}
            >
              {reviewing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Reviewing…
                </>
              ) : (
                "Review"
              )}
            </Button>
          )}
        </div>

        {(task.status === "validating" ||
          task.status === "running" ||
          task.status === "timed_out") && (
          <Button
            size="default"
            className="px-6"
            disabled={merging || task.status === "running"}
            onClick={handleMerge}
          >
            {merging ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Merging…
              </>
            ) : (
              <>
                <GitMerge className="size-4" />
                Merge pull request
              </>
            )}
          </Button>
        )}
      </div>

      {/* ── Review sandbox sub-section ───────────────────────────── */}
      {reviewWorkspaces.length > 0 && (
        <div className="ml-4 pl-4 border-l-2 border-border flex flex-col gap-3">
          {renderWorkspaceRows(
            reviewWorkspaces,
            "validating",
            "Review sandbox",
          )}
        </div>
      )}
    </div>
  );

  const mergedSection = task && task.prUrl && task.status === "completed" && (
    <div className="flex flex-col gap-4">
      <hr className="border-border" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge className="bg-indigo-500 hover:bg-indigo-500 text-white text-xs shrink-0">
          Merged
        </Badge>
        <span className="text-base font-semibold">Merged</span>
      </div>

      {/* Merged timestamp */}
      {task.completedAt && (
        <p className="text-sm text-muted-foreground">
          Pull request was merged{" "}
          <span className="font-medium text-foreground">
            {timeAgo(task.completedAt)}
          </span>
          .
        </p>
      )}

      {/* View PR link */}
      <div>
        <Button
          variant="outline"
          size="sm"
          className="shadow-none gap-1.5"
          onClick={() => window.open(task.prUrl!, "_blank")}
        >
          <GitMerge className="size-3.5" />
          View merged PR
        </Button>
      </div>
    </div>
  );

  // keep legacy card versions for drawer variant
  const previewCard = task && task.status !== "completed" && (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setPreviewOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              previewOpen ? "" : "-rotate-90",
            )}
          />
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
              const isProvisioning = ws.status === "provisioning";
              return (
                <CardFooter key={ws.id} className="justify-between">
                  <div className="flex items-center gap-2">
                    <Muted className="text-xs">{timeAgo(ws.createdAt)}</Muted>
                    {ws.taskType && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {ws.taskType}
                      </Badge>
                    )}
                    {isProvisioning && (
                      <Muted className="text-xs flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" />
                        Provisioning…
                      </Muted>
                    )}
                  </div>
                  {!isProvisioning && (
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
                  )}
                </CardFooter>
              );
            })
          ) : task.status === "running" ? (
            <CardFooter className="justify-between">
              <Muted className="text-xs">
                Launch a sandbox to preview changes.
              </Muted>
              <Button onClick={handleLaunch} disabled={launching} size="sm">
                {launching ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Launching…
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Preview
                  </>
                )}
              </Button>
            </CardFooter>
          ) : null}
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
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              resultsOpen ? "" : "-rotate-90",
            )}
          />
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
        <div
          className={cn(
            "flex flex-col gap-4 p-4 sm:p-6",
            variant === "page" && "mx-auto w-full max-w-2xl gap-6",
          )}
        >
          {loading || !task ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : isBacklog && variant === "page" ? (
            <>
              {/* ── Page variant: Linear-style backlog layout ───────── */}

              {/* ── Attribute pills row ─────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Assignee pill */}
                <Popover
                  open={assigneePickerOpen}
                  onOpenChange={(open) => {
                    setAssigneePickerOpen(open);
                    if (open) fetchTeamMembers();
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="shadow-none"
                        >
                          <Avatar size="sm" className="size-4">
                            {task.creatorAvatarUrl ? (
                              <AvatarImage
                                src={task.creatorAvatarUrl}
                                alt={task.creatorName ?? ""}
                              />
                            ) : null}
                            <AvatarFallback className="text-[0.45rem]">
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
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {task.creatorName ?? "Unassigned"}
                    </TooltipContent>
                  </Tooltip>
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

                {/* Environment pill */}
                <Popover open={appPickerOpen} onOpenChange={setAppPickerOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="shadow-none"
                        >
                          <Box className="size-3.5 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {task.environmentName}
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-[220px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Move to app..." />
                      <CommandList>
                        <CommandEmpty>No environments found.</CommandEmpty>
                        <CommandGroup>
                          {[...environments]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.name}
                                onSelect={() => {
                                  setAppPickerOpen(false);
                                  changeApp(p.id);
                                }}
                              >
                                <Box className="size-3.5 shrink-0 text-muted-foreground" />
                                {p.name}
                                <Check
                                  className={cn(
                                    "ml-auto size-3.5",
                                    task.environmentId === p.id
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

                {/* Branch pill */}
                {editingBranch ? (
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
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
                      className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 w-32"
                    />
                    {savingBranch && (
                      <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
                    )}
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="shadow-none"
                        onClick={() => {
                          setEditBranch(task.branch);
                          setEditingBranch(true);
                        }}
                      >
                        <GitBranch className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{task.branch}</TooltipContent>
                  </Tooltip>
                )}

                {/* Model pill */}
                {task.status === "ready" ? (
                  <Tooltip>
                    <Select
                      value={task.model}
                      onValueChange={changeModel}
                      disabled={savingModel}
                    >
                      <TooltipTrigger asChild>
                        <SelectTrigger
                          size="sm"
                          className="size-8 w-8 gap-0 border bg-background px-0 text-sm font-medium shadow-none hover:bg-accent hover:text-accent-foreground focus:ring-0 dark:bg-input/30 dark:border-input dark:hover:bg-input/50 [&>*:last-child]:hidden justify-center"
                        >
                          <AnthropicIcon className="size-3.5 shrink-0" />
                        </SelectTrigger>
                      </TooltipTrigger>
                      <SelectContent>
                        {MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <TooltipContent side="bottom">
                      {MODELS.find((m) => m.value === task.model)?.label ??
                        task.model}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="shadow-none"
                        disabled
                      >
                        <AnthropicIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {MODELS.find((m) => m.value === task.model)?.label ??
                        task.model}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* ── Task ID ──────────────────────────────────────────── */}
              <p className="text-sm font-medium text-muted-foreground">
                {shortTaskId(task.id, {
                  prefix: task.taskPrefix,
                  environmentName: task.environmentName,
                  taskNumber: task.taskNumber,
                })}
              </p>

              {/* ── Title ────────────────────────────────────────────── */}
              {taskTitleInput}

              {/* ── Prompt ───────────────────────────────────────────── */}
              <Textarea
                ref={promptRef}
                placeholder="Add a prompt…"
                value={
                  editPrompt !== "" ? editPrompt : task.prompt || undefined
                }
                onChange={(e) => {
                  setEditPrompt(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onFocus={(e) => {
                  setEditPrompt(task.prompt);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onBlur={() => {
                  if (editPrompt.trim() !== task.prompt.trim()) {
                    savePrompt();
                  } else {
                    setEditPrompt("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditPrompt("");
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                disabled={saving}
                className="resize-none overflow-hidden border-0 bg-transparent px-0 text-base font-normal shadow-none leading-normal focus-visible:ring-0 w-full placeholder:text-muted-foreground/40"
              />

              {/* ── Attachments row ──────────────────────────────────── */}
              {(task.attachments?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {(task.attachments ?? []).map((att) => (
                    <a
                      key={att.id}
                      href={att.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <svg
                        className="size-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      {att.filename}
                    </a>
                  ))}
                </div>
              )}

              {/* ── Attach + Run task row ────────────────────────────── */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    ref={pageAttachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePageUpload(file);
                    }}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-9 shadow-none"
                        disabled={
                          pageUploading || (task.attachments?.length ?? 0) >= 3
                        }
                        onClick={() => pageAttachmentInputRef.current?.click()}
                      >
                        {pageUploading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Paperclip className="size-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Attach file ({task.attachments?.length ?? 0}/3)
                    </TooltipContent>
                  </Tooltip>
                </div>

                <Button
                  onClick={handleLaunch}
                  disabled={launching || workspaces.length > 0}
                  size="default"
                  className="px-6"
                >
                  {launching ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Launching…
                    </>
                  ) : (
                    "Run task"
                  )}
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Active workspaces (if any spawned) */}
              {sandboxSection}

              {/* ── Divider ──────────────────────────────────────────── */}
              <hr className="border-border" />

              {/* ── Activity section ─────────────────────────────────── */}
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold">Activity</h2>
                <div className="flex flex-col gap-0">
                  {/* Created event */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <Avatar size="sm" className="size-7 border border-border">
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
                      <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />
                    </div>
                    <p className="text-sm text-muted-foreground pb-4">
                      <span className="font-medium text-foreground">
                        {task.creatorName ?? "Someone"}
                      </span>{" "}
                      created the task{" "}
                      <span className="text-muted-foreground">
                        · {timeAgo(task.createdAt)}
                      </span>
                    </p>
                  </div>

                  {/* Branch event (shown when branch differs from default "feat") */}
                  {task.branch && task.branch !== "feat" && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="size-7 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                          <GitBranch className="size-3.5" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground pb-4">
                        <span className="font-medium text-foreground">
                          {task.creatorName ?? "Someone"}
                        </span>{" "}
                        set branch to{" "}
                        <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                          {task.branch}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          · {timeAgo(task.createdAt)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : isBacklog ? (
            <>
              {/* ── Drawer / non-page backlog layout ───────────────── */}

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
                      Launching…
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
                      onClick={() =>
                        window.open(
                          `/environments/${environmentId}/tasks/${taskId}`,
                          "_blank",
                        )
                      }
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                    <PanelRightClose className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Task ID + Status badge + Metadata */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {shortTaskId(task.id, {
                        prefix: task.taskPrefix,
                        environmentName: task.environmentName,
                        taskNumber: task.taskNumber,
                      })}
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
                  {appSection}
                  {branchSectionEditable}
                  {modelSection}
                </CardContent>
              </Card>

              {/* Title */}
              {taskTitleInput}

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
                    environmentId={environmentId}
                    workspaces={workspaces}
                    onStopped={() =>
                      store.getState().fetchWorkspaces(environmentId, taskId)
                    }
                  />
                </div>
              )}
            </>
          ) : variant === "page" ? (
            <>
              {/* ── Page variant: in-progress / review / completed layout ── */}

              {/* ── Attribute pills row ─────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Assignee pill */}
                <Popover
                  open={assigneePickerOpen}
                  onOpenChange={(open) => {
                    setAssigneePickerOpen(open);
                    if (open) fetchTeamMembers();
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="shadow-none"
                        >
                          <Avatar size="sm" className="size-4">
                            {task.creatorAvatarUrl ? (
                              <AvatarImage
                                src={task.creatorAvatarUrl}
                                alt={task.creatorName ?? ""}
                              />
                            ) : null}
                            <AvatarFallback className="text-[0.45rem]">
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
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {task.creatorName ?? "Unassigned"}
                    </TooltipContent>
                  </Tooltip>
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

                {/* Project pill (readonly for in-progress / completed) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="shadow-none"
                      disabled
                    >
                      <Box className="size-3.5 shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {task.environmentName}
                  </TooltipContent>
                </Tooltip>

                {/* Branch pill (readonly for in-progress) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="shadow-none"
                      disabled
                    >
                      <GitBranch className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{task.branch}</TooltipContent>
                </Tooltip>

                {/* Model pill (readonly) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="shadow-none"
                      disabled
                    >
                      <AnthropicIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {MODELS.find((m) => m.value === task.model)?.label ??
                      task.model}
                  </TooltipContent>
                </Tooltip>

                {/* Status badge — hidden when "validating" (PR ready) or "completed" (Merged) since both have their own sections */}
                {task.status !== "validating" &&
                  task.status !== "completed" && (
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
                  )}

                {/* PR review status badge */}
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
                    {task.prReviewStatus === "pass" && (
                      <ShieldCheck className="size-3 mr-1" />
                    )}
                    {task.prReviewStatus === "flag" && (
                      <ShieldAlert className="size-3 mr-1" />
                    )}
                    {task.prReviewStatus === "fail" && (
                      <ShieldX className="size-3 mr-1" />
                    )}
                    {task.prReviewStatus}
                  </Badge>
                )}
              </div>

              {/* ── Task ID ──────────────────────────────────────────── */}
              <p className="text-sm font-medium text-muted-foreground">
                {shortTaskId(task.id, {
                  prefix: task.taskPrefix,
                  environmentName: task.environmentName,
                  taskNumber: task.taskNumber,
                })}
              </p>

              {/* ── Title ────────────────────────────────────────────── */}
              {taskTitleInput}

              {/* ── Prompt (read-only textarea) ──────────────────────── */}
              <Textarea
                ref={promptRef}
                placeholder="Add a prompt…"
                value={
                  editPrompt !== "" ? editPrompt : task.prompt || undefined
                }
                onChange={(e) => {
                  setEditPrompt(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onFocus={(e) => {
                  setEditPrompt(task.prompt);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onBlur={() => {
                  if (editPrompt.trim() !== task.prompt.trim()) {
                    savePrompt();
                  } else {
                    setEditPrompt("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditPrompt("");
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                disabled={saving}
                className="resize-none overflow-hidden border-0 bg-transparent px-0 text-base font-normal shadow-none leading-normal focus-visible:ring-0 w-full placeholder:text-muted-foreground/40"
              />

              {/* ── Attachments ──────────────────────────────────────── */}
              {(task.attachments?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {(task.attachments ?? []).map((att) => (
                    <a
                      key={att.id}
                      href={att.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <svg
                        className="size-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      {att.filename}
                    </a>
                  ))}
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {sandboxSection}
              {pullRequestSection}
              {mergedSection}

              {/* ── Divider ──────────────────────────────────────────── */}
              <hr className="border-border" />

              {/* ── Activity section ─────────────────────────────────── */}
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold">Activity</h2>
                <div className="flex flex-col gap-0">
                  {/* Created event */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <Avatar size="sm" className="size-7 border border-border">
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
                      <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />
                    </div>
                    <p className="text-sm text-muted-foreground pb-4">
                      <span className="font-medium text-foreground">
                        {task.creatorName ?? "Someone"}
                      </span>{" "}
                      created the task{" "}
                      <span className="text-muted-foreground">
                        · {timeAgo(task.createdAt)}
                      </span>
                    </p>
                  </div>

                  {/* Started event */}
                  {task.startedAt && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="size-7 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                          <Play className="size-3.5" />
                        </div>
                        {(workspaces.length > 0 ||
                          task.prUrl ||
                          task.completedAt) && (
                          <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground pb-4">
                        <span className="font-medium text-foreground">
                          Task started
                        </span>{" "}
                        <span className="text-muted-foreground">
                          · {timeAgo(task.startedAt)}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Sandbox built event */}
                  {workspaces.length > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="size-7 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                          <Columns2 className="size-3.5" />
                        </div>
                        {(task.prUrl || task.completedAt) && (
                          <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground pb-4">
                        <span className="font-medium text-foreground">
                          Sandbox{" "}
                          {workspaces[0].status === "provisioning"
                            ? "building"
                            : "built"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          · {timeAgo(workspaces[0].createdAt)}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* PR opened event */}
                  {task.prUrl && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="size-7 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                          <GitPullRequest className="size-3.5" />
                        </div>
                        {task.completedAt && (
                          <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground pb-4">
                        <span className="font-medium text-foreground">
                          Pull request opened
                        </span>{" "}
                        <a
                          href={task.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground transition-colors"
                        >
                          view PR
                        </a>{" "}
                        {task.startedAt && (
                          <span className="text-muted-foreground">
                            · {timeAgo(task.startedAt)}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Completed event */}
                  {task.completedAt && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="size-7 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                          <CheckCircle2 className="size-3.5" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground pb-4">
                        <span className="font-medium text-foreground">
                          Task completed
                        </span>
                        {task.durationMs != null && (
                          <span className="text-muted-foreground">
                            {" · "}
                            {formatDuration(task.durationMs)}
                          </span>
                        )}{" "}
                        <span className="text-muted-foreground">
                          · {timeAgo(task.completedAt)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ── Review / Completed / Other layout (drawer) ── */}

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
                        {task.status === "validating" ? "Review PR" : "View PR"}
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
                      {task.prReviewStatus === "pass" && (
                        <ShieldCheck className="size-3 mr-1" />
                      )}
                      {task.prReviewStatus === "flag" && (
                        <ShieldAlert className="size-3 mr-1" />
                      )}
                      {task.prReviewStatus === "fail" && (
                        <ShieldX className="size-3 mr-1" />
                      )}
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
                      onClick={() =>
                        window.open(
                          `/environments/${environmentId}/tasks/${taskId}`,
                          "_blank",
                        )
                      }
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                    <PanelRightClose className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Task ID + Status badge + Metadata */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {shortTaskId(task.id, {
                        prefix: task.taskPrefix,
                        environmentName: task.environmentName,
                        taskNumber: task.taskNumber,
                      })}
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
                  {appSection}
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

              {/* Title */}
              {taskTitleInput}

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
