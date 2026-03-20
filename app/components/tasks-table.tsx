import { useEffect, useMemo } from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  ChevronRight,
  ChevronDown,
  FolderKanban,
  CircleDashed,
  LoaderCircle,
  Check,
  Sparkles,
  CheckCircle2,
  GitPullRequest,
  Bot,
} from "lucide-react";
import {
  STATUS_CONFIG,
  timeAgo,
  shortTaskId,
} from "~/components/task-detail-panel";
import type { FeedTask, Project, TaskStatus } from "~/types/task";
import { useTaskStore } from "~/store/task-store";

// ── Types ─────────────────────────────────────────────────────────────────

interface TasksTableProps {
  tasks: FeedTask[];
  projects: Project[];
  onTaskClick: (task: FeedTask) => void;
  selectedTaskId?: string | null;
}

type StatusGroup = "Backlog" | "In-progress" | "Completed";

interface GroupedProject {
  project: Project | { id: string; name: string };
  taskCount: number;
  statusGroups: {
    label: StatusGroup;
    tasks: FeedTask[];
  }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_GROUP_ORDER: StatusGroup[] = [
  "Backlog",
  "In-progress",
  "Completed",
];

function getStatusGroup(status: TaskStatus): StatusGroup {
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

function getStatusBadge(status: TaskStatus) {
  if (status === "ready") return null;
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return {
    label: config.label,
    className: config.badgeClassName,
  };
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

// ── Component ─────────────────────────────────────────────────────────────

export function TasksTable({
  tasks,
  projects,
  onTaskClick,
  selectedTaskId,
}: TasksTableProps) {
  // Collapse state persisted in the task store so it survives navigation.
  const collapsed = useTaskStore((s) => s.collapsed);
  const toggleCollapsed = useTaskStore((s) => s.toggleCollapsed);
  const seedCollapsed = useTaskStore((s) => s.seedCollapsed);

  // Seed default collapsed state for Completed groups the first time we see them.
  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    for (const task of tasks) {
      if (task.status === "completed") {
        const pid = task.projectId ?? task.environmentId;
        defaults[`status:${pid}:Completed`] = true;
      }
    }
    if (Object.keys(defaults).length > 0) {
      seedCollapsed(defaults);
    }
  }, [tasks, seedCollapsed]);

  const toggle = (key: string) => toggleCollapsed(key);

  const grouped = useMemo<GroupedProject[]>(() => {
    if (tasks.length === 0) return [];

    const projectMap = new Map<string, Project>();
    for (const p of projects) {
      projectMap.set(p.id, p);
    }

    // Group tasks by projectId (fall back to environmentId for legacy tasks)
    const byProject = new Map<string, FeedTask[]>();
    for (const task of tasks) {
      const key = task.projectId ?? task.environmentId;
      const existing = byProject.get(key);
      if (existing) {
        existing.push(task);
      } else {
        byProject.set(key, [task]);
      }
    }

    const result: GroupedProject[] = [];

    for (const [projectKey, projectTasks] of byProject) {
      // Try to look up a real project; fall back to name from the task itself
      const project: Project | { id: string; name: string } = projectMap.get(
        projectKey,
      ) ?? {
        id: projectKey,
        name:
          projectTasks[0]?.projectName ??
          projectTasks[0]?.environmentName ??
          "Unknown Project",
      };

      // Group by status group
      const statusMap = new Map<StatusGroup, FeedTask[]>();
      for (const task of projectTasks) {
        const group = getStatusGroup(task.status);
        const existing = statusMap.get(group);
        if (existing) {
          existing.push(task);
        } else {
          statusMap.set(group, [task]);
        }
      }

      // Sort tasks within each group by createdAt descending
      for (const groupTasks of statusMap.values()) {
        groupTasks.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }

      const statusGroups = STATUS_GROUP_ORDER.filter((sg) =>
        statusMap.has(sg),
      ).map((sg) => ({
        label: sg,
        tasks: statusMap.get(sg)!,
      }));

      result.push({
        project,
        taskCount: projectTasks.length,
        statusGroups,
      });
    }

    // Sort projects alphabetically by name
    result.sort((a, b) => a.project.name.localeCompare(b.project.name));

    return result;
  }, [tasks, projects]);

  // ── Empty state ───────────────────────────────────────────────────────

  if (tasks.length === 0) {
    return (
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
            <CheckCircle2 className="size-8 text-muted-foreground" />
            {/* Sparkle badge */}
            <div className="absolute -top-2 -right-2 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow">
              <Sparkles className="size-3" />
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="flex flex-col items-center gap-2 text-center max-w-xs">
          <p className="text-sm font-medium">Your queue is clear 🎉</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            No tasks assigned to you yet. Hit{" "}
            <span className="font-medium text-foreground">Create task</span> to
            let the AI get to work — then watch this list fill up.
          </p>
        </div>

        {/* Ghost task pills */}
        <div
          className="flex flex-col gap-2 w-64 opacity-25 pointer-events-none"
          aria-hidden
        >
          {[
            { icon: Bot, label: "Build the landing page", status: "Building" },
            {
              icon: GitPullRequest,
              label: "Fix auth redirect bug",
              status: "PR Ready",
            },
            { icon: CheckCircle2, label: "Update API docs", status: "Done" },
          ].map(({ icon: Icon, label, status }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2"
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1 truncate">
                {label}
              </span>
              <span className="text-[0.6rem] text-muted-foreground/60 shrink-0">
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full min-w-0">
      {grouped.map((group) => {
        const projectKey = `project:${group.project.id}`;
        const isProjectCollapsed = collapsed[projectKey] ?? false;

        return (
          <div key={group.project.id}>
            {/* Project header row */}
            <button
              type="button"
              onClick={() => toggle(projectKey)}
              className="flex items-center gap-2 w-full h-10 px-3 hover:bg-muted/50 transition-colors text-left min-w-0 overflow-hidden"
            >
              {isProjectCollapsed ? (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">
                {group.project.name}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {group.taskCount}
              </span>
            </button>

            {/* Status sub-groups */}
            {!isProjectCollapsed &&
              group.statusGroups.map((sg) => {
                const statusKey = `status:${group.project.id}:${sg.label}`;
                const isStatusCollapsed = collapsed[statusKey] ?? false;
                const StatusIcon = getStatusGroupIcon(sg.label);
                const statusIconClass = getStatusGroupIconClass(sg.label);

                return (
                  <div key={sg.label}>
                    {/* Status sub-group header */}
                    <button
                      type="button"
                      onClick={() => toggle(statusKey)}
                      className="flex items-center gap-2 w-full h-10 pl-8 pr-3 hover:bg-muted/50 transition-colors text-left group min-w-0 overflow-hidden"
                    >
                      {isStatusCollapsed ? (
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
                      {/* Dashed divider line */}
                      <div className="flex-1 border-b border-dashed border-muted-foreground/20 ml-1" />
                    </button>

                    {/* Task rows */}
                    {!isStatusCollapsed &&
                      sg.tasks.map((task) => {
                        const isSelected = selectedTaskId === task.id;
                        const badge = getStatusBadge(task.status);
                        const taskId = shortTaskId(task.id, {
                          prefix: task.taskPrefix,
                          environmentName: task.environmentName,
                          taskNumber: task.taskNumber,
                        });

                        return (
                          <button
                            type="button"
                            key={task.id}
                            onClick={() => onTaskClick(task)}
                            className={cn(
                              "flex items-center gap-2.5 w-full h-10 pl-14 pr-3 cursor-pointer transition-colors text-left min-w-0 overflow-hidden",
                              isSelected ? "bg-muted" : "hover:bg-muted/50",
                            )}
                          >
                            {/* Task ID */}
                            <span className="font-mono text-xs text-muted-foreground shrink-0">
                              {taskId}
                            </span>

                            {/* Task title / prompt */}
                            <span className="text-sm truncate min-w-0">
                              {task.title || task.prompt}
                            </span>

                            {/* Status badge (only for in-progress) */}
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

                            {/* Spacer */}
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
                          </button>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
