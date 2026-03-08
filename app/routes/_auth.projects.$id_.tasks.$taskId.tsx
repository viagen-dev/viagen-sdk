import { redirect, useNavigate, useParams, useRouteLoaderData } from "react-router";
import { requireAuth, serializeCookie } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, isPrMerged } from "~/lib/github.server";
import { TaskDetailPanel } from "~/components/task-detail-panel";
import type { Project } from "~/components/task-detail-panel";

interface ParentData {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
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
          { projectId: params.id, fromOrgId: org.id, toOrgId: projectAny.organizationId },
          "task detail page: switching org context to match project's org",
        );
        const url = new URL(request.url);
        throw redirect(url.pathname + url.search, {
          headers: {
            "Set-Cookie": serializeCookie("viagen-org", projectAny.organizationId, {
              path: "/",
              maxAge: 60 * 60 * 24 * 365,
              sameSite: "Lax",
            }),
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
  if ((task.status === "validating" || task.status === "timed_out") && task.prUrl) {
    try {
      const githubToken = await getSecret(org.id, "GITHUB_TOKEN");
      const parsed = parsePrUrl(task.prUrl);
      if (githubToken && parsed) {
        const merged = await isPrMerged(githubToken, parsed.owner, parsed.repo, parsed.number);
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
        { projectId: project.id, taskId: task.id, error: err instanceof Error ? err.message : "unknown" },
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

  return { project, task, projects: allProjects };
}

export default function TaskDetailPage({
  loaderData,
}: {
  loaderData: {
    project: Project;
    task: { id: string; projectId: string };
    projects: Project[];
  };
}) {
  const navigate = useNavigate();

  return (
    <div className="h-[calc(100svh-60px)]">
      <TaskDetailPanel
        projectId={loaderData.project.id}
        taskId={loaderData.task.id}
        open={true}
        onClose={() => navigate("/")}
        variant="page"
        projects={loaderData.projects}
      />
    </div>
  );
}
