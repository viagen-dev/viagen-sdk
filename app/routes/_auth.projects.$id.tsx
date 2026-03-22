import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useProjectStore } from "~/store/project-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  Ellipsis,
  Trash2,
  Bot,
  Plus,
  Loader2,
  CheckCircle2,
  Sparkles,
  Zap,
  ChevronRight,
  ChevronDown,
  CircleDashed,
  LoaderCircle,
  Check,
  FileText,
  Paperclip,
  ExternalLink,
  Square,
  Box,
  X,
} from "lucide-react";

const NO_PROJECT_DESCRIPTION =
  "A catch-all bucket for tasks that haven't been assigned to a specific project yet. Move tasks into a dedicated project to keep your work organized.";

import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { SidebarToggle } from "~/components/sidebar-toggle";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  STATUS_CONFIG,
  timeAgo,
  shortTaskId,
} from "~/components/task-detail-panel";
import { cn } from "~/lib/utils";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import {
  projects,
  tasks,
  environments,
  users,
  projectAttachments,
  workspaces,
} from "~/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { log } from "~/lib/logger.server";
import { findProject } from "~/lib/project-lookup.server";

// ── Status grouping helpers ───────────────────────────────────────────────

type StatusGroup = "Backlog" | "In-progress" | "Completed";

const STATUS_GROUP_ORDER: StatusGroup[] = [
  "Backlog",
  "In-progress",
  "Completed",
];

function getStatusGroup(status: string): StatusGroup {
  switch (status) {
    case "ready":
      return "Backlog";
    case "running":
    case "validating":
    case "timed_out":
      return "In-progress";
    case "completed":
      return "Completed";
    default:
      return "Backlog";
  }
}

function getStatusGroupIcon(group: StatusGroup) {
  switch (group) {
    case "Backlog":
      return CircleDashed;
    case "In-progress":
      return LoaderCircle;
    case "Completed":
      return Check;
  }
}

