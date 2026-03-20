import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  if (request.method === "PATCH") {
    const { role, org } = await requireAuth(request);
    if (!isAdminRole(role)) {
      return Response.json(
        { error: "Admin role required to update projects" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if ("name" in body) {
      if (
        !body.name ||
        typeof body.name !== "string" ||
        body.name.trim().length === 0
      ) {
        return Response.json(
          { error: "Project name cannot be empty" },
          { status: 400 },
        );
      }
      updates.name = body.name.trim();
    }
    if ("taskPrefix" in body)
      updates.taskPrefix = body.taskPrefix?.trim() || null;
    if ("githubRepo" in body)
      updates.githubRepo = body.githubRepo?.trim() || null;
    if ("vercelProjectId" in body)
      updates.vercelProjectId = body.vercelProjectId?.trim() || null;
    if ("vercelProjectName" in body)
      updates.vercelProjectName = body.vercelProjectName?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No updates provided" }, { status: 400 });
    }

    const [project] = await db
      .update(projects)
      .set(updates)
      .where(
        and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
      )
      .returning();

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    log.info(
      { orgId: org.id, projectId: params.id, updates: Object.keys(updates) },
      "project updated",
    );
    return Response.json({ project });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
