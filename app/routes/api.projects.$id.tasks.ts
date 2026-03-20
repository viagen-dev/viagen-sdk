import { eq, and, desc, sql } from "drizzle-orm";
import { generateTaskTitle } from "~/lib/task-title.server";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, environments, tasks, orgMembers, users } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";

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
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    log.warn({ userId: user.id, projectId }, "project tasks list: project not found or not in org");
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  const rowsWithCreator = await db
    .select({
      task: tasks,
      creatorName: users.name,
      creatorAvatarUrl: users.avatarUrl,
      environmentName: environments.name,
      githubRepo: environments.githubRepo,
      vercelProjectId: environments.vercelProjectId,
      vercelProjectName: environments.vercelProjectName,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .innerJoin(environments, eq(tasks.environmentId, environments.id))
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt));

  const rows = rowsWithCreator.map((r) => ({
    ...r.task,
    creatorName: r.creatorName ?? null,
    creatorAvatarUrl: r.creatorAvatarUrl ?? null,
    environmentName: r.environmentName,
    projectName: project.name,
    taskPrefix: project.taskPrefix ?? null,
    githubRepo: r.githubRepo ?? null,
    vercelProjectId: r.vercelProjectId ?? null,
    vercelProjectName: r.vercelProjectName ?? null,
  }));

  const filtered = statusFilter ? rows.filter((t) => t.status === statusFilter) : rows;

  log.debug({ projectId, count: filtered.length, statusFilter }, "project tasks listed");
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
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    log.warn({ userId: user.id, projectId }, "project task create: project not found or not in org");
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify membership
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, user.id), eq(orgMembers.organizationId, org.id)));

  if (!membership) {
    log.warn({ userId: user.id, orgId: org.id }, "project task create: not a member");
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    prompt?: string;
    branch?: string;
    model?: string;
    type?: string;
    title?: string;
    environmentId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim() ?? "";
  const branch = body.branch?.trim() || "feat";
  const model = body.model?.trim() || "claude-sonnet-4-6";
  const title =
    body.title?.trim() ||
    (prompt ? await generateTaskTitle(org.id, prompt) : null) ||
    null;

  const validTypes = ["task", "plan"];
  const type = body.type?.trim() || "task";
  if (!validTypes.includes(type)) {
    return Response.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      { status: 400 },
    );
  }

  // Resolve environmentId — use provided one or fall back to any org env
  let resolvedEnvironmentId: string;

  if (body.environmentId) {
    const [env] = await db
      .select()
      .from(environments)
      .where(and(eq(environments.id, body.environmentId), eq(environments.organizationId, org.id)));
    if (!env) {
      log.warn({ userId: user.id, environmentId: body.environmentId }, "project task create: environment not found");
      return Response.json({ error: "Environment not found" }, { status: 404 });
    }
    resolvedEnvironmentId = env.id;
  } else {
    // Fall back to first environment in the org
    const envQuery = await db
      .select()
      .from(environments)
      .where(eq(environments.organizationId, org.id))
      .limit(1);

    if (envQuery.length === 0) {
      log.error({ orgId: org.id, projectId }, "project task create: no environments found in org");
      return Response.json({ error: "No environments found for this org" }, { status: 400 });
    }
    resolvedEnvironmentId = envQuery[0].id;
  }

  // Get next task number for this project
  const [{ max: maxNum }] = await db
    .select({ max: sql<number>`coalesce(max(${tasks.taskNumber}), 0)` })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));
  const taskNumber = (maxNum ?? 0) + 1;

  const [task] = await db
    .insert(tasks)
    .values({
      environmentId: resolvedEnvironmentId,
      projectId,
      title,
      prompt,
      branch,
      model,
      type,
      taskNumber,
      status: "ready",
      createdBy: user.id,
    })
    .returning();

  log.info(
    { userId: user.id, projectId, environmentId: resolvedEnvironmentId, taskId: task.id, taskNumber, branch, model, type },
    "project task created",
  );

  return Response.json(
    {
      task: {
        ...task,
        projectName: project.name,
        creatorName: user.name ?? null,
        creatorAvatarUrl: user.avatarUrl ?? null,
      },
    },
    { status: 201 },
  );
}
