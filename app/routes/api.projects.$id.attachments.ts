import { put, del } from "@vercel/blob";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, projectAttachments } from "~/lib/db/schema";
import { log } from "~/lib/logger.server";
import { findProject } from "~/lib/project-lookup.server";

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function loader({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const { user, org } = await requireAuth(request);

  log.debug(
    { userId: user.id, projectIdOrSlug: params.id },
    "project attachments: listing",
  );

  const project = await findProject(org.id, params.id);
  if (!project) {
    log.warn(
      { userId: user.id, orgId: org.id, projectIdOrSlug: params.id },
      "project attachments list: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  const projectId = project.id;

  const attachments = await db
    .select()
    .from(projectAttachments)
    .where(eq(projectAttachments.projectId, projectId));

  log.debug(
    { userId: user.id, projectId, count: attachments.length },
    "project attachments listed",
  );

  return Response.json({ attachments });
}

export async function action({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const { user, org } = await requireAuth(request);

  if (request.method !== "POST" && request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  log.debug(
    { userId: user.id, orgId: org.id, projectIdOrSlug: params.id, method: request.method },
    "project attachments: action called",
  );

  const project = await findProject(org.id, params.id);
  if (!project) {
    log.warn(
      { userId: user.id, orgId: org.id, projectIdOrSlug: params.id },
      "project attachments action: project not found or not in org",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  const projectId = project.id;

  // ── DELETE ──────────────────────────────────────────
  if (request.method === "DELETE") {
    let body: { attachmentId?: string } = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.attachmentId) {
      log.warn(
        { userId: user.id, projectId },
        "project attachments delete: missing attachmentId",
      );
      return Response.json(
        { error: "attachmentId is required" },
        { status: 400 },
      );
    }

    const [attachment] = await db
      .select()
      .from(projectAttachments)
      .where(
        and(
          eq(projectAttachments.id, body.attachmentId),
          eq(projectAttachments.projectId, projectId),
        ),
      );

    if (!attachment) {
      log.warn(
        {
          userId: user.id,
          projectId,
          attachmentId: body.attachmentId,
        },
        "project attachments delete: attachment not found",
      );
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    try {
      await del(attachment.blobUrl);
      log.debug(
        { attachmentId: attachment.id, blobUrl: attachment.blobUrl },
        "project attachment: blob deleted from storage",
      );
    } catch (err) {
      log.warn(
        {
          attachmentId: attachment.id,
          blobUrl: attachment.blobUrl,
          err,
        },
        "project attachments delete: blob delete failed (may already be gone)",
      );
    }

    await db
      .delete(projectAttachments)
      .where(eq(projectAttachments.id, attachment.id));

    log.info(
      {
        userId: user.id,
        projectId,
        attachmentId: attachment.id,
        filename: attachment.filename,
      },
      "project attachment deleted",
    );

    return Response.json({ success: true });
  }

  // ── POST (upload) ──────────────────────────────────
  const existing = await db
    .select({ id: projectAttachments.id })
    .from(projectAttachments)
    .where(eq(projectAttachments.projectId, projectId));

  if (existing.length >= MAX_ATTACHMENTS) {
    log.warn(
      { userId: user.id, projectId, count: existing.length, max: MAX_ATTACHMENTS },
      "project attachments upload: max attachments reached",
    );
    return Response.json(
      { error: `Maximum ${MAX_ATTACHMENTS} attachments per project` },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    log.warn(
      { userId: user.id, projectId, err },
      "project attachments upload: failed to parse form data",
    );
    return Response.json(
      { error: "Failed to parse form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    log.warn(
      { userId: user.id, projectId },
      "project attachments upload: missing file field",
    );
    return Response.json(
      { error: "file field is required" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    log.warn(
      { userId: user.id, projectId, filename: file.name, size: file.size, maxSize: MAX_FILE_SIZE },
      "project attachments upload: file too large",
    );
    return Response.json(
      {
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      },
      { status: 400 },
    );
  }

  const pathname = `projects/${projectId}/${Date.now()}-${file.name}`;

  log.info(
    {
      userId: user.id,
      projectId,
      filename: file.name,
      size: file.size,
      contentType: file.type,
      pathname,
    },
    "project attachment: uploading to blob storage",
  );

  let blob: { url: string };
  try {
    blob = await put(pathname, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
    });
  } catch (err) {
    log.error(
      { userId: user.id, projectId, filename: file.name, err },
      "project attachment: blob upload failed",
    );
    return Response.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 },
    );
  }

  const [attachment] = await db
    .insert(projectAttachments)
    .values({
      projectId,
      filename: file.name,
      blobUrl: blob.url,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    })
    .returning();

  log.info(
    {
      userId: user.id,
      projectId,
      attachmentId: attachment.id,
      filename: file.name,
      blobUrl: blob.url,
      sizeBytes: file.size,
    },
    "project attachment uploaded successfully",
  );

  return Response.json({ attachment }, { status: 201 });
}