function getStatusGroupIconClass(group: StatusGroup): string {
  switch (group) {
    case "Backlog":
      return "text-muted-foreground";
    case "In-progress":
      return "text-blue-500";
    case "Completed":
      return "text-green-500";
  }
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org } = await requireAuth(request);

  const project = await findProject(org.id, params.id);

  if (!project) {
    log.warn({ projectId: params.id }, "project detail: not found");
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch tasks belonging to this project
  const projectTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      prompt: tasks.prompt,
      status: tasks.status,
      branch: tasks.branch,
      taskNumber: tasks.taskNumber,
      prUrl: tasks.prUrl,
      createdAt: tasks.createdAt,
      completedAt: tasks.completedAt,
      environmentId: tasks.environmentId,
      creatorName: users.name,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.createdBy, users.id))
    .where(eq(tasks.projectId, project.id))
    .orderBy(desc(tasks.createdAt))
    .limit(100);

  // Fetch project-level attachments
  const attachmentRows = await db
    .select()
    .from(projectAttachments)
    .where(eq(projectAttachments.projectId, project.id));

  log.debug(
    {
      projectId: project.id,
      taskCount: projectTasks.length,
      attachmentCount: attachmentRows.length,
    },
    "project detail loaded",
  );

  // Resolve the effective environment for sandbox / task creation.
  // Prefer the project's defaultEnvironmentId if set, otherwise fall back to
  // the first environment in the org.
  let resolvedEnvId: string | null = null;
  if (project.defaultEnvironmentId) {
    const [defaultEnv] = await db
      .select({ id: environments.id })
      .from(environments)
      .where(
        and(
          eq(environments.id, project.defaultEnvironmentId),
          eq(environments.organizationId, org.id),
        ),
      );
    if (defaultEnv) resolvedEnvId = defaultEnv.id;
  }
  if (!resolvedEnvId) {
    const [firstEnv] = await db
      .select({ id: environments.id })
      .from(environments)
      .where(eq(environments.organizationId, org.id))
      .limit(1);
    resolvedEnvId = firstEnv?.id ?? null;
  }

  // Fetch all environments for the org (for session lookup)
  const orgEnvs = await db
    .select({ id: environments.id, name: environments.name })
    .from(environments)
    .where(eq(environments.organizationId, org.id));

  // Fetch sessions (workspaces) for this project
  const projectSessions =
    orgEnvs.length > 0
      ? await db
          .select({
            id: workspaces.id,
            environmentId: workspaces.environmentId,
            sandboxId: workspaces.sandboxId,
            url: workspaces.url,
            status: workspaces.status,
            name: workspaces.name,
            branch: workspaces.branch,
            expiresAt: workspaces.expiresAt,
            createdAt: workspaces.createdAt,
            taskId: workspaces.taskId,
            projectId: workspaces.projectId,
          })
          .from(workspaces)
          .where(
            and(
              eq(workspaces.projectId, project.id),
              inArray(
                workspaces.environmentId,
                orgEnvs.map((e) => e.id),
              ),
            ),
          )
          .orderBy(desc(workspaces.createdAt))
      : [];

  const envMap = Object.fromEntries(orgEnvs.map((e) => [e.id, e.name]));

  log.debug(
    { projectId: project.id, sessionCount: projectSessions.length },
    "project detail: sessions loaded",
  );

  return {
    project: {
      id: project.id,
      slug: project.slug ?? null,
      name: project.name,
      description: project.description ?? null,
      taskPrefix: project.taskPrefix,
      isDefault: project.isDefault,
      defaultEnvironmentId: project.defaultEnvironmentId ?? null,
    },
    tasks: projectTasks,
    attachments: attachmentRows,
    firstEnvironmentId: resolvedEnvId,
    orgEnvs,
    sessions: projectSessions.map((s) => ({
      ...s,
      environmentName: envMap[s.environmentId] ?? null,
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

type SessionRow = {
  id: string;
  environmentId: string;
  environmentName: string | null;
  sandboxId: string;
  url: string;
  status: string;
  name: string | null;
  branch: string;
  expiresAt: string;
  createdAt: string;
  taskId: string | null;
  projectId: string | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  branch: string;
  taskNumber: number | null;
  prUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  environmentId: string;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
};

type AttachmentRow = {
  id: string;
  projectId: string;
  filename: string;
  blobUrl: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export default function ProjectDetail({
  loaderData,
}: {
  loaderData: {
    project: {
      id: string;
      slug: string | null;
      name: string;
      description: string | null;
      taskPrefix: string | null;
      isDefault: boolean;
      defaultEnvironmentId: string | null;
    };
    tasks: TaskRow[];
    attachments: AttachmentRow[];
    firstEnvironmentId: string | null;
    sessions: SessionRow[];
    orgEnvs: { id: string; name: string }[];
  };
}) {
  const { project, tasks, firstEnvironmentId } = loaderData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "overview";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [launchingWs, setLaunchingWs] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({
    "status:Completed": true,
  }));

  // ── Overview tab state ──────────────────────────────────────────────────
  const updateProjectStore = useProjectStore((s) => s.updateProject);
  const [editTitle, setEditTitle] = useState(project.name);
  const [editDescription, setEditDescription] = useState(
    project.description ?? "",
  );
  const [editPrefix, setEditPrefix] = useState(project.taskPrefix ?? "");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingPrefix, setSavingPrefix] = useState(false);
  const [defaultEnvId, setDefaultEnvId] = useState<string | null>(
    project.defaultEnvironmentId,
  );
  const [savingDefaultEnv, setSavingDefaultEnv] = useState(false);
  const [envPickerOpen, setEnvPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentRow[]>(
    loaderData.attachments,
  );
  const [sessions, setSessions] = useState<SessionRow[]>(
    loaderData.sessions ?? [],
  );
  const [uploading, setUploading] = useState(false);

  // Sync state when navigating between projects without a full remount
  useEffect(() => {
    setEditTitle(project.name);
    setEditDescription(project.description ?? "");
    setEditPrefix(project.taskPrefix ?? "");
    setDefaultEnvId(project.defaultEnvironmentId);
    setAttachments(loaderData.attachments);
    setSessions(loaderData.sessions ?? []);
  }, [project.id]);

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editDescription]);

  // ── Activity grouping ─────────────────────────────────────────────────
  const activityGroups = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    function dayLabel(date: Date): string {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffMs = todayStart.getTime() - d.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      return `${diffDays} days ago`;
    }

    const map = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      const label = dayLabel(new Date(task.createdAt));
      const existing = map.get(label);
      if (existing) existing.push(task);
      else map.set(label, [task]);
    }

    // Sort groups: Today first, then by most recent
    return Array.from(map.entries())
      .sort(([, a], [, b]) => {
        const aTime = new Date(a[0].createdAt).getTime();
        const bTime = new Date(b[0].createdAt).getTime();
        return bTime - aTime;
      })
      .map(([label, groupTasks]) => ({ label, tasks: groupTasks }));
  }, [tasks]);

  const [activityCollapsed, setActivityCollapsed] = useState<
    Record<string, boolean>
  >({});

  // Default: only the first (most recent) group is expanded
  useEffect(() => {
    setActivityCollapsed(
      Object.fromEntries(activityGroups.map((g, i) => [g.label, i !== 0])),
    );
  }, [project.id]);

  const toggleActivity = (label: string) =>
    setActivityCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));


  // ── Save title ────────────────────────────────────────────────────────
  const saveTitle = useCallback(async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditTitle(project.name);
      return;
    }
    if (trimmed === project.name) return;

    setSavingTitle(true);
    console.log("[ProjectDetail] Saving title:", trimmed);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[ProjectDetail] Save title failed:", data.error);
        toast.error(data.error ?? "Failed to save title");
        setEditTitle(project.name);
      } else {
        console.log("[ProjectDetail] Title saved:", data.project?.name);
        updateProjectStore(project.id, { name: trimmed });
        toast.success("Project title updated");
      }
    } catch (err) {
      console.error("[ProjectDetail] Save title error:", err);
      toast.error("Failed to save title");
      setEditTitle(project.name);
    } finally {
      setSavingTitle(false);
    }
  }, [editTitle, project.id, project.name, updateProjectStore]);

  // ── Save description ──────────────────────────────────────────────────
  const saveDescription = useCallback(async () => {
    const trimmed = editDescription.trim();
    const original = project.description ?? "";
    if (trimmed === original) return;

    setSavingDescription(true);
    console.log("[ProjectDetail] Saving description length:", trimmed.length);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, description: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[ProjectDetail] Save description failed:", data.error);
        toast.error(data.error ?? "Failed to save description");
        setEditDescription(original);
      } else {
        console.log("[ProjectDetail] Description saved");
      }
    } catch (err) {
      console.error("[ProjectDetail] Save description error:", err);
      toast.error("Failed to save description");
      setEditDescription(original);
    } finally {
      setSavingDescription(false);
    }
  }, [editDescription, project.id, project.description]);

  // ── Save task prefix ───────────────────────────────────────────────────
  const savePrefix = useCallback(async () => {
    const trimmed = editPrefix.trim().toUpperCase().slice(0, 10);
    const original = project.taskPrefix ?? "";
    if (trimmed === original) return;

    setSavingPrefix(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, taskPrefix: trimmed || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save prefix");
        setEditPrefix(original);
      } else {
        setEditPrefix(trimmed);
        updateProjectStore(project.id, { taskPrefix: trimmed || null });
      }
    } catch {
      toast.error("Failed to save prefix");
      setEditPrefix(original);
    } finally {
      setSavingPrefix(false);
    }
  }, [editPrefix, project.id, project.taskPrefix, updateProjectStore]);

  // ── Save default environment ──────────────────────────────────────────
  const saveDefaultEnvironment = useCallback(
    async (envId: string | null) => {
      if (envId === project.defaultEnvironmentId) {
        setEnvPickerOpen(false);
        return;
      }
      setSavingDefaultEnv(true);
      setEnvPickerOpen(false);
      try {
        const res = await fetch("/api/projects", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: project.id,
            defaultEnvironmentId: envId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Failed to update default environment");
          setDefaultEnvId(project.defaultEnvironmentId);
        } else {
          setDefaultEnvId(envId);
          toast.success(
            envId ? "Default environment updated" : "Default environment cleared",
          );
        }
      } catch {
        toast.error("Failed to update default environment");
        setDefaultEnvId(project.defaultEnvironmentId);
      } finally {
        setSavingDefaultEnv(false);
      }
    },
    [project.id, project.defaultEnvironmentId],
  );

  // ── Upload attachment ─────────────────────────────────────────────────
  const handleAttachmentUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input so same file can be re-selected
      e.target.value = "";

      console.log(
        "[ProjectDetail] Uploading attachment:",
        file.name,
        file.size,
      );
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/projects/${project.id}/attachments`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          console.error(
            "[ProjectDetail] Attachment upload failed:",
            data.error,
          );
          toast.error(data.error ?? "Failed to upload file");
        } else {
          console.log(
            "[ProjectDetail] Attachment uploaded:",
            data.attachment?.id,
          );
          setAttachments((prev) => [...prev, data.attachment]);
          toast.success(`${file.name} attached`);
        }
      } catch (err) {
        console.error("[ProjectDetail] Attachment upload error:", err);
        toast.error("Failed to upload file");
      } finally {
        setUploading(false);
      }
    },
    [project.id],
  );

  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);

  const handleAttachmentDelete = useCallback(
    async (attachmentId: string) => {
      console.log("[ProjectDetail] Deleting attachment:", attachmentId);
      setDeletingAttachmentId(attachmentId);
      try {
        const res = await fetch(`/api/projects/${project.id}/attachments`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("[ProjectDetail] Attachment delete failed:", data.error);
          toast.error(data.error ?? "Failed to delete attachment");
        } else {
          console.log("[ProjectDetail] Attachment deleted:", attachmentId);
          setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
          toast.success("Attachment removed");
        }
      } catch (err) {
        console.error("[ProjectDetail] Attachment delete error:", err);
        toast.error("Failed to delete attachment");
      } finally {
        setDeletingAttachmentId(null);
      }
    },
    [project.id],
  );

  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const groupedTasks = useMemo(() => {
    const statusMap = new Map<StatusGroup, typeof tasks>();
    for (const task of tasks) {
      const group = getStatusGroup(task.status);
      const existing = statusMap.get(group);
      if (existing) existing.push(task);
      else statusMap.set(group, [task]);
    }
    // Sort each group newest first
    for (const groupTasks of statusMap.values()) {
      groupTasks.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return STATUS_GROUP_ORDER.filter((g) => statusMap.has(g)).map((g) => ({
      label: g,
      tasks: statusMap.get(g)!,
    }));
  }, [tasks]);

  const handleStartSession = useCallback(async () => {
    if (!firstEnvironmentId) {
      toast.error("No environment available");
      return;
    }
    const branch = `sandbox-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      "[ProjectDetail] Launching workspace for environment:",
      firstEnvironmentId,
      "branch:",
      branch,
    );
    setLaunchingWs(true);
    try {
      const res = await fetch(
        `/api/environments/${firstEnvironmentId}/sandbox`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branch, projectId: project.id }),
        },
      );
      const data = await res.json();
      if (res.ok && data.workspace) {
        console.log("[ProjectDetail] Workspace launched:", data.workspace.url);
        toast.success("Workspace launched");
        window.open(data.workspace.url, "_blank");
      } else {
        console.error("[ProjectDetail] Workspace launch failed:", data.error);
        toast.error(data.error ?? "Failed to launch workspace");
      }
    } catch (err) {
      console.error("[ProjectDetail] Workspace launch error:", err);
      toast.error("Failed to launch workspace");
    } finally {
      setLaunchingWs(false);
    }
  }, [firstEnvironmentId, project.id]);

  const handleStopSession = useCallback(async (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to stop session");
      } else {
        toast.success("Session stopped");
      }
    } catch {
      toast.error("Failed to stop session");
    }
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!firstEnvironmentId) {
      toast.error("No environment available");
      return;
    }
    console.log("[ProjectDetail] Creating task for project:", project.id);
    setCreatingTask(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "",
          branch: `feat-${Math.random().toString(36).slice(2, 8)}`,
          environmentId: firstEnvironmentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create task");
        return;
      }
      console.log("[ProjectDetail] Task created:", data.task?.id);
      navigate(`/projects/${project.slug ?? project.id}/tasks/${data.task.taskNumber ?? data.task.id}`);
    } catch (err) {
      console.error("[ProjectDetail] Create task error:", err);
      toast.error("Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }, [project.id, firstEnvironmentId, navigate]);

  function parseWsUrl(url: string): { domain: string; token: string } | null {
    const match = url.match(/^(https?:\/\/[^/]+).*\/t\/([^/]+)$/);
    if (!match) return null;
    return { domain: match[1], token: match[2] };
  }

  function iframeUrl(url: string): string {
    const parsed = parseWsUrl(url);
    return parsed
      ? `${parsed.domain}/via/iframe/t/${parsed.token}`
      : `${url}/via/iframe`;
  }

  function timeRemaining(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m remaining`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m remaining`;
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to delete project");
        return;
      }
      toast.success(`Project "${project.name}" deleted`);
      navigate("/tasks", { replace: true });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-base font-semibold">
            {project.isDefault ? project.name : editTitle || project.name}
          </h1>
          {project.taskPrefix && (
            <Badge variant="secondary" className="text-xs font-mono">
              {project.taskPrefix}
            </Badge>
          )}
          {!project.isDefault && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="ml-0.5">
                    <Ellipsis className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete project?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete{" "}
                      <strong>{project.name}</strong> and all of its tasks. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Delete project"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="shadow-none"
            onClick={handleStartSession}
            disabled={launchingWs || !firstEnvironmentId}
          >
            {launchingWs ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Bot className="h-4 w-4 mr-1.5" />
            )}
            Start session
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleCreateTask}
            disabled={creatingTask || !firstEnvironmentId}
          >
            {creatingTask ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Plus className="h-4 w-4 mr-1.5" />
            )}
            Create task
          </Button>
        </div>
      </div>

      {/* Tab row */}
      <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
        <div className="h-12 px-4 border-b shrink-0 flex items-center">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview tab */}
        <TabsContent value="overview" className="flex-1 mt-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-10 flex flex-col gap-6">
            {/* Title */}
            {project.isDefault ? (
              <h2 className="text-2xl font-semibold leading-snug">
                {project.name}
              </h2>
            ) : (
              <div className="relative">
                <input
                  ref={titleRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") {
                      setEditTitle(project.name);
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Project title"
                  className="w-full border-0 bg-transparent px-0 text-2xl font-semibold shadow-none leading-snug focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/40 placeholder:font-normal"
                  disabled={savingTitle}
                />
                {savingTitle && (
                  <Loader2 className="absolute right-0 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                )}
              </div>
            )}

            {/* Description */}
            {project.isDefault ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {NO_PROJECT_DESCRIPTION}
              </p>
            ) : (
              <div className="relative">
                <textarea
                  ref={descriptionRef}
                  value={editDescription}
                  onChange={(e) => {
                    setEditDescription(e.target.value);
                  }}
                  onBlur={saveDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditDescription(project.description ?? "");
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Add a description"
                  rows={1}
                  className="w-full border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none resize-none focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/40 min-h-8 leading-relaxed overflow-hidden"
                  disabled={savingDescription}
                />
                {savingDescription && (
                  <Loader2 className="absolute right-0 top-1 size-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            )}

            {/* Task ID prefix */}
            {!project.isDefault && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-36 shrink-0">
                  Task ID prefix
                </span>
                <div className="relative">
                  <input
                    type="text"
                    value={editPrefix}
                    onChange={(e) =>
                      setEditPrefix(e.target.value.toUpperCase().slice(0, 10))
                    }
                    onBlur={savePrefix}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        setEditPrefix(project.taskPrefix ?? "");
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="e.g. SDK"
                    disabled={savingPrefix}
                    className="w-24 border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/40"
                  />
                  {savingPrefix && (
                    <Loader2 className="absolute right-0 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            )}

            {/* Default environment picker — only when environments exist */}
            {loaderData.orgEnvs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-36 shrink-0">
                  Default environment
                </span>
                <Popover open={envPickerOpen} onOpenChange={setEnvPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                      disabled={savingDefaultEnv}
                    >
                      {savingDefaultEnv ? (
                        <Loader2 className="size-3.5 animate-spin shrink-0" />
                      ) : (
                        <Box className="size-3.5 shrink-0" />
                      )}
                      {defaultEnvId
                        ? (loaderData.orgEnvs.find(
                            (e) => e.id === defaultEnvId,
                          )?.name ?? "Unknown")
                        : "None"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Select environment…" />
                      <CommandList>
                        <CommandEmpty>No environments found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => saveDefaultEnvironment(null)}
                          >
                            <span className="text-muted-foreground">None</span>
                            <Check
                              className={cn(
                                "ml-auto size-3.5",
                                !defaultEnvId ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                          {loaderData.orgEnvs.map((env) => (
                            <CommandItem
                              key={env.id}
                              value={env.name}
                              onSelect={() => saveDefaultEnvironment(env.id)}
                            >
                              <Box className="size-3.5 shrink-0 text-muted-foreground" />
                              {env.name}
                              <Check
                                className={cn(
                                  "ml-auto size-3.5",
                                  defaultEnvId === env.id
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
            )}

            {/* Attachments — only for non-default projects */}
            {!project.isDefault && (
              <div className="flex flex-col gap-2">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att) => (
                      <span
                        key={att.id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                        <a
                          href={att.blobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-50 truncate hover:underline"
                        >
                          {att.filename}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleAttachmentDelete(att.id)}
                          disabled={deletingAttachmentId === att.id}
                          className="ml-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          title="Remove attachment"
                        >
                          {deletingAttachmentId === att.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={attachInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentUpload}
                  disabled={uploading}
                />

                {/* Add attachment button */}
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  disabled={uploading || attachments.length >= 5}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    attachments.length >= 5
                      ? "Maximum 5 attachments reached"
                      : "Add attachment"
                  }
                >
                  {uploading ? (
                    <Loader2 className="size-4 text-muted-foreground animate-spin" />
                  ) : (
                    <Paperclip className="size-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ── Activity ──────────────────────────────────────────────── */}
          {tasks.length > 0 && (
            <div className="max-w-2xl mx-auto px-8 pb-10 flex flex-col gap-4">
              <div className="border-t border-border" />
              <h3 className="text-base font-semibold">Activity</h3>

              <div className="flex flex-col gap-1">
                {activityGroups.map((group) => {
                  const isCollapsed = activityCollapsed[group.label] ?? false;
                  return (
                    <div key={group.label}>
                      {/* Day header row */}
                      <button
                        type="button"
                        onClick={() => toggleActivity(group.label)}
                        className="flex items-center gap-2 w-full h-10 hover:opacity-70 transition-opacity text-left min-w-0 overflow-hidden"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="text-xs font-medium text-muted-foreground shrink-0">
                          {group.label}
                        </span>
                        <span className="text-xs text-muted-foreground/60 shrink-0">
                          {group.tasks.length}
                        </span>
                        <div className="flex-1 border-b border-dashed border-muted-foreground/20 ml-1" />
                      </button>

                      {/* Task rows */}
                      {!isCollapsed && (
                        <div className="flex flex-col">
                          {group.tasks.map((task) => {
                            const taskId = shortTaskId(task.id, {
                              prefix: project.taskPrefix,
                              environmentName: project.name,
                              taskNumber: task.taskNumber,
                            });
                            return (
                              <Link
                                key={task.id}
                                to={`/projects/${project.slug ?? project.id}/tasks/${task.taskNumber ?? task.id}`}
                                className="flex items-center gap-2.5 w-full h-10 pl-8 pr-3 transition-colors text-left min-w-0 overflow-hidden hover:bg-muted/50"
                              >
                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                  {taskId}
                                </span>
                                <span className="text-sm truncate min-w-0">
                                  {task.title || task.prompt}
                                </span>
                                <div className="flex-1" />
                                <Avatar size="sm" className="size-5 shrink-0">
                                  {task.creatorAvatarUrl ? (
                                    <AvatarImage
                                      src={task.creatorAvatarUrl}
                                      alt={task.creatorName ?? ""}
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-[0.45rem]">
                                    {getInitials(task.creatorName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                                  {timeAgo(task.createdAt)}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tasks tab */}
        <TabsContent
          value="tasks"
          className="flex-1 mt-0 overflow-y-auto min-w-0 flex flex-col"
        >
          <div className="w-full flex-1 flex flex-col">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 select-none">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/20 animate-spin [animation-duration:10s]"
                    style={{ margin: "-20px" }}
                  />
                  <div
                    className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse"
                    style={{ margin: "-10px" }}
                  />
                  <div className="relative flex items-center justify-center size-16 rounded-2xl bg-muted border border-border shadow-sm">
                    <CheckCircle2 className="size-8 text-muted-foreground" />
                    <div className="absolute -top-2 -right-2 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow">
                      <Sparkles className="size-3" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-center max-w-xs">
                  <p className="text-sm font-medium">No tasks yet</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Create your first task and let the AI get to work on this
                    project.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCreateTask}
                  disabled={creatingTask || !firstEnvironmentId}
                >
                  {creatingTask ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1.5" />
                  )}
                  Create task
                </Button>
              </div>
            ) : (
              <div className="flex flex-col w-full">
                {groupedTasks.map((sg) => {
                  const statusKey = `status:${sg.label}`;
                  const isCollapsed = collapsed[statusKey] ?? false;
                  const StatusIcon = getStatusGroupIcon(sg.label);
                  const statusIconClass = getStatusGroupIconClass(sg.label);
                  return (
                    <div key={sg.label}>
                      {/* Status group header */}
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(statusKey)}
                        className="flex items-center gap-2 w-full h-10 px-3 hover:bg-muted/50 transition-colors text-left min-w-0 overflow-hidden"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <StatusIcon
                          className={cn("size-3.5 shrink-0", statusIconClass)}
                        />
                        <span className="text-xs font-medium text-muted-foreground shrink-0">
                          {sg.label}
                        </span>
                        <span className="text-xs text-muted-foreground/60 shrink-0">
                          {sg.tasks.length}
                        </span>
                        <div className="flex-1 border-b border-dashed border-muted-foreground/20 ml-1" />
                      </button>

                      {/* Task rows */}
                      {!isCollapsed &&
                        sg.tasks.map((task) => {
                          const badge =
                            task.status !== "ready"
                              ? (() => {
                                  const config =
                                    STATUS_CONFIG[
                                      task.status as keyof typeof STATUS_CONFIG
                                    ];
                                  return config
                                    ? {
                                        label: config.label,
                                        className: config.badgeClassName,
                                      }
                                    : null;
                                })()
                              : null;
                          const taskId = shortTaskId(task.id, {
                            prefix: project.taskPrefix,
                            environmentName: project.name,
                            taskNumber: task.taskNumber,
                          });
                          return (
                            <Link
                              key={task.id}
                              to={`/projects/${project.slug ?? project.id}/tasks/${task.taskNumber ?? task.id}`}
                              className={cn(
                                "flex items-center gap-2.5 w-full h-10 pl-8 pr-3 transition-colors text-left min-w-0 overflow-hidden hover:bg-muted/50",
                              )}
                            >
                              {/* Task ID */}
                              <span className="font-mono text-xs text-muted-foreground shrink-0">
                                {taskId}
                              </span>
                              {/* Title */}
                              <span className="text-sm truncate min-w-0">
                                {task.title || task.prompt}
                              </span>
                              {/* Status badge (in-progress only) */}
                              {badge && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[0.65rem] px-1.5 py-0 h-5 shrink-0",
                                    badge.className,
                                  )}
                                >
                                  {badge.label}
                                </Badge>
                              )}
                              <div className="flex-1" />
                              {/* Creator avatar */}
                              <Avatar size="sm" className="size-5 shrink-0">
                                {task.creatorAvatarUrl ? (
                                  <AvatarImage
                                    src={task.creatorAvatarUrl}
                                    alt={task.creatorName ?? ""}
                                  />
                                ) : null}
                                <AvatarFallback className="text-[0.45rem]">
                                  {getInitials(task.creatorName)}
                                </AvatarFallback>
                              </Avatar>
                              {/* Timestamp */}
                              <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                                {timeAgo(task.createdAt)}
                              </span>
                            </Link>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sessions tab */}
        <TabsContent
          value="sessions"
          className="flex-1 mt-0 overflow-y-auto min-w-0 flex flex-col"
        >
          <div className="w-full flex-1 flex flex-col">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 select-none">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/20 animate-spin [animation-duration:10s]"
                    style={{ margin: "-20px" }}
                  />
                  <div
                    className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse"
                    style={{ margin: "-10px" }}
                  />
                  <div className="relative flex items-center justify-center size-16 rounded-2xl bg-muted border border-border shadow-sm">
                    <Bot className="size-8 text-muted-foreground" />
                    <div className="absolute -top-2 -right-2 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow">
                      <Zap className="size-3 fill-current" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-center max-w-xs">
                  <p className="text-sm font-medium">No sessions yet</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Start a session to work on this project interactively.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartSession}
                  disabled={launchingWs || !firstEnvironmentId}
                >
                  {launchingWs ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Bot className="h-4 w-4 mr-1.5" />
                  )}
                  Start session
                </Button>
              </div>
            ) : (
              <div className="flex flex-col w-full">
                {/* Sessions list header with New session button */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">
                    {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                    onClick={handleStartSession}
                    disabled={launchingWs || !firstEnvironmentId}
                  >
                    {launchingWs ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    New session
                  </Button>
                </div>

                {/* Session rows */}
                {sessions.map((session) => {
                  const isRunning = session.status === "running";
                  const isProvisioning = session.status === "provisioning";
                  const remaining = isRunning
                    ? timeRemaining(session.expiresAt)
                    : null;
                  const isExpired = remaining === "Expired";

                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 w-full h-14 px-4 border-b hover:bg-muted/30 transition-colors min-w-0"
                    >
                      {/* Status indicator */}
                      <div className="shrink-0">
                        {isProvisioning ? (
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        ) : isRunning ? (
                          <div className="size-2 rounded-full bg-green-500" />
                        ) : (
                          <div className="size-2 rounded-full bg-muted-foreground/40" />
                        )}
                      </div>

                      {/* Name + env badge */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm truncate font-medium">
                          {session.name ?? session.branch}
                        </span>
                        {session.environmentName && (
                          <Badge
                            variant="secondary"
                            className="text-[0.65rem] px-1.5 py-0 h-5 shrink-0"
                          >
                            {session.environmentName}
                          </Badge>
                        )}
                      </div>

                      {/* Time remaining / created */}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {isRunning && remaining ? (
                          <span className={isExpired ? "text-red-500" : ""}>
                            {remaining}
                          </span>
                        ) : (
                          timeAgo(session.createdAt)
                        )}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isRunning && session.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shadow-none h-7 px-2.5 text-xs"
                            asChild
                          >
                            <a
                              href={iframeUrl(session.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3 mr-1" />
                              Open
                            </a>
                          </Button>
                        )}
                        {(isRunning || isProvisioning) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shadow-none h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                            onClick={() => handleStopSession(session.id)}
                          >
                            <Square className="size-3 mr-1" />
                            Stop
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
