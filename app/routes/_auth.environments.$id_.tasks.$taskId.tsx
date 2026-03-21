import { redirect } from "react-router";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { tasks } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { log } from "~/lib/logger.server";

/**
 * Legacy route — redirects to /projects/{projectId}/tasks/{taskId}.
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

  const [task] = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, params.taskId));

  if (!task?.projectId) {
    log.warn(
      { taskId: params.taskId },
      "legacy task route: task not found or has no project",
    );
    throw Response.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  throw redirect(`/projects/${task.projectId}/tasks/${params.taskId}${url.search}`);
}

export default function LegacyTaskRedirect() {
  return null;
}
