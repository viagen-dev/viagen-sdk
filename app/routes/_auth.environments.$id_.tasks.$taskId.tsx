import { redirect } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { tasks, projects } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { log } from "~/lib/logger.server";

/**
 * Legacy route — redirects to /projects/{slug}/tasks/{taskNumber}.
 * Preserves any query params (e.g. ?from=tasks).
 */
export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string; taskId: string };
}) {
  await requireAuth(request);

  const [row] = await db
    .select({
      projectId: tasks.projectId,
      taskNumber: tasks.taskNumber,
      projectSlug: projects.slug,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, params.taskId));

  if (!row?.projectId) {
    log.warn(
      { taskId: params.taskId },
      "legacy task route: task not found or has no project",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  const slug = row.projectSlug ?? row.projectId;
  const taskRef = row.taskNumber != null ? String(row.taskNumber) : params.taskId;
  const url = new URL(request.url);
  throw redirect(`/projects/${slug}/tasks/${taskRef}${url.search}`);
}

export default function LegacyTaskRedirect() {
  return null;
}
