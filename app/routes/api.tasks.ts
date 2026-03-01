import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, orgMembers, users } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, isPrMerged } from "~/lib/github.server";
import { sendTaskTimeoutEmail } from "~/lib/email.server";

// ── GET /api/tasks — List all tasks for the current org ───────────────────

export async function loader({ request }: { request: Request }) {
  const { user, org } = await requireAuth(request);

  log.debug(
    { userId: user.id, orgId: org.id },
    "team tasks list: fetching all tasks for org",
  );

  // Get all project IDs belonging to this org
  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, org.id));

  const projectIds = orgProjects.map((p) => p.id);

  if (projectIds.length === 0) {
    log.debug({ orgId: org.id }, "team tasks list: no projects in org, returning empty");
    return Response.json({ tasks: [] });
  }

  // Optional status filter
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam), 100) : 50;

  // Join tasks with users (creator) and projects (for context)
  const rowsWithContext = await db
    .select({
      task: tasks,
      creatorName: users.name,
      creatorAvatarUrl: users.avatarUrl,
      projectName: projects.name,
      githubRepo: projects.githubRepo,
      vercelProjectId: projects.vercelProjectId,
      vercelProjectName: projects.vercelProjectName,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(inArray(tasks.projectId, projectIds))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);

  // Flatten into task objects with context
  const rows = rowsWithContext.map((r) => ({
    ...r.task,
    creatorName: r.creatorName ?? null,
    creatorAvatarUrl: r.creatorAvatarUrl ?? null,
    projectName: r.projectName,
    githubRepo: r.githubRepo,
    vercelProjectId: r.vercelProjectId,
    vercelProjectName: r.vercelProjectName,
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
      { orgId: org.id, expiredTaskIds },
      "team tasks list: auto-timing-out tasks older than 40 minutes",
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
              projectName: row.projectName,
              projectId: row.projectId,
              taskId: row.id,
              taskPrompt: row.prompt,
            }).catch((err: unknown) =>
              log.error({ email: member.email, taskId: row.id, err }, "task timeout email failed"),
            );
          }
        }
        log.info(
          { orgId: org.id, expiredTaskIds, recipientCount: members.length },
          "task timeout emails dispatched",
        );
      } catch (err) {
        log.error({ orgId: org.id, err }, "failed to send task timeout notifications");
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
            { orgId: org.id, mergedTaskIds },
            "team tasks list: auto-completing tasks with merged PRs",
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
        { orgId: org.id, error: err instanceof Error ? err.message : "unknown" },
        "team tasks list: failed to check PR merge status (non-fatal)",
      );
    }
  }

  // Filter in JS if status param provided
  const filtered = statusFilter
    ? rows.filter((t) => t.status === statusFilter)
    : rows;

  log.debug(
    { orgId: org.id, count: filtered.length, statusFilter },
    "team tasks listed",
  );
  return Response.json({ tasks: filtered });
}

// ── POST /api/tasks — Create a task with find-or-create project logic ─────

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, org } = await requireAuth(request);

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
    log.warn(
      { userId: user.id, orgId: org.id },
      "team task create: not a member",
    );
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    prompt?: string;
    branch?: string;
    model?: string;
    githubRepo?: string;
    vercelProjectId?: string;
    vercelProjectName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    log.warn(
      { userId: user.id, orgId: org.id },
      "team task create: missing prompt",
    );
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const githubRepo = body.githubRepo?.trim();
  const vercelProjectId = body.vercelProjectId?.trim();
  const vercelProjectName = body.vercelProjectName?.trim();

  if (!githubRepo) {
    log.warn(
      { userId: user.id, orgId: org.id },
      "team task create: missing githubRepo",
    );
    return Response.json(
      { error: "GitHub repository is required" },
      { status: 400 },
    );
  }

  if (!vercelProjectId) {
    log.warn(
      { userId: user.id, orgId: org.id },
      "team task create: missing vercelProjectId",
    );
    return Response.json(
      { error: "Vercel project is required" },
      { status: 400 },
    );
  }

  const branch = body.branch?.trim() || `feat-${Math.random().toString(36).slice(2, 8)}`;
  const model = body.model?.trim() || "claude-sonnet-4-20250514";

  // ── Find or create a project for this repo + Vercel project combo ──

  log.info(
    {
      userId: user.id,
      orgId: org.id,
      githubRepo,
      vercelProjectId,
    },
    "team task create: looking up project for repo+vercel combo",
  );

  let projectId: string;

  const [existingProject] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, org.id),
        eq(projects.githubRepo, githubRepo),
        eq(projects.vercelProjectId, vercelProjectId),
      ),
    )
    .limit(1);

  if (existingProject) {
    projectId = existingProject.id;
    log.info(
      {
        userId: user.id,
        projectId,
        projectName: existingProject.name,
      },
      "team task create: found existing project",
    );
  } else {
    // Auto-create a project named after the repo
    // e.g. "owner/repo-name" -> "repo-name"
    const repoShortName = githubRepo.includes("/")
      ? githubRepo.split("/").pop()!
      : githubRepo;

    const projectName = repoShortName;

    const [newProject] = await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: projectName,
        githubRepo,
        vercelProjectId,
        vercelProjectName: vercelProjectName ?? null,
      })
      .returning();

    projectId = newProject.id;
    log.info(
      {
        userId: user.id,
        projectId,
        projectName,
        githubRepo,
        vercelProjectId,
      },
      "team task create: auto-created project for repo+vercel combo",
    );
  }

  // ── Create the task ──

  const [task] = await db
    .insert(tasks)
    .values({
      projectId,
      prompt,
      branch,
      model,
      status: "ready",
      createdBy: user.id,
    })
    .returning();

  log.info(
    {
      userId: user.id,
      orgId: org.id,
      projectId,
      taskId: task.id,
      branch,
      model,
      githubRepo,
      vercelProjectId,
    },
    "team task created",
  );

  // Return the task with project context so the UI can update immediately
  return Response.json(
    {
      task: {
        ...task,
        projectName: existingProject?.name ?? (githubRepo.includes("/") ? githubRepo.split("/").pop()! : githubRepo),
        githubRepo,
        vercelProjectId,
        vercelProjectName: vercelProjectName ?? existingProject?.vercelProjectName ?? null,
        creatorName: user.name ?? null,
        creatorAvatarUrl: user.avatarUrl ?? null,
      },
      projectId,
    },
    { status: 201 },
  );
}
