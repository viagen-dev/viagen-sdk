import { Sandbox } from "@vercel/sandbox";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, workspaces } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";

export async function action({
  params,
  request,
}: {
  params: { id: string; taskId: string };
  request: Request;
}) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, org } = await requireAuth(request);
  const { id: projectId, taskId } = params;

  // Verify project belongs to user's org
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    log.warn(
      { userId: user.id, projectId },
      "delete: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch the task
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

  if (!task) {
    log.warn({ userId: user.id, projectId, taskId }, "delete: task not found");
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // Stop sandbox if workspace is linked
  if (task.workspaceId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, task.workspaceId));

    if (workspace) {
      try {
        const sandbox = await Sandbox.get({
          sandboxId: workspace.sandboxId,
        });
        await sandbox.stop();
        log.info(
          { taskId, workspaceId: workspace.id, sandboxId: workspace.sandboxId },
          "delete: sandbox stopped",
        );
      } catch (err) {
        log.warn(
          { taskId, workspaceId: workspace.id, err },
          "delete: sandbox stop failed (may already be stopped)",
        );
      }

      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      log.info(
        { taskId, workspaceId: workspace.id },
        "delete: workspace deleted",
      );
    }
  }

  // Delete the task
  await db.delete(tasks).where(eq(tasks.id, taskId));

  log.info(
    { userId: user.id, projectId, taskId },
    "task deleted permanently",
  );

  return Response.json({ success: true });
}
