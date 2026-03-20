import { useState, useEffect, useCallback, useMemo } from "react";
import { useSessionStore } from "~/store/session-store";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Bot,
  Loader2,
  Zap,
  ExternalLink,
  Square,
  Plus,
  ChevronRight,
  ChevronDown,
  FolderKanban,
  SquareDashed,
  CircleDashed,
  LoaderCircle,
  Check,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarToggle } from "~/components/sidebar-toggle";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { timeAgo, shortTaskId } from "~/components/task-detail-panel";
import { cn } from "~/lib/utils";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { workspaces, environments, projects, users } from "~/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  environmentId: string;
  environmentName: string | null;
  projectId: string | null;
  projectName: string | null;
  projectTaskPrefix: string | null;
  sandboxId: string;
  url: string;
  status: string;
  name: string | null;
  branch: string;
  sessionNumber: number | null;
  expiresAt: string;
  createdAt: string;
  taskId: string | null;
  taskType: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
}

// ── Loader ────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);

  console.log(
    "[Sessions] loader: fetching environments and projects for org",
    org.id,
  );

  const envRows = await db
    .select({ id: environments.id, name: environments.name })
    .from(environments)
    .where(eq(environments.organizationId, org.id));

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      taskPrefix: projects.taskPrefix,
    })
    .from(projects)
    .where(eq(projects.organizationId, org.id));

  const envIds = envRows.map((e) => e.id);

  let sessionRows: SessionRow[] = [];

  if (envIds.length > 0) {
    const envMap: Record<string, string> = Object.fromEntries(
      envRows.map((e) => [e.id, e.name]),
    );
    const projectMap: Record<
      string,
      { name: string; taskPrefix: string | null }
    > = Object.fromEntries(
      projectRows.map((p) => [
        p.id,
        { name: p.name, taskPrefix: p.taskPrefix },
      ]),
    );

    const rows = await db
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
        taskType: workspaces.taskType,
        projectId: workspaces.projectId,
        sessionNumber: workspaces.sessionNumber,
        creatorName: users.name,
        creatorAvatarUrl: users.avatarUrl,
      })
      .from(workspaces)
      .innerJoin(users, eq(workspaces.createdBy, users.id))
      .where(inArray(workspaces.environmentId, envIds))
      .orderBy(desc(workspaces.createdAt));

    sessionRows = rows.map((ws) => ({
      ...ws,
      expiresAt: ws.expiresAt.toISOString(),
      createdAt: ws.createdAt.toISOString(),
      environmentName: envMap[ws.environmentId] ?? null,
      projectName: ws.projectId
        ? (projectMap[ws.projectId]?.name ?? null)
        : null,
      projectTaskPrefix: ws.projectId
        ? (projectMap[ws.projectId]?.taskPrefix ?? null)
        : null,
    }));

    console.log("[Sessions] loader: found", sessionRows.length, "sessions");
  } else {
    console.log(
      "[Sessions] loader: org has no environments, returning empty sessions",
    );
  }

  return {
    environments: envRows,
    projects: projectRows,
    sessions: sessionRows,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function timeRemaining(expiresAt: string): string {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diffMs = exp - now;
  if (diffMs <= 0) return "Expired";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m remaining`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h remaining`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d remaining`;
}

function randomString(len = 6): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}

// ── Grouping helpers ──────────────────────────────────────────────────────

type StatusGroup = "Active" | "Inactive";

const STATUS_GROUP_ORDER: StatusGroup[] = ["Active", "Inactive"];

function getStatusGroup(status: string, expiresAt: string): StatusGroup {
  if (status !== "provisioning" && status !== "running") return "Inactive";
  if (new Date(expiresAt).getTime() <= Date.now()) return "Inactive";
  return "Active";
}

function getStatusGroupIcon(group: StatusGroup) {
  switch (group) {
    case "Active":
      return LoaderCircle;
    case "Inactive":
      return CircleDashed;
  }
}

function getStatusGroupIconClass(group: StatusGroup): string {
  switch (group) {
    case "Active":
      return "text-green-500";
    case "Inactive":
      return "text-muted-foreground";
  }
}

interface ProjectGroup {
  projectId: string | null;
  projectName: string;
  isDefault: boolean;
  sessionCount: number;
  statusGroups: { label: StatusGroup; sessions: SessionRow[] }[];
}

// ── Session row ───────────────────────────────────────────────────────────

interface SessionRowItemProps {
  ws: SessionRow;
  onStop: (id: string) => void;
  from?: string;
}

function SessionRowItem({ ws, onStop, from }: SessionRowItemProps) {
  const navigate = useNavigate();

  const displayLabel = ws.name ?? ws.branch;
  const isExpired = new Date(ws.expiresAt).getTime() <= Date.now();
  const isRunning = ws.status === "running" && !isExpired;
  const isProvisioning = ws.status === "provisioning" && !isExpired;

  const handleRowClick = () => {
    const params = from ? `?from=${from}` : "";
    navigate(`/sessions/${ws.id}${params}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => e.key === "Enter" && handleRowClick()}
      className="flex items-center gap-2.5 w-full h-10 pl-14 pr-3 transition-colors group min-w-0 overflow-hidden hover:bg-muted/50 cursor-pointer"
    >
      {/* Session ID */}
      <span className="font-mono text-xs text-muted-foreground shrink-0">
        {shortTaskId(ws.id, {
          prefix: ws.projectTaskPrefix,
          environmentName: ws.projectName,
          taskNumber: ws.sessionNumber,
        })}
      </span>

      {/* Name / branch — display only */}
      <span
        className={cn(
          "text-sm truncate min-w-0 flex-1",
          ws.name ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {displayLabel}
      </span>

      {/* Time remaining (running only) */}
      {isRunning && (
        <span
          className={cn(
            "text-xs shrink-0 whitespace-nowrap",
            timeRemaining(ws.expiresAt) === "Expired"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {timeRemaining(ws.expiresAt)}
        </span>
      )}

      {/* Creator avatar */}
      <Avatar size="sm" className="size-5 shrink-0">
        {ws.creatorAvatarUrl ? (
          <AvatarImage src={ws.creatorAvatarUrl} alt={ws.creatorName ?? ""} />
        ) : null}
        <AvatarFallback className="text-[0.45rem]">
          {ws.creatorName
            ? ws.creatorName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
            : "?"}
        </AvatarFallback>
      </Avatar>

      {/* Created at */}
      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
        {timeAgo(ws.createdAt)}
      </span>

      {/* Actions — visible on hover */}
      <div
        className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {isProvisioning && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Launching…
          </span>
        )}
        {isRunning && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs gap-1"
              onClick={() => window.open(ws.url, "_blank")}
            >
              <ExternalLink className="size-3" />
              Open
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs gap-1 text-destructive hover:text-destructive"
              onClick={() => onStop(ws.id)}
            >
              <Square className="size-3" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sessions grouped table ────────────────────────────────────────────────

interface SessionsTableProps {
  sessions: SessionRow[];
  onStop: (id: string) => void;
  onNew: () => void;
}

function SessionsTable({ sessions, onStop, onNew }: SessionsTableProps) {
  const collapsed = useSessionStore((s) => s.collapsed);
  const toggleCollapsed = useSessionStore((s) => s.toggleCollapsed);
  const seedCollapsed = useSessionStore((s) => s.seedCollapsed);

  const toggle = (key: string) => toggleCollapsed(key);

  const grouped = useMemo<ProjectGroup[]>(() => {
    if (sessions.length === 0) return [];

    const byProject = new Map<string, SessionRow[]>();
    for (const ws of sessions) {
      const key = ws.projectId ?? "__none__";
      const existing = byProject.get(key);
      if (existing) existing.push(ws);
      else byProject.set(key, [ws]);
    }

    const result: ProjectGroup[] = [];
    for (const [key, rows] of byProject) {
      const isNone = key === "__none__";
      const sample = rows[0];

      const statusMap = new Map<StatusGroup, SessionRow[]>();
      for (const ws of rows) {
        const group = getStatusGroup(ws.status, ws.expiresAt);
        const existing = statusMap.get(group);
        if (existing) existing.push(ws);
        else statusMap.set(group, [ws]);
      }
      for (const g of statusMap.values()) {
        g.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }

      result.push({
        projectId: isNone ? null : key,
        projectName: isNone
          ? "No project"
          : (sample.projectName ?? "Unknown Project"),
        isDefault: isNone,
        sessionCount: rows.length,
        statusGroups: STATUS_GROUP_ORDER.filter((sg) => statusMap.has(sg)).map(
          (sg) => ({
            label: sg,
            sessions: statusMap.get(sg)!,
          }),
        ),
      });
    }

    result.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return 1;
      if (!a.isDefault && b.isDefault) return -1;
      return a.projectName.localeCompare(b.projectName);
    });

    return result;
  }, [sessions]);

  // Seed Inactive subgroups as collapsed the first time we see them
  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    for (const group of grouped) {
      const key = `status:${group.projectId ?? "none"}:Inactive`;
      defaults[key] = true;
    }
    if (Object.keys(defaults).length > 0) {
      seedCollapsed(defaults);
    }
  }, [grouped, seedCollapsed]);

  if (sessions.length === 0) {
    return <EmptyState onNew={onNew} />;
  }

  return (
    <div className="flex flex-col w-full min-w-0">
      {grouped.map((group) => {
        const projectKey = `project:${group.projectId ?? "none"}`;
        const isProjectCollapsed = collapsed[projectKey] ?? false;

        return (
          <div key={group.projectId ?? "__none__"}>
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
              {group.isDefault ? (
                <SquareDashed className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="text-sm font-medium truncate">
                {group.projectName}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {group.sessionCount}
              </span>
            </button>

            {/* Status sub-groups */}
            {!isProjectCollapsed &&
              group.statusGroups.map((sg) => {
                const statusKey = `status:${group.projectId ?? "none"}:${sg.label}`;
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
                        {sg.sessions.length}
                      </span>
                      <div className="flex-1 border-b border-dashed border-muted-foreground/20 ml-1" />
                    </button>

                    {/* Session rows */}
                    {!isStatusCollapsed &&
                      sg.sessions.map((ws) => (
                        <SessionRowItem
                          key={ws.id}
                          ws={ws}
                          onStop={onStop}
                          from="sessions"
                        />
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

// ── New Session Dialog ────────────────────────────────────────────────────

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environments: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  onCreated: (session: SessionRow) => void;
}

function NewSessionDialog({
  open,
  onOpenChange,
  environments: envList,
  projects: projectList,
  onCreated,
}: NewSessionDialogProps) {
  const [environmentId, setEnvironmentId] = useState(envList[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>("");
  const [sessionName, setSessionName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset to defaults when dialog opens
  useEffect(() => {
    if (open) {
      setEnvironmentId(envList[0]?.id ?? "");
      setProjectId("");
      setSessionName("");
    }
  }, [open, envList]);

  const handleSubmit = async () => {
    if (!environmentId) {
      toast.error("Please select an environment");
      return;
    }
    const branch = `sandbox-${randomString(6)}`;
    const name = sessionName.trim() || null;

    console.log(
      "[Sessions] creating new session — env:",
      environmentId,
      "branch:",
      branch,
      "name:",
      name,
      "project:",
      projectId || null,
    );

    setSubmitting(true);
    try {
      const res = await fetch(`/api/environments/${environmentId}/sandbox`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          name,
          projectId: projectId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.workspace) {
        const errMsg = data.error ?? "Failed to launch session";
        console.error("[Sessions] sandbox launch failed:", errMsg);
        toast.error(errMsg);
        return;
      }

      console.log(
        "[Sessions] session created — workspaceId:",
        data.workspace.id,
        "url:",
        data.workspace.url,
      );

      const envRow = envList.find((e) => e.id === environmentId);
      const projRow = projectList.find((p) => p.id === projectId);

      const newSession: SessionRow = {
        id: data.workspace.id,
        environmentId: data.workspace.environmentId ?? environmentId,
        environmentName: envRow?.name ?? null,
        projectId: projectId || null,
        projectName: projRow?.name ?? null,
        sandboxId: data.workspace.sandboxId ?? "",
        url: data.workspace.url ?? "",
        status: data.workspace.status ?? "provisioning",
        name: data.workspace.name ?? name,
        branch: data.workspace.branch ?? branch,
        expiresAt: data.workspace.expiresAt
          ? new Date(data.workspace.expiresAt).toISOString()
          : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: data.workspace.createdAt
          ? new Date(data.workspace.createdAt).toISOString()
          : new Date().toISOString(),
        taskId: data.workspace.taskId ?? null,
        taskType: data.workspace.taskType ?? null,
        sessionNumber: null,
        projectTaskPrefix: null,
        creatorName: null,
        creatorAvatarUrl: null,
      };

      onCreated(newSession);
      onOpenChange(false);

      if (data.workspace.url) {
        window.open(data.workspace.url, "_blank");
      }

      toast.success("Session launched");

      // Fire-and-forget name backfill if no name provided
      if (!name) {
        console.log(
          "[Sessions] firing name backfill for new session",
          data.workspace.id,
        );
        fetch("/api/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: data.workspace.id }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.workspace?.name) {
              console.log(
                "[Sessions] name backfill resolved for",
                data.workspace.id,
                "→",
                d.workspace.name,
              );
              onCreated({ ...newSession, name: d.workspace.name });
            }
          })
          .catch((err) => {
            console.warn(
              "[Sessions] name backfill failed (fire-and-forget)",
              err,
            );
          });
      }
    } catch (err) {
      console.error("[Sessions] error creating session:", err);
      toast.error("Failed to launch session");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New session</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Environment */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Environment</label>
            <Select value={environmentId} onValueChange={setEnvironmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                {envList.map((env) => (
                  <SelectItem key={env.id} value={env.id}>
                    {env.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Project{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No project</SelectItem>
                {projectList.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Session name (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Session name{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Auth refactor"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) handleSubmit();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !environmentId}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                Launching…
              </>
            ) : (
              <>
                <Plus className="size-4 mr-1.5" />
                Launch session
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
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
        <p className="text-sm font-medium">No sessions yet</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Start a session to spin up a sandbox for free-form building.
        </p>
      </div>

      <Button size="sm" onClick={onNew} className="gap-1.5">
        <Plus className="size-4" />
        New session
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

interface LoaderData {
  environments: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  sessions: SessionRow[];
}

export default function MySessionsPage({
  loaderData,
}: {
  loaderData: LoaderData;
}) {
  const [sessions, setSessions] = useState<SessionRow[]>(loaderData.sessions);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Polling ─────────────────────────────────────────────────────────
  const hasProvisioning = sessions.some((s) => s.status === "provisioning");
  const pollInterval = hasProvisioning ? 3_000 : 15_000;

  const pollSessions = useCallback(async () => {
    console.log("[Sessions] polling /api/sessions …");
    try {
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) {
        console.warn("[Sessions] poll response not OK:", res.status);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        setSessions(data.sessions as SessionRow[]);
        console.log(
          "[Sessions] polled — got",
          data.sessions.length,
          "sessions",
        );
      }
    } catch (err) {
      console.warn("[Sessions] poll error:", err);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(pollSessions, pollInterval);
    return () => clearInterval(id);
  }, [pollSessions, pollInterval]);

  // ── Stop session ──────────────────────────────────────────────────
  const handleStop = useCallback(
    async (id: string) => {
      console.log("[Sessions] stopping session", id);
      // Optimistically remove
      setSessions((prev) => prev.filter((s) => s.id !== id));

      try {
        const res = await fetch(`/api/sessions/${id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error("[Sessions] stop failed for", id, data.error);
          toast.error(data.error ?? "Failed to stop session");
          // Re-fetch to restore accurate state
          pollSessions();
          return;
        }

        console.log("[Sessions] session stopped:", id);
        toast.success("Session stopped");

        // Name backfill after stop (fire-and-forget)
        fetch("/api/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: id }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.workspace?.name) {
              console.log(
                "[Sessions] post-stop name backfill resolved for",
                id,
                "→",
                d.workspace.name,
              );
            }
          })
          .catch((err) =>
            console.warn("[Sessions] post-stop name backfill failed", err),
          );
      } catch (err) {
        console.error("[Sessions] error stopping session", id, err);
        toast.error("Failed to stop session");
        pollSessions();
      }
    },
    [pollSessions],
  );

  // ── New session created ───────────────────────────────────────────
  const handleCreated = useCallback((session: SessionRow) => {
    setSessions((prev) => {
      // If the session already exists in the list (e.g. from name backfill), update it
      const exists = prev.some((s) => s.id === session.id);
      if (exists) {
        return prev.map((s) =>
          s.id === session.id ? { ...s, ...session } : s,
        );
      }
      // Prepend new session
      return [session, ...prev];
    });
  }, []);

  // ── Name update (inline edit) ─────────────────────────────────────
  // ── Backfill names for sessions that have no name ─────────────────
  useEffect(() => {
    const unnamed = sessions.filter(
      (s) => !s.name && s.status !== "provisioning",
    );
    for (const ws of unnamed) {
      console.log("[Sessions] firing name backfill for unnamed session", ws.id);
      fetch("/api/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: ws.id }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.workspace?.name) {
            console.log(
              "[Sessions] backfill resolved for",
              ws.id,
              "→",
              d.workspace.name,
            );
            setSessions((prev) =>
              prev.map((s) =>
                s.id === ws.id ? { ...s, name: d.workspace.name } : s,
              ),
            );
          }
        })
        .catch((err) =>
          console.warn("[Sessions] backfill failed for", ws.id, err),
        );
    }
    // Only run on mount — intentionally no exhaustive deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-base font-semibold">My sessions</h1>
        </div>
        <Button
          variant="default"
          size="sm"
          className="shadow-none gap-1.5"
          onClick={() => setDialogOpen(true)}
          disabled={loaderData.environments.length === 0}
        >
          <Plus className="size-4" />
          New session
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        <SessionsTable
          sessions={sessions}
          onStop={handleStop}
          onNew={() => setDialogOpen(true)}
        />
      </div>

      {/* New Session Dialog */}
      <NewSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        environments={loaderData.environments}
        projects={loaderData.projects}
        onCreated={handleCreated}
      />
    </div>
  );
}
