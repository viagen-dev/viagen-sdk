import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, orgMembers, users } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, isPrMerged } from "~/lib/github.server";
import { sendTaskTimeoutEmail } from "~/lib/email.server";

export async function loader({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const { user, org } = await requireAuth(request);
  const projectId = params.id;

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
      "tasks list: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Optional status filter
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  // Join with users to get creator name + avatar
  const rowsWithCreator = await db
    .select({
      task: tasks,
      creatorName: users.name,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt));

  // Flatten into task objects with creator info
  const rows = rowsWithCreator.map((r) => ({
    ...r.task,
    creatorName: r.creatorName ?? null,
    creatorAvatarUrl: r.creatorAvatarUrl ?? null,
  }));

  // Auto-timeout tasks that have been running for 40+ minutes without agent response
  const TIMEOUT_MS = 40 * 60 * 1000;
  const now = Date.now();
  const expiredRows = rows.filter((t) => {
    if (t.status !== "running") return false;
    const refTime = t.startedAt ?? t.createdAt;
    if (!refTime) return false;
    const age = now - new Date(refTime).getTime();
    return age >= TIMEOUT_MS;
  });

  if (expiredRows.length > 0) {
    const expiredTaskIds = expiredRows.map((t) => t.id);
    log.info(
      { projectId, expiredTaskIds },
      "auto-timing-out tasks older than 40 minutes",
    );

    for (const row of expiredRows) {
      const refTime = row.startedAt ?? row.createdAt;
      const durationMs = refTime ? now - new Date(refTime).getTime() : null;
      await db
        .update(tasks)
        .set({
          status: "timed_out",
          completedAt: new Date(),
          error: "Task timed out after 40 minutes without agent response",
          callbackTokenHash: null,
          durationMs,
        })
        .where(eq(tasks.id, row.id));

      row.status = "timed_out";
      row.completedAt = new Date();
      row.error = "Task timed out after 40 minutes without agent response";
      row.durationMs = durationMs;
    }

    // Send timeout notification emails (fire-and-forget)
    (async () => {
      try {
        const members = await db
          .select({ email: users.email })
          .from(orgMembers)
          .innerJoin(users, eq(orgMembers.userId, users.id))
          .where(eq(orgMembers.organizationId, org.id));

        for (const row of expiredRows) {
          for (const member of members) {
            sendTaskTimeoutEmail({
              to: member.email,
              projectName: project.name,
              projectId,
              taskId: row.id,
              taskPrompt: row.prompt,
            }).catch((err: unknown) =>
              log.error({ email: member.email, taskId: row.id, err }, "task timeout email failed"),
            );
          }
        }
        log.info(
          { projectId, expiredTaskIds, recipientCount: members.length },
          "task timeout emails dispatched",
        );
      } catch (err) {
        log.error({ projectId, err }, "failed to send task timeout notifications");
      }
    })();
  }

  // Auto-complete tasks whose PR has been merged on GitHub
  const validatingWithPr = rows.filter(
    (t) => t.status === "validating" && t.prUrl,
  );

  if (validatingWithPr.length > 0) {
    try {
      const githubToken = await getSecret(org.id, "GITHUB_TOKEN");
      if (githubToken) {
        const checks = await Promise.allSettled(
          validatingWithPr.map(async (t) => {
            const parsed = parsePrUrl(t.prUrl!);
            if (!parsed) return null;
            const merged = await isPrMerged(
              githubToken,
              parsed.owner,
              parsed.repo,
              parsed.number,
            );
            return merged ? t.id : null;
          }),
        );

        const mergedTaskIds = checks
          .filter(
            (r): r is PromiseFulfilledResult<string | null> =>
              r.status === "fulfilled",
          )
          .map((r) => r.value)
          .filter((id): id is string => id !== null);

        if (mergedTaskIds.length > 0) {
          log.info(
            { projectId, mergedTaskIds },
            "auto-completing tasks with merged PRs",
          );
          await db
            .update(tasks)
            .set({ status: "completed", completedAt: new Date() })
            .where(inArray(tasks.id, mergedTaskIds));

          for (const row of rows) {
            if (mergedTaskIds.includes(row.id)) {
              row.status = "completed";
              row.completedAt = new Date();
            }
          }
        }
      }
    } catch (err) {
      log.warn(
        { projectId, error: err instanceof Error ? err.message : "unknown" },
        "failed to check PR merge status (non-fatal)",
      );
    }
  }

  // Filter in JS if status param provided (drizzle chaining with dynamic where is verbose)
  const filtered = statusFilter
    ? rows.filter((t) => t.status === statusFilter)
    : rows;

  log.debug(
    { projectId, count: filtered.length, statusFilter },
    "tasks listed",
  );
  return Response.json({ tasks: filtered });
}

export async function action({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, org } = await requireAuth(request);
  const projectId = params.id;

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
      "task create: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify membership
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.userId, user.id),
        eq(orgMembers.organizationId, org.id),
      ),
    );

  if (!membership) {
    log.warn({ userId: user.id, orgId: org.id }, "task create: not a member");
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { prompt?: string; branch?: string; model?: string; type?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const branch = body.branch?.trim() || "feat";
  const model = body.model?.trim() || "claude-sonnet-4-20250514";

  const validTypes = ["task", "plan"];
  const type = body.type?.trim() || "task";
  if (!validTypes.includes(type)) {
    return Response.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      { status: 400 },
    );
  }

  const [task] = await db
    .insert(tasks)
    .values({
      projectId,
      prompt,
      branch,
      model,
      type,
      status: "ready",
      createdBy: user.id,
    })
    .returning();

  log.info(
    { userId: user.id, projectId, taskId: task.id, branch, model, type },
    "task created",
  );
  return Response.json({ task }, { status: 201 });
}
