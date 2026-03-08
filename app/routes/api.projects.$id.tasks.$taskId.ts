import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, users, orgMembers } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, isPrMerged } from "~/lib/github.server";

export async function loader({
  params,
  request,
}: {
  params: { id: string; taskId: string };
  request: Request;
}) {
  const { user, org } = await requireAuth(request);
  const { id: projectId, taskId } = params;

  // Verify project belongs to user's org
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    log.warn(
      { userId: user.id, projectId },
      "task detail: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [row] = await db
    .select({
      task: tasks,
      creatorName: users.name,
      creatorAvatarUrl: users.avatarUrl,
      projectName: projects.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

  if (!row) {
    log.warn(
      { userId: user.id, projectId, taskId },
      "task detail: task not found",
    );
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // Auto-complete if PR has been merged (result cached for 60s)
  let task = row.task;
  log.info(
    { projectId, taskId, status: task.status, prUrl: task.prUrl ?? null },
    "task detail: PR merge check eligibility",
  );
  if ((task.status === "validating" || task.status === "timed_out") && task.prUrl) {
    try {
      const githubToken = await getSecret(org.id, "GITHUB_TOKEN");
      const parsed = parsePrUrl(task.prUrl);
      log.info(
        { projectId, taskId, hasToken: !!githubToken, parsed },
        "task detail: resolved token and parsed PR URL",
      );
      if (githubToken && parsed) {
        const merged = await isPrMerged(githubToken, parsed.owner, parsed.repo, parsed.number);
        log.info(
          { projectId, taskId, merged },
          "task detail: PR merge check result",
        );
        if (merged) {
          const [updated] = await db
            .update(tasks)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(tasks.id, taskId))
            .returning();
          if (updated) task = updated;
          log.info({ projectId, taskId }, "task detail: PR merged, task auto-completed");
        }
      }
    } catch (err) {
      log.warn(
        { projectId, taskId, error: err instanceof Error ? err.message : "unknown" },
        "task detail: PR merge check failed (non-fatal)",
      );
    }
  } else {
    log.info(
      { projectId, taskId, status: task.status, hasPrUrl: !!task.prUrl },
      "task detail: skipped PR merge check",
    );
  }

  log.debug({ projectId, taskId }, "task detail fetched");
  return Response.json({
    task: {
      ...task,
      creatorName: row.creatorName ?? null,
      creatorAvatarUrl: row.creatorAvatarUrl ?? null,
      projectName: row.projectName,
    },
  });
}

export async function action({
  params,
  request,
}: {
  params: { id: string; taskId: string };
  request: Request;
}) {
  if (request.method !== "PATCH") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, org } = await requireAuth(request);
  const { id: projectId, taskId } = params;

  // Verify project belongs to user's org
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    log.warn(
      { userId: user.id, projectId },
      "task update: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify task exists and belongs to this project
  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

  if (!existing) {
    log.warn(
      { userId: user.id, projectId, taskId },
      "task update: task not found",
    );
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  let body: {
    status?: string;
    prompt?: string;
    branch?: string;
    model?: string;
    projectId?: string;
    createdBy?: string;
    result?: string | null;
    error?: string | null;
    prUrl?: string | null;
    workspaceId?: string | null;
    durationMs?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validStatuses = [
    "ready",
    "running",
    "validating",
    "completed",
    "timed_out",
  ];
  if (body.status && !validStatuses.includes(body.status)) {
    return Response.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 },
    );
  }

  // Validate prompt if provided
  if (body.prompt !== undefined && !body.prompt.trim()) {
    return Response.json({ error: "Prompt cannot be empty" }, { status: 400 });
  }

  // Validate model if provided
  const validModels = ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"];
  if (body.model !== undefined && !validModels.includes(body.model)) {
    return Response.json(
      { error: `Invalid model. Must be one of: ${validModels.join(", ")}` },
      { status: 400 },
    );
  }

  // Validate projectId if provided — must belong to the same org
  if (body.projectId !== undefined) {
    const [newProject] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, body.projectId),
          eq(projects.organizationId, org.id),
        ),
      );
    if (!newProject) {
      log.warn(
        { userId: user.id, newProjectId: body.projectId },
        "task update: target project not found or not in org",
      );
      return Response.json(
        { error: "Target project not found" },
        { status: 404 },
      );
    }
  }

  // Build the update payload — only include provided fields
  const updates: Record<string, unknown> = {};

  if (body.prompt !== undefined) updates.prompt = body.prompt.trim();
  if (body.model !== undefined) updates.model = body.model;
  if (body.branch !== undefined) {
    const trimmed = body.branch.trim();
    if (!trimmed) {
      return Response.json(
        { error: "Branch cannot be empty" },
        { status: 400 },
      );
    }
    updates.branch = trimmed;
  }
  if (body.projectId !== undefined) updates.projectId = body.projectId;
  if (body.createdBy !== undefined) {
    const trimmed = body.createdBy.trim();
    if (!trimmed) {
      return Response.json(
        { error: "Assignee cannot be empty" },
        { status: 400 },
      );
    }
    // Verify the target user is a member of this org
    const [targetMember] = await db
      .select()
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.userId, trimmed),
          eq(orgMembers.organizationId, org.id),
        ),
      );
    if (!targetMember) {
      return Response.json(
        { error: "User is not a member of this organization" },
        { status: 400 },
      );
    }
    updates.createdBy = trimmed;
  }

  if (body.status !== undefined) {
    updates.status = body.status;

    // Automatically set timestamps based on status transitions
    if (body.status === "running" && !existing.startedAt) {
      updates.startedAt = new Date();
    }
    if (
      (body.status === "completed" ||
        body.status === "validating" ||
        body.status === "timed_out") &&
      !existing.completedAt
    ) {
      updates.completedAt = new Date();
    }
  }
  if (body.result !== undefined) updates.result = body.result;
  if (body.error !== undefined) updates.error = body.error;
  if (body.prUrl !== undefined) updates.prUrl = body.prUrl;
  if (body.workspaceId !== undefined) updates.workspaceId = body.workspaceId;
  if (body.durationMs !== undefined) updates.durationMs = body.durationMs;
  if (body.inputTokens !== undefined) updates.inputTokens = body.inputTokens;
  if (body.outputTokens !== undefined) updates.outputTokens = body.outputTokens;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
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
      oldStatus: existing.status,
      newStatus: body.status ?? existing.status,
      promptChanged: body.prompt !== undefined,
      branchChanged: body.branch !== undefined,
      assigneeChanged:
        body.createdBy !== undefined ? body.createdBy : undefined,
      projectChanged: body.projectId !== undefined ? body.projectId : undefined,
    },
    "task updated",
  );

  return Response.json({ task: updated });
}
