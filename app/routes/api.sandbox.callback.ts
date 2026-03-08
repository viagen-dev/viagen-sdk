import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/lib/db/index.server";
import { tasks, projects, orgMembers, users } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";
import { sendTaskReadyEmail } from "~/lib/email.server";

const VALID_TASK_TYPES = ["task", "plan"] as const;

export async function loader() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Extract bearer token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn("sandbox callback: missing or malformed Authorization header");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);

  // Parse body
  let body: {
    taskId?: string;
    action?: string;
    projectId?: string;
    status?: string;
    prUrl?: string;
    prReviewStatus?: string;
    result?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    prompt?: string;
    branch?: string;
    type?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Handle task CRUD actions (list_tasks, get_task, create_task)
  const crudAction = body.action;
  if (
    crudAction === "list_tasks" ||
    crudAction === "get_task" ||
    crudAction === "create_task"
  ) {
    if (!body.projectId) {
      return Response.json({ error: "projectId is required" }, { status: 400 });
    }

    // Auth: find any task in the project with a matching callback token
    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, body.projectId));

    const authTask = projectTasks.find(
      (t) => t.callbackTokenHash === tokenHash,
    );
    if (!authTask) {
      log.warn(
        { projectId: body.projectId, action: crudAction },
        "sandbox callback: no matching token for project",
      );
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (crudAction === "list_tasks") {
      const sorted = [...projectTasks].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const filtered = body.status
        ? sorted.filter((t) => t.status === body.status)
        : sorted;
      log.debug(
        { projectId: body.projectId, count: filtered.length },
        "sandbox callback: tasks listed",
      );
      return Response.json({ tasks: filtered });
    }

    if (crudAction === "get_task") {
      if (!body.taskId) {
        return Response.json({ error: "taskId is required" }, { status: 400 });
      }
      const task = projectTasks.find((t) => t.id === body.taskId);
      if (!task) {
        log.warn(
          { projectId: body.projectId, taskId: body.taskId },
          "sandbox callback: task not found",
        );
        return Response.json({ error: "Task not found" }, { status: 404 });
      }
      return Response.json({ task });
    }

    if (crudAction === "create_task") {
      const prompt = body.prompt?.trim();
      if (!prompt) {
        return Response.json({ error: "prompt is required" }, { status: 400 });
      }
      const branch = body.branch?.trim() || "feat";
      const type = body.type?.trim() || "task";
      if (!VALID_TASK_TYPES.includes(type as (typeof VALID_TASK_TYPES)[number])) {
        return Response.json(
          { error: `type must be one of: ${VALID_TASK_TYPES.join(", ")}` },
          { status: 400 },
        );
      }

      const maxTaskNumber = Math.max(
        0,
        ...projectTasks.map((t) => t.taskNumber ?? 0),
      );
      const taskNumber = maxTaskNumber + 1;

      const [task] = await db
        .insert(tasks)
        .values({
          projectId: body.projectId,
          prompt,
          branch,
          type,
          taskNumber,
          status: "ready",
          createdBy: authTask.createdBy,
          model: "claude-sonnet-4-6",
        })
        .returning();

      log.info(
        { projectId: body.projectId, taskId: task.id, taskNumber },
        "sandbox callback: task created",
      );
      return Response.json({ task }, { status: 201 });
    }
  }

  // Existing update_task behavior (no action field or action === "update_task")

  // Validate required fields
  if (!body.taskId) {
    log.warn("sandbox callback: missing taskId");
    return Response.json({ error: "taskId is required" }, { status: 400 });
  }

  const validStatuses = ["validating", "completed"];
  if (!body.status || !validStatuses.includes(body.status)) {
    log.warn({ status: body.status }, "sandbox callback: invalid status");
    return Response.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 },
    );
  }

  // Look up the task
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, body.taskId));

  if (!task) {
    log.warn({ taskId: body.taskId }, "sandbox callback: task not found");
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // Validate the callback token
  if (!task.callbackTokenHash) {
    log.warn(
      { taskId: body.taskId },
      "sandbox callback: task has no callback token",
    );
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (tokenHash !== task.callbackTokenHash) {
    log.warn({ taskId: body.taskId }, "sandbox callback: token mismatch");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prevent double-completion (idempotent) — also reject if task already timed out
  if (task.status === "completed" || task.status === "timed_out") {
    log.info(
      { taskId: body.taskId, currentStatus: task.status },
      "sandbox callback: task already finalized, ignoring",
    );
    return Response.json({ task });
  }

  // Build update payload
  const now = new Date();
  const updates: Record<string, unknown> = {
    status: body.status,
  };

  // Only consume the callback token on completion — review status
  // needs the token to remain valid so the agent can report completion later.
  if (body.status === "completed") {
    updates.callbackTokenHash = null;
  }

  // Only set completedAt when actually completed, not when entering review
  if (body.status === "completed") {
    updates.completedAt = now;
  }

  // Auto-compute duration from startedAt
  if (task.startedAt) {
    updates.durationMs = now.getTime() - new Date(task.startedAt).getTime();
  }

  if (body.prUrl) updates.prUrl = body.prUrl;
  if (body.result) updates.result = body.result;
  if (body.error) updates.error = body.error;
  if (body.inputTokens != null) updates.inputTokens = body.inputTokens;
  if (body.outputTokens != null) updates.outputTokens = body.outputTokens;
  if (body.prReviewStatus && ["pass", "flag", "fail"].includes(body.prReviewStatus)) {
    updates.prReviewStatus = body.prReviewStatus;
  }

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, body.taskId))
    .returning();

  log.info(
    {
      taskId: body.taskId,
      projectId: task.projectId,
      status: body.status,
      prUrl: body.prUrl ?? null,
    },
    "sandbox callback: task updated successfully",
  );

  // Notify org members when task is ready for review
  if (body.status === "validating") {
    (async () => {
      try {
        const [project] = await db
          .select({ name: projects.name, organizationId: projects.organizationId })
          .from(projects)
          .where(eq(projects.id, task.projectId));

        if (!project) return;

        const members = await db
          .select({ email: users.email })
          .from(orgMembers)
          .innerJoin(users, eq(orgMembers.userId, users.id))
          .where(eq(orgMembers.organizationId, project.organizationId));

        for (const member of members) {
          sendTaskReadyEmail({
            to: member.email,
            projectName: project.name,
            projectId: task.projectId,
            taskId: updated.id,
            taskPrompt: task.prompt,
            prUrl: body.prUrl,
          }).catch((err: unknown) =>
            log.error({ email: member.email, taskId: updated.id, err }, "task ready email failed"),
          );
        }

        log.info(
          { taskId: updated.id, recipientCount: members.length },
          "task ready emails dispatched",
        );
      } catch (err) {
        log.error({ taskId: updated.id, err }, "failed to send task ready notifications");
      }
    })();
  }

  return Response.json({ task: updated });
}
