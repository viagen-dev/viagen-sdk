import { useState, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate, useRevalidator, useSearchParams } from "react-router";
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
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SidebarToggle } from "~/components/sidebar-toggle";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
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
import { projects, tasks, environments, users } from "~/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { log } from "~/lib/logger.server";

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

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

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

  log.debug(
    { projectId: project.id, taskCount: projectTasks.length },
    "project detail loaded",
  );

  // Fetch first environment in the org for sandbox / task creation
  const [firstEnv] = await db
    .select({ id: environments.id, name: environments.name })
    .from(environments)
    .where(eq(environments.organizationId, org.id))
    .limit(1);

  return {
    project: {
      id: project.id,
      name: project.name,
      taskPrefix: project.taskPrefix,
      isDefault: project.isDefault,
    },
    tasks: projectTasks,
    firstEnvironmentId: firstEnv?.id ?? null,
  };
}

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

export default function ProjectDetail({
  loaderData,
}: {
  loaderData: {
    project: {
      id: string;
      name: string;
      taskPrefix: string | null;
      isDefault: boolean;
    };
    tasks: TaskRow[];
    firstEnvironmentId: string | null;
  };
}) {
  const { project, tasks, firstEnvironmentId } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "overview";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [launchingWs, setLaunchingWs] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  // Settings state
  const [editName, setEditName] = useState(project.name);
  const [savingName, setSavingName] = useState(false);
  const [editPrefix, setEditPrefix] = useState(project.taskPrefix ?? "");
  const [savingPrefix, setSavingPrefix] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({
    "status:Completed": true,
  }));

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
          body: JSON.stringify({ branch }),
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
  }, [firstEnvironmentId]);

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
      navigate(
        `/environments/${data.task.environmentId}/tasks/${data.task.id}?from=project&projectId=${project.id}`,
      );
    } catch (err) {
      console.error("[ProjectDetail] Create task error:", err);
      toast.error("Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }, [project.id, firstEnvironmentId, navigate]);

  async function handleSaveName() {
    if (!editName.trim() || savingName) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, name: editName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to update name");
        return;
      }
      toast.success("Project name updated");
      revalidator.revalidate();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSavePrefix() {
    if (savingPrefix) return;
    setSavingPrefix(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, taskPrefix: editPrefix.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to update task prefix");
        return;
      }
      toast.success("Task prefix updated");
      revalidator.revalidate();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingPrefix(false);
    }
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
          <h1 className="text-base font-semibold">{project.name}</h1>
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
                    onSelect={() => navigate(`?tab=settings`)}
                  >
                    <Settings className="size-3.5" />
                    Edit project
                  </DropdownMenuItem>
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
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview tab */}
        <TabsContent value="overview" className="flex-1 mt-0">
          <div className="flex flex-col items-center justify-center h-full py-24 gap-6 select-none">
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
              <p className="text-sm font-medium">We're working on this page…</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Project overview is coming soon. You'll be able to see key
                metrics, recent activity, and project health right here.
              </p>
            </div>
          </div>
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
                              to={`/environments/${task.environmentId}/tasks/${task.id}?from=project&projectId=${project.id}`}
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

        {/* Settings tab */}
        <TabsContent value="settings" className="flex-1 mt-0 overflow-y-auto">
          <div className="max-w-xl mx-auto py-8 px-4 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Project name</CardTitle>
                <CardDescription>The display name for this project.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    placeholder="Project name"
                    disabled={savingName}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={savingName || !editName.trim() || editName.trim() === project.name}
                  >
                    {savingName ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task prefix</CardTitle>
                <CardDescription>Short prefix shown before task numbers (e.g. "APP").</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={editPrefix}
                    onChange={(e) => setEditPrefix(e.target.value.toUpperCase().slice(0, 10))}
                    onKeyDown={(e) => e.key === "Enter" && handleSavePrefix()}
                    placeholder="e.g. APP"
                    disabled={savingPrefix}
                    className="flex-1 font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePrefix}
                    disabled={savingPrefix || editPrefix.trim() === (project.taskPrefix ?? "")}
                  >
                    {savingPrefix ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {!project.isDefault && (
              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger zone</CardTitle>
                  <CardDescription>Permanently delete this project and all its tasks.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="size-3.5" />
                    Delete project
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Sessions tab */}
        <TabsContent value="sessions" className="flex-1 mt-0">
          <div className="flex flex-col items-center justify-center h-full py-24 gap-6 select-none">
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
              <p className="text-sm font-medium">No active sessions</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Start a session to spin up a sandbox and work on this project
                interactively.
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
