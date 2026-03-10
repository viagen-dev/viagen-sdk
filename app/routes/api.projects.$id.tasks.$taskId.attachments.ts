import { put, del } from "@vercel/blob";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks, taskAttachments } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";

const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function loader({
  params,
  request,
}: {
  params: { id: string; taskId: string };
  request: Request;
}) {
  const { user, org } = await requireAuth(request);
  const { id: projectId, taskId } = params;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const attachments = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId));

  return Response.json({ attachments });
}

export async function action({
  params,
  request,
}: {
  params: { id: string; taskId: string };
  request: Request;
}) {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, org } = await requireAuth(request);
  const { id: projectId, taskId } = params;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [task] = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // Only allow attachments on tasks that haven't started yet
  if (task.status !== "ready") {
    return Response.json(
      { error: "Can only modify attachments on tasks in ready status" },
      { status: 400 },
    );
  }

  // ── DELETE ──────────────────────────────────────────
  if (request.method === "DELETE") {
    const body = await request.json().catch(() => ({}));
    if (!body.attachmentId) {
      return Response.json({ error: "attachmentId is required" }, { status: 400 });
    }

    const [attachment] = await db
      .select()
      .from(taskAttachments)
      .where(
        and(
          eq(taskAttachments.id, body.attachmentId),
          eq(taskAttachments.taskId, taskId),
        ),
      );

    if (!attachment) {
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Delete from Vercel Blob
    try {
      await del(attachment.blobUrl);
    } catch (err) {
      log.warn(
        { attachmentId: attachment.id, blobUrl: attachment.blobUrl, err },
        "blob delete failed (may already be gone)",
      );
    }

    await db.delete(taskAttachments).where(eq(taskAttachments.id, attachment.id));
    log.info(
      { taskId, attachmentId: attachment.id, filename: attachment.filename },
      "attachment deleted",
    );

    return Response.json({ success: true });
  }

  // ── POST (upload) ──────────────────────────────────
  const existing = await db
    .select({ id: taskAttachments.id })
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId));

  if (existing.length >= MAX_ATTACHMENTS) {
    return Response.json(
      { error: `Maximum ${MAX_ATTACHMENTS} attachments per task` },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "file field is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
      { status: 400 },
    );
  }

  // Check total count including this upload
  if (existing.length + 1 > MAX_ATTACHMENTS) {
    return Response.json(
      { error: `Maximum ${MAX_ATTACHMENTS} attachments per task` },
      { status: 400 },
    );
  }

  const pathname = `tasks/${taskId}/${file.name}`;

  log.info(
    { taskId, filename: file.name, size: file.size, contentType: file.type },
    "uploading task attachment",
  );

  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  const [attachment] = await db
    .insert(taskAttachments)
    .values({
      taskId,
      filename: file.name,
      blobUrl: blob.url,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    })
    .returning();

  log.info(
    { taskId, attachmentId: attachment.id, filename: file.name, blobUrl: blob.url },
    "attachment uploaded",
  );

  return Response.json({ attachment }, { status: 201 });
}
