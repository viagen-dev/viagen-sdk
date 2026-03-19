import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouteLoaderData, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Filter,
  Plus,
  Bot,
  ArrowUpRight,
  Loader2,
  X,
  Check,
  Zap,
} from "lucide-react";
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
import type { FeedTask, Environment, TaskStatus } from "~/types/task";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Loader ────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);
  const rows = await db
    .select()
    .from(environments)
    .where(eq(environments.organizationId, org.id));
  return { environments: rows };
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
  environmentIds: Set<string>;
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
  environments,
  filters,
  onChange,
  onClear,
}: {
  environments: Environment[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  const activeCount = filters.environmentIds.size + filters.statuses.size;

  const toggleEnvironment = (id: string) => {
    const next = new Set(filters.environmentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...filters, environmentIds: next });
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

        {/* Environment filter */}
        {environments.length > 0 && (
          <div className="px-3 py-2.5">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Environment
            </p>
            <div className="flex flex-col gap-0.5">
              {environments.map((p) => {
                const checked = filters.environmentIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleEnvironment(p.id)}
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

        {environments.length > 0 && <Separator />}

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
  environments,
  onChange,
  onClear,
}: {
  filters: FilterState;
  environments: Environment[];
  onChange: (next: FilterState) => void;
  onClear: () => void;
}) {
  const environmentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of environments) m.set(p.id, p.name);
    return m;
  }, [environments]);

  const activeCount = filters.environmentIds.size + filters.statuses.size;
  if (activeCount === 0) return null;

  const removeEnvironment = (id: string) => {
    const next = new Set(filters.environmentIds);
    next.delete(id);
    onChange({ ...filters, environmentIds: next });
  };

  const removeStatus = (s: TaskStatus) => {
    const next = new Set(filters.statuses);
    next.delete(s);
    onChange({ ...filters, statuses: next });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 py-2 border-b shrink-0">
      {Array.from(filters.environmentIds).map((id) => (
        <Badge
          key={id}
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          {environmentMap.get(id) ?? id}
          <button
            onClick={() => removeEnvironment(id)}
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
  loaderData: { environments: Environment[] };
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
      );
      navigate(`/environments/${task.environmentId}/tasks/${task.id}?from=tasks`);
    },
    [navigate],
  );

  // ── Filters ───────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    environmentIds: new Set(),
    statuses: new Set(),
  });

  const clearFilters = useCallback(() => {
    setFilters({ environmentIds: new Set(), statuses: new Set() });
  }, []);

  const filteredTasks = useMemo(() => {
    const hasEnvironmentFilter = filters.environmentIds.size > 0;
    const hasStatusFilter = filters.statuses.size > 0;
    if (!hasEnvironmentFilter && !hasStatusFilter) return tasks;

    return tasks.filter((t) => {
      if (hasEnvironmentFilter && !filters.environmentIds.has(t.environmentId))
        return false;
      if (hasStatusFilter && !filters.statuses.has(t.status)) return false;
      return true;
    });
  }, [tasks, filters]);

  // ── Create task ───────────────────────────────────────────────────────
  const [creatingTask, setCreatingTask] = useState(false);

  const handleCreateTask = useCallback(async () => {
    const firstApp = loaderData.environments[0];
    if (!firstApp) {
      toast.error("No app available");
      return;
    }
    setCreatingTask(true);
    try {
      const res = await fetch(`/api/environments/${firstApp.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "",
          branch: `feat-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create task");
        return;
      }
      const task = data.task as FeedTask;
      task.environmentName = firstApp.name;
      task.githubRepo = firstApp.githubRepo;
      task.vercelProjectId = firstApp.vercelProjectId;
      task.vercelProjectName = firstApp.vercelProjectName;
      useTaskStore.getState().setTask(task);
      navigate(`/environments/${task.environmentId}/tasks/${task.id}?from=tasks`);
    } catch {
      toast.error("Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }, [loaderData.environments, navigate]);

  // ── Quick workspace launcher ──────────────────────────────────────────
  const [launchingWs, setLaunchingWs] = useState(false);

  const handleQuickWorkspace = useCallback(async () => {
    const pid = loaderData.environments[0]?.id;
    if (!pid) {
      toast.error("No app available");
      return;
    }
    const branch = `sandbox-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      "[MyTasks] Launching quick workspace for project:",
      pid,
      "branch:",
      branch,
    );
    setLaunchingWs(true);
    try {
      const res = await fetch(`/api/environments/${pid}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch }),
      });
      const data = await res.json();
      if (res.ok && data.workspace) {
        console.log(
          "[MyTasks] Workspace launched successfully:",
          data.workspace.url,
        );
        toast.success("Workspace launched");
        window.open(data.workspace.url, "_blank");
      } else {
        console.error("[MyTasks] Workspace launch failed:", data.error);
        toast.error(data.error ?? "Failed to launch workspace");
      }
    } catch (err) {
      console.error("[MyTasks] Workspace launch error:", err);
      toast.error("Failed to launch workspace");
    } finally {
      setLaunchingWs(false);
    }
  }, [loaderData.environments]);

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
            variant="outline"
            size="sm"
            className="shadow-none"
            onClick={handleQuickWorkspace}
            disabled={launchingWs || loaderData.environments.length === 0}
          >
            {launchingWs ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Bot className="h-4 w-4 mr-1.5" />
            )}
            Quick workspace
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleCreateTask}
            disabled={creatingTask || loaderData.environments.length === 0}
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
              environments={loaderData.environments}
              filters={filters}
              onChange={setFilters}
              onClear={clearFilters}
            />
          </div>
        </div>

        {/* ── Created tab ────────────────────────────────────────────── */}
        <TabsContent
          value="assigned"
          className="flex flex-col flex-1 min-h-0 mt-0"
        >
          {/* Active filter chips */}
          <FilterChips
            filters={filters}
            environments={loaderData.environments}
            onChange={setFilters}
            onClear={clearFilters}
          />

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            <TasksTable
              tasks={filteredTasks}
              environments={loaderData.environments}
              onTaskClick={handleTaskClick}
              selectedTaskId={null}
            />
          </div>
        </TabsContent>

        {/* ── Activity tab ───────────────────────────────────────────── */}
        <TabsContent value="activity" className="flex-1 mt-0">
          <div className="flex flex-col items-center justify-center h-full py-24 gap-6 select-none">
            {/* Animated bot illustration */}
            <div className="relative">
              {/* Orbit ring */}
              <div
                className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/20 animate-spin [animation-duration:8s]"
                style={{ margin: "-16px" }}
              />
              {/* Pulsing glow */}
              <div
                className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse"
                style={{ margin: "-8px" }}
              />
              {/* Bot icon */}
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

            {/* Fake activity pills for visual flair */}
            <div
              className="flex flex-col gap-2 w-56 opacity-30 pointer-events-none"
              aria-hidden
            >
              {[
                { color: "bg-blue-500", label: "Task started", w: "w-24" },
                { color: "bg-green-500", label: "PR opened", w: "w-16" },
                { color: "bg-purple-500", label: "Build complete", w: "w-20" },
              ].map(({ color, label, w }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2"
                >
                  <div
                    className={cn("size-1.5 rounded-full shrink-0", color)}
                  />
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <div
                      className={cn(
                        "h-1.5 rounded-full bg-muted-foreground/30 ml-auto",
                        w,
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
