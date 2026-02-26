import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, workspaces, orgMembers } from "~/lib/db/schema";
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

  let query = db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt));

  const rows = await query;

  // Running tasks whose workspace is expired or missing → back to "validating"
  const runningTasks = rows.filter((t) => t.status === "running");

  if (runningTasks.length > 0) {
    const runningWithWs = runningTasks.filter((t) => t.workspaceId);
    const runningWithoutWs = runningTasks.filter((t) => !t.workspaceId);

    // Check which workspaces are still active
    let expiredWsTaskIds: string[] = [];
    if (runningWithWs.length > 0) {
      const wsIds = runningWithWs.map((t) => t.workspaceId!);
      const activeWs = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(inArray(workspaces.id, wsIds));
      const activeWsIds = new Set(activeWs.map((w) => w.id));

      expiredWsTaskIds = runningWithWs
        .filter((t) => !activeWsIds.has(t.workspaceId!))
        .map((t) => t.id);
    }

    const staleTaskIds = [
      ...expiredWsTaskIds,
      ...runningWithoutWs.map((t) => t.id),
    ];

    if (staleTaskIds.length > 0) {
      log.info(
        { projectId, staleTaskIds },
        "clearing running status on tasks with expired/missing workspaces",
      );
      await db
        .update(tasks)
        .set({ status: "validating" })
        .where(inArray(tasks.id, staleTaskIds));

      for (const row of rows) {
        if (staleTaskIds.includes(row.id)) {
          row.status = "validating";
        }
      }
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

  let body: { prompt?: string; branch?: string; model?: string };
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
    { userId: user.id, projectId, taskId: task.id, branch, model },
    "task created",
  );
  return Response.json({ task }, { status: 201 });
}
