import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/lib/db/index.server";
import { tasks } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";

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
    status?: string;
    prUrl?: string;
    result?: string;
    error?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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

  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (tokenHash !== task.callbackTokenHash) {
    log.warn({ taskId: body.taskId }, "sandbox callback: token mismatch");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prevent double-completion (idempotent)
  if (task.status === "completed") {
    log.info(
      { taskId: body.taskId, currentStatus: task.status },
      "sandbox callback: task already finalized, ignoring",
    );
    return Response.json({ task });
  }

  // Build update payload
  const updates: Record<string, unknown> = {
    status: body.status,
    completedAt: new Date(),
    callbackTokenHash: null, // one-time use — consume the token
  };

  if (body.prUrl) updates.prUrl = body.prUrl;
  if (body.result) updates.result = body.result;
  if (body.error) updates.error = body.error;

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

  return Response.json({ task: updated });
}
