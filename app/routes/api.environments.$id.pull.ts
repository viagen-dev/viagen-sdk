import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAllSecrets } from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { role, org } = await requireAuth(request);
  const id = params.id;

  if (!isAdminRole(role)) {
    log.warn({ environmentId: id, orgId: org.id }, "pull secrets: forbidden — admin role required");
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const [app] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, id), eq(environments.organizationId, org.id)));

  if (!app) {
    log.warn({ environmentId: id, orgId: org.id }, "pull secrets: environment not found");
    return Response.json({ error: "Environment not found" }, { status: 404 });
  }

  const resolved = await resolveAllSecrets(org.id, id);

  log.info(
    {
      environmentId: id,
      orgId: org.id,
      appCount: resolved.project.length,
      orgCount: resolved.org.length,
    },
    "pull secrets: resolved all secrets",
  );

  // Merge app-level and org-level secrets into a flat map.
  // App-level secrets take precedence over org-level secrets with the same key.
  const secrets: Record<string, string> = {};
  for (const s of resolved.org) {
    secrets[s.key] = s.value;
  }
  for (const s of resolved.project) {
    secrets[s.key] = s.value;
  }

  return Response.json({ secrets });
}
