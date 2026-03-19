import { useCallback, useRef } from "react";
import { redirect, useNavigate, useSearchParams, Link } from "react-router";
import { ChevronRight, Ellipsis, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SidebarToggle } from "~/components/sidebar-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { requireAuth, serializeCookie } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, isPrMerged } from "~/lib/github.server";
import { TaskDetailPanel } from "~/components/task-detail-panel";
import type { Project } from "~/types/task";

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

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string; taskId: string };
}) {
  const { org, memberships } = await requireAuth(request);

  // Verify project belongs to org
  let [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    // Project not found for current org — check if the user is a member of the org
    // that actually owns this project (e.g. they followed a direct link while a
    // different org was active in their cookie).
    const [projectAny] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, params.id));

    if (projectAny) {
      const membershipForOrg = memberships.find(
        (m) => m.organizationId === projectAny.organizationId,
      );

      if (membershipForOrg) {
        // User is a member of the org that owns this project. Switch the active
        // org cookie and redirect back to this same URL so that the full layout
        // (navbar, integrations, etc.) also picks up the correct org.
        log.info(
          {
            projectId: params.id,
            fromOrgId: org.id,
            toOrgId: projectAny.organizationId,
          },
          "task detail page: switching org context to match project's org",
        );
        const url = new URL(request.url);
        throw redirect(url.pathname + url.search, {
          headers: {
            "Set-Cookie": serializeCookie(
              "viagen-org",
              projectAny.organizationId,
              {
                path: "/",
                maxAge: 60 * 60 * 24 * 365,
                sameSite: "Lax",
              },
            ),
          },
        });
      }
    }

    log.warn(
      { projectId: params.id, orgId: org.id },
      "task detail page: project not found or not in org",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Verify task exists in this project
  let [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), eq(tasks.projectId, project.id)));

  if (!task) {
    log.warn(
      { projectId: project.id, taskId: params.taskId },
      "task detail page: task not found",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Auto-complete if PR has been merged
  if (
    (task.status === "validating" || task.status === "timed_out") &&
    task.prUrl
  ) {
    try {
      const githubToken = await getSecret(org.id, "GITHUB_TOKEN");
      const parsed = parsePrUrl(task.prUrl);
      if (githubToken && parsed) {
        const merged = await isPrMerged(
          githubToken,
          parsed.owner,
          parsed.repo,
          parsed.number,
        );
        if (merged) {
          log.info(
            { projectId: project.id, taskId: task.id, prUrl: task.prUrl },
            "task detail page: PR merged, auto-completing task",
          );
          const [updated] = await db
            .update(tasks)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(tasks.id, task.id))
            .returning();
          if (updated) {
            task = updated;
          }
        }
      }
    } catch (err) {
      log.warn(
        {
          projectId: project.id,
          taskId: task.id,
          error: err instanceof Error ? err.message : "unknown",
        },
        "task detail page: failed to check PR merge status (non-fatal)",
      );
    }
  }

  // Load all org projects for the project picker
  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id));

  log.debug(
    { projectId: project.id, taskId: task.id },
    "task detail page: rendering full page view",
  );

  return {
    project,
    task: {
      id: task.id,
      projectId: task.projectId,
      title: task.title ?? null,
      prompt: task.prompt,
      taskNumber: task.taskNumber,
    },
    projects: allProjects,
  };
}

import { shortTaskId } from "~/components/task-detail-panel";
import { useTask } from "~/store/task-store";

interface TaskLoaderData {
  project: Project;
  task: {
    id: string;
    projectId: string;
    title: string | null;
    prompt: string;
    taskNumber: number | null;
  };
  projects: Project[];
}

export default function TaskDetailPage({
  loaderData,
}: {
  loaderData: TaskLoaderData;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const deleteTriggerRef = useRef<(() => void) | null>(null);
  const handleRegisterDeleteTrigger = useCallback((trigger: () => void) => {
    deleteTriggerRef.current = trigger;
  }, []);

  // Read the live task from the store so the breadcrumb updates reactively
  // when the user edits the title inside the panel below.
  const liveTask = useTask(loaderData.task.id);
  const liveTitle = liveTask?.title ?? loaderData.task.title;
  const livePrompt = liveTask?.prompt ?? loaderData.task.prompt;

  const taskId = shortTaskId(loaderData.task.id, {
    projectName: loaderData.project.name,
    taskNumber: loaderData.task.taskNumber,
  });

  const breadcrumbLabel = liveTitle
    ? liveTitle.length > 60
      ? liveTitle.slice(0, 60).trimEnd() + "…"
      : liveTitle
    : livePrompt.length > 48
      ? livePrompt.slice(0, 48).trimEnd() + "…"
      : livePrompt;

  const handleClose = () => {
    if (from === "tasks") {
      navigate("/tasks");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* ── Breadcrumb header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <SidebarToggle />
          {from === "tasks" ? (
            <Link
              to="/tasks"
              className="text-base font-semibold hover:text-muted-foreground transition-colors whitespace-nowrap shrink-0"
            >
              My tasks
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="text-base font-semibold hover:text-muted-foreground transition-colors whitespace-nowrap shrink-0"
            >
              Dashboard
            </Link>
          )}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
          <span className="text-base font-semibold text-muted-foreground truncate min-w-0">
            {taskId} {breadcrumbLabel}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0 ml-1">
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => deleteTriggerRef.current?.()}
              >
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Task detail content ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TaskDetailPanel
          projectId={loaderData.project.id}
          taskId={loaderData.task.id}
          open={true}
          onClose={handleClose}
          variant="page"
          projects={loaderData.projects}
          onRegisterDeleteTrigger={handleRegisterDeleteTrigger}
        />
      </div>
    </div>
  );
}
