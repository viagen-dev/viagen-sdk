import { Sandbox } from "@vercel/sandbox";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, workspaces } from "~/lib/db/schema";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, closePr } from "~/lib/github.server";
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
      "cancel: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch the task
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

  if (!task) {
    log.warn({ userId: user.id, projectId, taskId }, "cancel: task not found");
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // Only allow cancelling active tasks
  const cancellableStatuses = ["running", "validating", "timed_out"];
  if (!cancellableStatuses.includes(task.status)) {
    log.warn(
      { userId: user.id, taskId, status: task.status },
      "cancel: task is not in a cancellable state",
    );
    return Response.json(
      { error: `Cannot cancel a task with status "${task.status}"` },
      { status: 400 },
    );
  }

  let body: { closePr?: boolean; newBranch?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // 1. Stop the sandbox if workspace is linked
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
          "cancel: sandbox stopped",
        );
      } catch (err) {
        log.warn(
          {
            taskId,
            workspaceId: workspace.id,
            sandboxId: workspace.sandboxId,
            err,
          },
          "cancel: sandbox stop failed (may already be stopped)",
        );
      }

      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      log.info(
        { taskId, workspaceId: workspace.id },
        "cancel: workspace deleted",
      );
    }
  }

  // 2. Close the PR on GitHub if requested
  let prClosed = false;
  if (body.closePr && task.prUrl) {
    const parsed = parsePrUrl(task.prUrl);
    if (parsed) {
      try {
        const githubToken = await getSecret(org.id, "GITHUB_TOKEN");
        if (githubToken) {
          await closePr(
            githubToken,
            parsed.owner,
            parsed.repo,
            parsed.number,
          );
          prClosed = true;
          log.info(
            { taskId, prUrl: task.prUrl },
            "cancel: PR closed on GitHub",
          );
        } else {
          log.warn(
            { orgId: org.id },
            "cancel: no GitHub token, skipping PR close",
          );
        }
      } catch (err) {
        log.warn(
          { taskId, prUrl: task.prUrl, err },
          "cancel: failed to close PR (non-fatal)",
        );
      }
    }
  }

  // 3. Reset task to ready
  const updates: Record<string, unknown> = {
    status: "ready",
    startedAt: null,
    completedAt: null,
    error: null,
    result: null,
    callbackTokenHash: null,
    workspaceId: null,
    durationMs: null,
    inputTokens: null,
    outputTokens: null,
  };

  if (prClosed) {
    updates.prUrl = null;
  }

  if (body.newBranch?.trim()) {
    updates.branch = body.newBranch.trim();
  }

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, taskId))
    .returning();

  log.info(
    {
      userId: user.id,
      projectId,
      taskId,
      previousStatus: task.status,
      prClosed,
      newBranch: body.newBranch ?? null,
    },
    "task cancelled and reset to ready",
  );

  return Response.json({ task: updated });
}
