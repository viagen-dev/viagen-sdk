import { redirect } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string; taskId: string };
}) {
  const { org } = await requireAuth(request);

  // Verify project belongs to org
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    log.warn(
      { projectId: params.id, orgId: org.id },
      "task detail redirect: project not found or not in org",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  // Verify task exists in this project
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), eq(tasks.projectId, project.id)));

  if (!task) {
    log.warn(
      { projectId: project.id, taskId: params.taskId },
      "task detail redirect: task not found",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  log.debug(
    { projectId: project.id, taskId: task.id },
    "task detail: redirecting to dashboard panel",
  );

  // Redirect to dashboard with search params to open the panel
  return redirect(`/?task=${task.id}&project=${project.id}`);
}

export default function TaskDetailRedirect() {
  // This should never render — the loader always redirects.
  return null;
}
