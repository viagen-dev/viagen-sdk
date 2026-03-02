import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { and, eq } from "drizzle-orm";

import { db } from "~/lib/db";
import { isAdminRole, requireAuth } from "~/lib/auth";
import { projects, tasks, workspaces } from "~/lib/db/schema";
import { log } from "~/lib/log";

export async function action({ params, request }: ActionFunctionArgs) {
  const { projectId, taskId } = params;
  if (!projectId || !taskId) {
    throw new Response("Project ID and Task ID are required", { status: 400 });
  }

  const { user, session } = await requireAuth(request);

  try {
    // Get the project and check permissions
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Response("Project not found", { status: 404 });
    }

    if (project.orgId !== user.orgId) {
      throw new Response("Forbidden", { status: 403 });
    }

    if (project.createdBy !== user.id && !isAdminRole(user.role)) {
      throw new Response("Forbidden", { status: 403 });
    }

    // Get the task to ensure it exists and belongs to the project
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)),
      with: {
        workspace: true,
      },
    });

    if (!task) {
      throw new Response("Task not found", { status: 404 });
    }

    // Clean up workspace if it exists
    if (task.workspace) {
      try {
        // Delete the workspace record
        await db.delete(workspaces).where(eq(workspaces.id, task.workspace.id));
      } catch (error) {
        log.error("Failed to clean up workspace during task deletion", {
          taskId: task.id,
          workspaceId: task.workspace.id,
          error,
          userId: user.id,
          projectId,
        });
        // Continue with task deletion even if workspace cleanup fails
      }
    }

    // Delete the task
    await db.delete(tasks).where(eq(tasks.id, taskId));

    log.info("Task deleted successfully", {
      taskId: task.id,
      projectId,
      userId: user.id,
      sessionId: session.id,
    });

    return json({ success: true });
  } catch (error) {
    log.error("Failed to delete task", {
      taskId,
      projectId,
      userId: user.id,
      error,
    });

    if (error instanceof Response) {
      throw error;
    }

    return json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}