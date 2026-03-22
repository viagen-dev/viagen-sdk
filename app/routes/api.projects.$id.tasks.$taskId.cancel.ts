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

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    log.warn({ userId: user.id, projectId }, "project cancel: project not found or not in org");
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)));

  if (!task) {
    log.warn({ userId: user.id, projectId, taskId }, "project cancel: task not found");
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status === "ready") {
    return Response.json(
      { error: "Task is already in ready state" },
      { status: 400 },
    );
  }

  let body: { closePr?: boolean; newBranch?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Stop sandbox if linked
  if (task.workspaceId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, task.workspaceId));

    if (workspace) {
      try {
        const sandbox = await Sandbox.get({ sandboxId: workspace.sandboxId });
        await sandbox.stop();
        log.info(
          { taskId, workspaceId: workspace.id, sandboxId: workspace.sandboxId },
          "project cancel: sandbox stopped",
        );
      } catch (err) {
        log.warn(
          { taskId, workspaceId: workspace.id, sandboxId: workspace.sandboxId, err },
          "project cancel: sandbox stop failed (may already be stopped)",
        );
      }
      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      log.info({ taskId, workspaceId: workspace.id }, "project cancel: workspace deleted");
    }
  }

  // Close PR if requested
  let prClosed = false;
  if (body.closePr && task.prUrl) {
    const parsed = parsePrUrl(task.prUrl);
    if (parsed) {
      try {
        const githubToken = await getSecret(org.id, "GITHUB_TOKEN");
        if (githubToken) {
          await closePr(githubToken, parsed.owner, parsed.repo, parsed.number);
          prClosed = true;
          log.info({ taskId, prUrl: task.prUrl }, "project cancel: PR closed on GitHub");
        } else {
          log.warn({ orgId: org.id }, "project cancel: no GitHub token, skipping PR close");
        }
      } catch (err) {
        log.warn({ taskId, prUrl: task.prUrl, err }, "project cancel: failed to close PR (non-fatal)");
      }
    }
  }

  // Reset task to ready
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

  if (prClosed) updates.prUrl = null;
  // Always reset to a fresh branch unless explicitly provided
  updates.branch = body.newBranch?.trim() || `feat-${Math.random().toString(36).slice(2, 8)}`;

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
    "project task cancelled and reset to ready",
  );

  return Response.json({ task: updated });
}
