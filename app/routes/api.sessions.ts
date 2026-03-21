import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { workspaces, environments, projects } from "~/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { log } from "~/lib/logger.server";
import { generateSessionName } from "~/lib/session-name.server";

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);
  const url = new URL(request.url);
  const filterProjectId = url.searchParams.get("projectId");
  const filterEnvId = url.searchParams.get("environmentId");

  log.info(
    { orgId: org.id, filterProjectId, filterEnvId },
    "sessions list: fetching",
  );

  // Get all environments for this org
  const orgEnvs = await db
    .select({ id: environments.id, name: environments.name })
    .from(environments)
    .where(eq(environments.organizationId, org.id));

  if (orgEnvs.length === 0) {
    log.info({ orgId: org.id }, "sessions list: org has no environments");
    return Response.json({ sessions: [] });
  }

  const envIds = orgEnvs.map((e) => e.id);
  const envMap = Object.fromEntries(orgEnvs.map((e) => [e.id, e.name]));

  // Build where conditions
  const conditions: ReturnType<typeof eq>[] = [
    inArray(workspaces.environmentId, envIds),
  ];
  if (filterEnvId) {
    conditions.push(eq(workspaces.environmentId, filterEnvId));
  }
  if (filterProjectId) {
    conditions.push(eq(workspaces.projectId, filterProjectId));
  }

  const rows = await db
    .select()
    .from(workspaces)
    .where(and(...conditions))
    .orderBy(workspaces.createdAt);

  // Fetch project names for rows that have a projectId
  const projectIds = [
    ...new Set(rows.map((r) => r.projectId).filter(Boolean)),
  ] as string[];
  const projectMap: Record<string, string> = {};
  if (projectIds.length > 0) {
    const projRows = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, projectIds));
    for (const p of projRows) projectMap[p.id] = p.name;
  }

  const sessions = rows.map((ws) => ({
    ...ws,
    environmentName: envMap[ws.environmentId] ?? null,
    projectName: ws.projectId ? (projectMap[ws.projectId] ?? null) : null,
  }));

  log.info(
    { orgId: org.id, count: sessions.length },
    "sessions list: returned",
  );
  return Response.json({ sessions });
}

export async function action({ request }: { request: Request }) {
  const { org } = await requireAuth(request);

  if (request.method !== "POST") {
    log.warn({ method: request.method }, "sessions action: method not allowed");
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { workspaceId?: string };
  try {
    body = await request.json();
  } catch {
    log.warn({ orgId: org.id }, "sessions name backfill: invalid JSON body");
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.workspaceId) {
    log.warn({ orgId: org.id }, "sessions name backfill: workspaceId missing");
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }

  log.info(
    { orgId: org.id, workspaceId: body.workspaceId },
    "sessions name backfill: looking up workspace",
  );

  // Verify workspace belongs to this org
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, body.workspaceId));

  if (!ws) {
    log.warn(
      { workspaceId: body.workspaceId },
      "sessions name backfill: workspace not found",
    );
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [env] = await db
    .select({ organizationId: environments.organizationId })
    .from(environments)
    .where(eq(environments.id, ws.environmentId));

  if (!env || env.organizationId !== org.id) {
    log.warn(
      { workspaceId: ws.id, envId: ws.environmentId, orgId: org.id },
      "sessions name backfill: workspace does not belong to org",
    );
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // If name already set, return as-is
  if (ws.name) {
    log.debug(
      { workspaceId: ws.id, name: ws.name },
      "sessions name backfill: already named, skipping",
    );
    return Response.json({ workspace: ws });
  }

  log.info(
    { workspaceId: ws.id, branch: ws.branch },
    "sessions name backfill: generating name",
  );

  const name = await generateSessionName(org.id, ws.branch);

  if (!name) {
    log.warn(
      { workspaceId: ws.id },
      "sessions name backfill: could not generate name",
    );
    return Response.json({ workspace: ws });
  }

  const [updated] = await db
    .update(workspaces)
    .set({ name })
    .where(eq(workspaces.id, ws.id))
    .returning();

  log.info(
    { workspaceId: ws.id, name },
    "sessions name backfill: name saved",
  );
  return Response.json({ workspace: updated });
}
