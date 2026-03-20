import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouteLoaderData, useNavigate } from "react-router";
import { toast } from "sonner";
import { Filter, Plus, Bot, Loader2, X, Check, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { SidebarToggle } from "~/components/sidebar-toggle";
import { TasksTable } from "~/components/tasks-table";

import { useTaskStore, useTaskList } from "~/store/task-store";
import type { FeedTask, Project, TaskStatus } from "~/types/task";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, environments } from "~/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Loader ────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id))
    .orderBy(projects.name);

  // Also load environments so we can pick a default for task creation
  const envRows = await db
    .select()
    .from(environments)
    .where(eq(environments.organizationId, org.id));

  return { projects: rows, environments: envRows };
}

// ── Types ─────────────────────────────────────────────────────────────────

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

interface FilterState {
  projectIds: Set<string>;
  statuses: Set<TaskStatus>;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  ready: "Backlog",
  running: "Building",
  validating: "PR Ready",
  completed: "Completed",
  timed_out: "Timed Out",
};

const ALL_STATUSES: TaskStatus[] = [
  "ready",
  "running",
  "validating",
  "completed",
  "timed_out",
];

// ── Filter Popover ────────────────────────────────────────────────────────

function FilterPopover({
  projects,
  filters,
  onChange,
  onClear,
}: {
  projects: Project[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  const activeCount = filters.projectIds.size + filters.statuses.size;

  const toggleProject = (id: string) => {
    const next = new Set(filters.projectIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...filters, projectIds: next });
  };

  const toggleStatus = (s: TaskStatus) => {
    const next = new Set(filters.statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...filters, statuses: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activeCount > 0 ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 relative"
          aria-label="Filter tasks"
        >
          <Filter className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground leading-none">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-medium">Filters</span>
          {activeCount > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3" />
              Clear all
            </button>
          )}
        </div>

        {/* Project filter */}
        {projects.length > 0 && (
          <div className="px-3 py-2.5">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Project
            </p>
            <div className="flex flex-col gap-0.5">
              {projects.map((p) => {
                const checked = filters.projectIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProject(p.id)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left w-full"
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        checked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {projects.length > 0 && <Separator />}

        {/* Status filter */}
        <div className="px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Status
          </p>
          <div className="flex flex-col gap-0.5">
            {ALL_STATUSES.map((s) => {
              const checked = filters.statuses.has(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left w-full"
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {checked && <Check className="size-3" />}
                  </div>
                  <span>{STATUS_LABELS[s]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Active filter chips ───────────────────────────────────────────────────

function FilterChips({
  filters,
  projects,
  onChange,
  onClear,
}: {
  filters: FilterState;
  projects: Project[];
  onChange: (next: FilterState) => void;
  onClear: () => void;
}) {
  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const activeCount = filters.projectIds.size + filters.statuses.size;
  if (activeCount === 0) return null;

  const removeProject = (id: string) => {
    const next = new Set(filters.projectIds);
    next.delete(id);
    onChange({ ...filters, projectIds: next });
  };

  const removeStatus = (s: TaskStatus) => {
    const next = new Set(filters.statuses);
    next.delete(s);
    onChange({ ...filters, statuses: next });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 py-2 border-b shrink-0">
      {Array.from(filters.projectIds).map((id) => (
        <Badge
          key={id}
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          {projectMap.get(id) ?? id}
          <button
            onClick={() => removeProject(id)}
            className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="size-2.5" />
          </button>
        </Badge>
      ))}
      {Array.from(filters.statuses).map((s) => (
        <Badge
          key={s}
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          {STATUS_LABELS[s]}
          <button
            onClick={() => removeStatus(s)}
            className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="size-2.5" />
          </button>
        </Badge>
      ))}
      <button
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
      >
        Clear all
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function MyTasksPage({
  loaderData,
}: {
  loaderData: {
    projects: Project[];
    environments: {
      id: string;
      name: string;
      githubRepo: string | null;
      vercelProjectId: string | null;
      vercelProjectName: string | null;
    }[];
  };
}) {
  const navigate = useNavigate();
  const parentData = useRouteLoaderData("routes/_auth") as
    | ParentData
    | undefined;
  const integrations = parentData?.integrations;

  // ── Task store (Zustand) ──────────────────────────────────────────────
  const tasks = useTaskList();

  // Start polling on mount
  useEffect(() => {
    console.log("[MyTasks] Starting task polling");
    const stopPolling = useTaskStore.getState().startPolling();
    return stopPolling;
  }, []);

  // ── Navigate to task detail page ──────────────────────────────────────
  const handleTaskClick = useCallback(
    (task: FeedTask) => {
      console.log(
        "[MyTasks] Navigating to task:",
        task.id,
        "environment:",
        task.environmentId,
        "project:",
        task.projectId,
      );
      navigate(
        `/environments/${task.environmentId}/tasks/${task.id}?from=tasks`,
      );
    },
    [navigate],
  );

  // ── Filters ───────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    projectIds: new Set(),
    statuses: new Set(),
  });

  const clearFilters = useCallback(() => {
    setFilters({ projectIds: new Set(), statuses: new Set() });
  }, []);

  const filteredTasks = useMemo(() => {
    const hasProjectFilter = filters.projectIds.size > 0;
    const hasStatusFilter = filters.statuses.size > 0;
    if (!hasProjectFilter && !hasStatusFilter) return tasks;

    return tasks.filter((t) => {
      if (
        hasProjectFilter &&
        !filters.projectIds.has(t.projectId ?? t.environmentId)
      )
        return false;
      if (hasStatusFilter && !filters.statuses.has(t.status)) return false;
      return true;
    });
  }, [tasks, filters]);

  // ── Create task ───────────────────────────────────────────────────────
  const [creatingTask, setCreatingTask] = useState(false);

  const handleCreateTask = useCallback(async () => {
    // Prefer the default project; fall back to first project
    const defaultProject =
      loaderData.projects.find((p) => p.isDefault) ?? loaderData.projects[0];
    const firstEnv = loaderData.environments[0];

    if (!defaultProject || !firstEnv) {
      toast.error("No project available");
      return;
    }
    setCreatingTask(true);
    try {
      const res = await fetch(`/api/projects/${defaultProject.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "",
          branch: `feat-${Math.random().toString(36).slice(2, 8)}`,
          environmentId: firstEnv.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create task");
        return;
      }
      const task = data.task as FeedTask;
      task.projectId = defaultProject.id;
      task.projectName = defaultProject.name;
      task.environmentName = firstEnv.name;
      task.githubRepo = firstEnv.githubRepo;
      task.vercelProjectId = firstEnv.vercelProjectId;
      task.vercelProjectName = firstEnv.vercelProjectName;
      useTaskStore.getState().setTask(task);
      navigate(
        `/environments/${task.environmentId}/tasks/${task.id}?from=tasks`,
      );
    } catch {
      toast.error("Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }, [loaderData.projects, loaderData.environments, navigate]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden relative">
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-base font-semibold">My tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleCreateTask}
            disabled={
              creatingTask ||
              loaderData.projects.length === 0 ||
              loaderData.environments.length === 0
            }
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

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Tabs defaultValue="assigned" className="flex flex-col flex-1 min-h-0">
        {/* Tab bar */}
        <div className="flex items-center justify-between h-12 px-4 border-b shrink-0">
          <TabsList>
            <TabsTrigger value="assigned">Assigned</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            <FilterPopover
              projects={loaderData.projects}
              filters={filters}
              onChange={setFilters}
              onClear={clearFilters}
            />
          </div>
        </div>

        {/* ── Assigned tab ───────────────────────────────────────────── */}
        <TabsContent
          value="assigned"
          className="flex flex-col flex-1 min-h-0 mt-0"
        >
          {/* Active filter chips */}
          <FilterChips
            filters={filters}
            projects={loaderData.projects}
            onChange={setFilters}
            onClear={clearFilters}
          />

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            <TasksTable
              tasks={filteredTasks}
              projects={loaderData.projects}
              onTaskClick={handleTaskClick}
              selectedTaskId={null}
            />
          </div>
        </TabsContent>

        {/* ── Activity tab ───────────────────────────────────────────── */}
        <TabsContent value="activity" className="flex-1 mt-0">
          <div className="flex flex-col items-center justify-center h-full py-24 gap-6 select-none">
            {/* Illustration */}
            <div className="relative">
              {/* Spinning dashed ring */}
              <div
                className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/20 animate-spin [animation-duration:10s]"
                style={{ margin: "-20px" }}
              />
              {/* Soft glow */}
              <div
                className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse"
                style={{ margin: "-10px" }}
              />
              {/* Central icon tile */}
              <div className="relative flex items-center justify-center size-16 rounded-2xl bg-muted border border-border shadow-sm">
                <Bot className="size-8 text-muted-foreground" />
                {/* Zap badge */}
                <div className="absolute -top-2 -right-2 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow">
                  <Zap className="size-3 fill-current" />
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="flex flex-col items-center gap-2 text-center max-w-xs">
              <p className="text-sm font-medium">We're working on this page…</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Activity tracking is coming soon. Check back shortly — we're
                building it right now.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
