import { useState, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { shortTaskId } from "~/components/task-detail-panel";
import {
  ChevronRight,
  ExternalLink,
  Square,
  Loader2,
  Bot,
  Zap,
  Columns2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { SidebarToggle } from "~/components/sidebar-toggle";
import { timeAgo } from "~/components/task-detail-panel";
import { cn } from "~/lib/utils";

import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { workspaces, environments, projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";

// ── Loader ────────────────────────────────────────────────────────────────

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org } = await requireAuth(request);
  const { id } = params;

  log.info({ workspaceId: id, orgId: org.id }, "session detail: loading");

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));

  if (!ws) {
    log.warn({ workspaceId: id }, "session detail: workspace not found");
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Verify the workspace belongs to this org via its environment
  const [env] = await db
    .select({
      id: environments.id,
      name: environments.name,
      organizationId: environments.organizationId,
      githubRepo: environments.githubRepo,
    })
    .from(environments)
    .where(eq(environments.id, ws.environmentId));

  if (!env || env.organizationId !== org.id) {
    log.warn(
      { workspaceId: id, orgId: org.id },
      "session detail: org mismatch or environment not found",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Load project if linked
  let project: { id: string; name: string; taskPrefix: string | null } | null =
    null;
  if (ws.projectId) {
    const [proj] = await db
      .select({
        id: projects.id,
        name: projects.name,
        taskPrefix: projects.taskPrefix,
      })
      .from(projects)
      .where(
        and(eq(projects.id, ws.projectId), eq(projects.organizationId, org.id)),
      );
    project = proj ?? null;
  }

  log.info(
    {
      workspaceId: id,
      status: ws.status,
      environmentId: env.id,
      projectId: project?.id ?? null,
    },
    "session detail: loaded successfully",
  );

  return {
    session: {
      id: ws.id,
      sandboxId: ws.sandboxId,
      url: ws.url,
      status: ws.status,
      name: ws.name,
      branch: ws.branch,
      sessionNumber: ws.sessionNumber,
      expiresAt: ws.expiresAt.toISOString(),
      createdAt: ws.createdAt.toISOString(),
      taskId: ws.taskId,
      taskType: ws.taskType,
      projectId: ws.projectId,
    },
    environment: {
      id: env.id,
      name: env.name,
      githubRepo: env.githubRepo,
    },
    project,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────

interface SessionData {
  id: string;
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
  projectId: string | null;
}

interface LoaderData {
  session: SessionData;
  environment: {
    id: string;
    name: string;
    githubRepo: string | null;
  };
  project: { id: string; name: string; taskPrefix: string | null } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m remaining`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h remaining`;
  return `${Math.floor(hrs / 24)}d remaining`;
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function parseWsUrl(url: string): { domain: string; token: string } | null {
  const match = url.match(/^(https?:\/\/[^/]+).*\/t\/([^/]+)$/);
  if (!match) return null;
  return { domain: match[1], token: match[2] };
}

// ── Detail row component ──────────────────────────────────────────────────

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-b-0 min-w-0">
      <span className="text-sm text-muted-foreground w-32 shrink-0 pt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0 text-sm">{children}</div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({
  status,
  expiresAt,
}: {
  status: string;
  expiresAt: string;
}) {
  const expired = isExpired(expiresAt);
  const isActive =
    (status === "running" || status === "provisioning") && !expired;

  if (status === "provisioning" && !expired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Launching
      </span>
    );
  }

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
        <span className="size-2 rounded-full bg-green-500 ring-2 ring-green-500/20 shrink-0" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
      Inactive
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function SessionDetailPage({
  loaderData,
}: {
  loaderData: LoaderData;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");

  const [session, setSession] = useState<SessionData>(loaderData.session);
  const [stopping, setStopping] = useState(false);

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(session.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const displayName = session.name ?? session.branch;
  const sessionId =
    session.sessionNumber != null
      ? shortTaskId(session.id, {
          prefix: loaderData.project?.taskPrefix,
          environmentName: loaderData.project?.name,
          taskNumber: session.sessionNumber,
        })
      : null;
  const expired = isExpired(session.expiresAt);
  const isActive =
    (session.status === "running" || session.status === "provisioning") &&
    !expired;
  const isRunning = session.status === "running" && !expired;

  const parsed = parseWsUrl(session.url);
  const splitUrl = parsed
    ? `${parsed.domain}/via/iframe/t/${parsed.token}`
    : null;

  // ── Stop ───────────────────────────────────────────────────────────

  const handleStop = useCallback(async () => {
    setStopping(true);
    console.log("[SessionDetail] stopping session", session.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[SessionDetail] stop failed:", data.error);
        toast.error(data.error ?? "Failed to stop session");
        return;
      }
      console.log("[SessionDetail] session stopped:", session.id);
      toast.success("Session stopped");
      // Navigate back
      if (from === "project" && loaderData.project) {
        navigate(`/projects/${loaderData.project.id}?tab=sessions`);
      } else {
        navigate("/sessions");
      }
    } catch (err) {
      console.error("[SessionDetail] stop error:", err);
      toast.error("Failed to stop session");
    } finally {
      setStopping(false);
    }
  }, [session.id, from, loaderData.project, navigate]);

  // ── Name editing ───────────────────────────────────────────────────

  const startEditingName = () => {
    setNameValue(session.name ?? "");
    setEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  };

  const commitName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (trimmed === (session.name ?? "")) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    console.log("[SessionDetail] saving name:", trimmed || null);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed || null }),
      });
      if (res.ok) {
        const data = await res.json();
        const savedName = (data.session?.name ?? trimmed) || null;
        setSession((prev) => ({ ...prev, name: savedName }));
        console.log("[SessionDetail] name saved:", savedName);
        toast.success("Name updated");
      } else {
        console.error("[SessionDetail] failed to save name");
        toast.error("Failed to save name");
      }
    } catch (err) {
      console.error("[SessionDetail] name save error:", err);
      toast.error("Failed to save name");
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  }, [nameValue, session.id, session.name]);

  const cancelEditName = () => {
    setNameValue(session.name ?? "");
    setEditingName(false);
  };

  // ── Back label ─────────────────────────────────────────────────────

  const backTo =
    from === "project" && loaderData.project
      ? `/projects/${loaderData.project.id}?tab=sessions`
      : "/sessions";

  const backLabel =
    from === "project" && loaderData.project
      ? loaderData.project.name
      : "My sessions";

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* ── Breadcrumb header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <SidebarToggle />
          <Link
            to={backTo}
            className="text-base font-semibold hover:text-muted-foreground transition-colors whitespace-nowrap shrink-0"
          >
            {backLabel}
          </Link>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
          <span className="text-base font-semibold text-muted-foreground truncate min-w-0">
            {sessionId ? `${sessionId} ${displayName}` : displayName}
          </span>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && splitUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={splitUrl} target="_blank" rel="noopener noreferrer">
                <Columns2 className="size-3.5 mr-1.5" />
                Split view
              </a>
            </Button>
          )}
          {isRunning && splitUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={splitUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5 mr-1.5" />
                Open
              </a>
            </Button>
          )}
          {isActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              disabled={stopping}
            >
              {stopping ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Square className="size-3.5 mr-1.5" />
              )}
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto px-8 py-10 flex flex-col gap-8">
          {/* Session title */}
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="relative mt-1 shrink-0">
              <div className="flex items-center justify-center size-10 rounded-xl bg-muted border border-border">
                <Bot className="size-5 text-muted-foreground" />
              </div>
              {isActive && (
                <div className="absolute -top-1 -right-1 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground">
                  <Zap className="size-2.5 fill-current" />
                </div>
              )}
            </div>

            {/* Name + inline edit */}
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitName();
                      if (e.key === "Escape") cancelEditName();
                    }}
                    onBlur={commitName}
                    className="h-8 text-lg font-semibold px-2 w-full max-w-sm"
                    disabled={savingName}
                    placeholder="Session name…"
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={commitName}
                    disabled={savingName}
                    className="shrink-0"
                  >
                    {savingName ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={cancelEditName}
                    disabled={savingName}
                    className="shrink-0"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditingName}
                  className={cn(
                    "text-xl font-semibold text-left leading-snug truncate w-full max-w-lg",
                    "hover:opacity-70 transition-opacity cursor-text group flex items-center gap-2",
                    !session.name && "text-muted-foreground",
                  )}
                  title="Click to rename"
                >
                  {sessionId && (
                    <span className="font-mono text-muted-foreground shrink-0">
                      {sessionId}
                    </span>
                  )}
                  <span className="truncate">{displayName}</span>
                  <Pencil className="size-3.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                </button>
              )}

              {/* Sub-label: project + environment */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {loaderData.project && (
                  <Link
                    to={`/projects/${loaderData.project.id}?tab=sessions`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {loaderData.project.name}
                  </Link>
                )}
                {loaderData.project && (
                  <span className="text-muted-foreground/40 text-xs">·</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {loaderData.environment.name}
                </span>
              </div>
            </div>
          </div>

          {/* Detail fields */}
          <div className="flex flex-col rounded-lg border border-border px-4">
            <DetailRow label="Status">
              <StatusBadge
                status={session.status}
                expiresAt={session.expiresAt}
              />
            </DetailRow>

            <DetailRow label="Branch">
              <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                {session.branch}
              </span>
            </DetailRow>

            {loaderData.environment.githubRepo && (
              <DetailRow label="Repository">
                <a
                  href={`https://github.com/${loaderData.environment.githubRepo}/tree/${session.branch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm hover:underline underline-offset-2 text-foreground"
                >
                  {loaderData.environment.githubRepo}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>
              </DetailRow>
            )}

            <DetailRow label="Environment">
              <span>{loaderData.environment.name}</span>
            </DetailRow>

            {loaderData.project && (
              <DetailRow label="Project">
                <Link
                  to={`/projects/${loaderData.project.id}?tab=sessions`}
                  className="hover:underline underline-offset-2 text-foreground"
                >
                  {loaderData.project.name}
                </Link>
              </DetailRow>
            )}

            <DetailRow label="Started">
              <span title={new Date(session.createdAt).toLocaleString()}>
                {timeAgo(session.createdAt)}
              </span>
            </DetailRow>

            <DetailRow label="Expires">
              {expired ? (
                <span className="text-destructive">
                  Expired {timeAgo(session.expiresAt)}
                </span>
              ) : (
                <span
                  className={cn(
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                  title={new Date(session.expiresAt).toLocaleString()}
                >
                  {timeRemaining(session.expiresAt)}
                </span>
              )}
            </DetailRow>

            {session.taskType && (
              <DetailRow label="Type">
                <Badge variant="secondary" className="text-xs capitalize">
                  {session.taskType}
                </Badge>
              </DetailRow>
            )}
          </div>

          {/* Workspace access card — only when running */}
          {isRunning && session.url && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <p className="text-sm font-medium">Workspace</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your sandbox is live. Open it in a new tab or use split view to
                see your app and the workspace side-by-side.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {splitUrl && (
                  <Button variant="default" size="sm" asChild>
                    <a
                      href={splitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5 mr-1.5" />
                      Open
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Provisioning state */}
          {session.status === "provisioning" && !expired && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-8 text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium">Launching workspace…</p>
              <p className="text-xs text-muted-foreground">
                This usually takes 30–60 seconds. The page will update
                automatically.
              </p>
            </div>
          )}

          {/* Inactive / expired state */}
          {!isActive && session.status !== "provisioning" && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-8 text-center select-none">
              <div className="flex items-center justify-center size-12 rounded-xl bg-muted border border-border">
                <Bot className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                This session is no longer active
              </p>
              <p className="text-xs text-muted-foreground/70">
                {expired
                  ? "The sandbox has expired."
                  : "The sandbox was stopped."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
