import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id))
    .orderBy(projects.createdAt);

  log.debug({ orgId: org.id, count: result.length }, "projects listed");
  return Response.json({ projects: result });
}

export async function action({ request }: { request: Request }) {
  const method = request.method;

  if (method === "POST") return handleCreate(request);
  if (method === "DELETE") return handleDelete(request);

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

async function handleCreate(request: Request) {
  const { role, org } = await requireAuth(request);
  if (!isAdminRole(role)) {
    return Response.json(
      { error: "Admin role required to create projects" },
      { status: 403 },
    );
  }

  const body = await request.json();

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    return Response.json(
      { error: "Project name is required" },
      { status: 400 },
    );
  }

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      name: body.name.trim(),
      taskPrefix: body.taskPrefix ?? null,
      githubRepo: body.githubRepo?.trim() ?? null,
      vercelProjectId: body.vercelProjectId?.trim() ?? null,
      vercelProjectName: body.vercelProjectName?.trim() ?? null,
      vercelOrgId: body.vercelOrgId?.trim() ?? null,
      isDefault: false,
    })
    .returning();

  log.info(
    { orgId: org.id, projectId: project.id, projectName: project.name },
    "project created",
  );
  return Response.json({ project }, { status: 201 });
}

async function handleDelete(request: Request) {
  const { role, org } = await requireAuth(request);
  if (!isAdminRole(role)) {
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  let body: { id?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* no body */
  }

  if (!body.id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.isDefault) {
    log.warn(
      { orgId: org.id, projectId: project.id },
      "delete project: refused — cannot delete default Unassigned project",
    );
    return Response.json(
      { error: "Cannot delete the default Unassigned project" },
      { status: 400 },
    );
  }

  await db.delete(projects).where(eq(projects.id, project.id));

  log.info({ orgId: org.id, projectId: project.id }, "project deleted");
  return Response.json({ success: true });
}
