import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);

  const result = await db
    .select()
    .from(environments)
    .where(eq(environments.organizationId, org.id))
    .orderBy(environments.createdAt);

  return Response.json({ environments: result });
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { role, org } = await requireAuth(request);
  if (!isAdminRole(role)) {
    return Response.json(
      { error: "Admin role required to create environments" },
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
      { error: "App name is required" },
      { status: 400 },
    );
  }

  const [app] = await db
    .insert(environments)
    .values({
      organizationId: org.id,
      name: body.name.trim(),
      vercelProjectId: body.vercelProjectId ?? null,
      vercelProjectName: body.vercelProjectName ?? null,
      vercelOrgId: body.vercelOrgId ?? null,
      githubRepo: body.githubRepo ?? null,
      templateId: body.templateId ?? null,
      ...(body.kind && { kind: body.kind }),
      ...(body.domain !== undefined && { domain: body.domain ?? null }),
    })
    .returning();

  log.info(
    { orgId: org.id, environmentId: app.id, appName: app.name },
    "app created",
  );
  return Response.json({ environment: app }, { status: 201 });
}
