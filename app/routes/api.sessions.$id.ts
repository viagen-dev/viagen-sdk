import { Sandbox } from "@vercel/sandbox";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { workspaces, environments, tasks } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org } = await requireAuth(request);
  const { id } = params;

  log.info({ workspaceId: id, orgId: org.id }, "session get: looking up workspace");

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  if (!ws) {
    log.warn({ workspaceId: id }, "session get: workspace not found");
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [env] = await db
    .select({ organizationId: environments.organizationId, name: environments.name })
    .from(environments)
    .where(eq(environments.id, ws.environmentId));

  if (!env || env.organizationId !== org.id) {
    log.warn({ workspaceId: id, orgId: org.id }, "session get: org mismatch or env not found");
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  log.info({ workspaceId: id, orgId: org.id }, "session get: fetched successfully");
  return Response.json({ session: { ...ws, environmentName: env.name } });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org } = await requireAuth(request);
  const { id } = params;

  log.info({ workspaceId: id, orgId: org.id, method: request.method }, "session action: received");

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  if (!ws) {
    log.warn({ workspaceId: id }, "session action: workspace not found");
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [env] = await db
    .select({ organizationId: environments.organizationId })
    .from(environments)
    .where(eq(environments.id, ws.environmentId));

  if (!env || env.organizationId !== org.id) {
    log.warn({ workspaceId: id, orgId: org.id }, "session action: org mismatch or env not found");
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // ── PATCH: update name / projectId ──────────────────────────────────
  if (request.method === "PATCH") {
    let body: { name?: string; projectId?: string | null };
    try {
      body = await request.json();
    } catch {
      log.warn({ workspaceId: id }, "session patch: invalid JSON body");
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name.trim() || null;
    if ("projectId" in body) updates.projectId = body.projectId ?? null;

    if (Object.keys(updates).length === 0) {
      log.warn({ workspaceId: id }, "session patch: no fields provided to update");
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, id))
      .returning();

    log.info({ workspaceId: id, updates }, "session patch: updated successfully");
    return Response.json({ session: updated });
  }

  // ── DELETE: stop sandbox + remove workspace row ──────────────────────
  if (request.method === "DELETE") {
    log.info({ workspaceId: id, sandboxId: ws.sandboxId }, "session delete: stopping sandbox");

    try {
      const sandbox = await Sandbox.get({ sandboxId: ws.sandboxId });
      await sandbox.stop();
      log.info({ workspaceId: id, sandboxId: ws.sandboxId }, "session delete: sandbox stopped");
    } catch (err) {
      log.warn(
        { workspaceId: id, sandboxId: ws.sandboxId, err },
        "session delete: sandbox stop failed (may already be stopped)",
      );
    }

    await db.delete(workspaces).where(eq(workspaces.id, id));
    log.info({ workspaceId: id }, "session delete: workspace row removed");

    // If workspace was linked to a running task, revert it to validating
    if (ws.taskId) {
      const [linkedTask] = await db
        .select({ id: tasks.id, status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, ws.taskId));

      if (linkedTask && linkedTask.status === "running") {
        await db
          .update(tasks)
          .set({ status: "validating", workspaceId: null })
          .where(eq(tasks.id, linkedTask.id));
        log.info(
          { taskId: linkedTask.id, workspaceId: id },
          "session delete: task reverted to validating",
        );
      }
    }

    log.info({ workspaceId: id }, "session delete: completed successfully");
    return Response.json({ success: true });
  }

  log.warn({ workspaceId: id, method: request.method }, "session action: method not allowed");
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
