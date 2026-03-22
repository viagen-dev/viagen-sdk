import { useCallback, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { ChevronRight, Ellipsis, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SidebarToggle } from "~/components/sidebar-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments, tasks, projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";
import { findProject } from "~/lib/project-lookup.server";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, isPrMerged } from "~/lib/github.server";
import { TaskDetailPanel, shortTaskId } from "~/components/task-detail-panel";
import { useTask } from "~/store/task-store";
import type { Environment } from "~/types/task";
import { redirect } from "react-router";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string; taskId: string };
}) {
  const { org, memberships } = await requireAuth(request);
  const projectId = params.id;

  // Verify project belongs to org (supports slug or UUID)
  const project = await findProject(org.id, projectId);

  if (!project) {
    log.warn(
      { projectId, orgId: org.id },
      "project task detail: project not found or not in org",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Verify task exists in this project (use resolved UUID, not the slug from params)
  let [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), eq(tasks.projectId, project.id)));

  if (!task) {
    log.warn(
      { projectId, taskId: params.taskId },
      "project task detail: task not found",
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
            { projectId, taskId: task.id, prUrl: task.prUrl },
            "project task detail: PR merged, auto-completing task",
          );
          const [updated] = await db
            .update(tasks)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(tasks.id, task.id))
            .returning();
          if (updated) task = updated;
        }
      }
    } catch (err) {
      log.warn(
        {
          projectId,
          taskId: task.id,
          error: err instanceof Error ? err.message : "unknown",
        },
        "project task detail: PR merge check failed (non-fatal)",
      );
    }
  }

  // Load all org environments and projects for pickers
  const allEnvironments = await db
    .select()
    .from(environments)
    .where(eq(environments.organizationId, org.id));

  const allProjects = await db
    .select({ id: projects.id, name: projects.name, isDefault: projects.isDefault })
    .from(projects)
    .where(eq(projects.organizationId, org.id))
    .orderBy(projects.name);

  log.debug(
    { projectId, taskId: task.id },
    "project task detail: rendering",
  );

  return {
    project: {
      id: project.id,
      slug: project.slug ?? null,
      name: project.name,
      taskPrefix: project.taskPrefix ?? null,
    },
    task: {
      id: task.id,
      environmentId: task.environmentId ?? allEnvironments[0]?.id ?? "",
      title: task.title ?? null,
      prompt: task.prompt,
      taskNumber: task.taskNumber,
    },
    environments: allEnvironments,
    projects: allProjects,
  };
}

interface LoaderData {
  project: { id: string; slug: string | null; name: string; taskPrefix: string | null };
  task: {
    id: string;
    environmentId: string;
    title: string | null;
    prompt: string;
    taskNumber: number | null;
  };
  environments: Environment[];
  projects: { id: string; name: string; isDefault: boolean }[];
}

export default function ProjectTaskDetailPage({
  loaderData,
}: {
  loaderData: LoaderData;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const deleteTriggerRef = useRef<(() => void) | null>(null);
  const handleRegisterDeleteTrigger = useCallback((trigger: () => void) => {
    deleteTriggerRef.current = trigger;
  }, []);

  const liveTask = useTask(loaderData.task.id);
  const liveTitle = liveTask?.title ?? loaderData.task.title;
  const livePrompt = liveTask?.prompt ?? loaderData.task.prompt;

  const taskId = shortTaskId(loaderData.task.id, {
    prefix: loaderData.project.taskPrefix,
    environmentName: loaderData.project.name,
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
      navigate(`/projects/${loaderData.project.slug ?? loaderData.project.id}?tab=tasks`);
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
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
              to={`/projects/${loaderData.project.slug ?? loaderData.project.id}?tab=tasks`}
              className="text-base font-semibold hover:text-muted-foreground transition-colors whitespace-nowrap shrink-0"
            >
              {loaderData.project.name}
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

      <div className="flex-1 min-h-0 overflow-hidden">
        <TaskDetailPanel
          environmentId={loaderData.task.environmentId}
          projectId={loaderData.project.id}
          taskId={loaderData.task.id}
          open={true}
          onClose={handleClose}
          variant="page"
          environments={loaderData.environments}
          projects={loaderData.projects}
          onRegisterDeleteTrigger={handleRegisterDeleteTrigger}
        />
      </div>
    </div>
  );
}
