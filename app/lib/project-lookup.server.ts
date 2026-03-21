import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Look up a project by UUID or slug within an org.
 * Returns the project record or null.
 */
export async function findProject(orgId: string, idOrSlug: string) {
  const isUuid = UUID_RE.test(idOrSlug);

  const conditions = isUuid
    ? and(eq(projects.id, idOrSlug), eq(projects.organizationId, orgId))
    : and(eq(projects.slug, idOrSlug), eq(projects.organizationId, orgId));

  const [project] = await db
    .select()
    .from(projects)
    .where(conditions);

  // Fallback: if slug lookup failed, try as UUID anyway (handles edge cases)
  if (!project && !isUuid) {
    const [byId] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, idOrSlug), eq(projects.organizationId, orgId)));
    return byId ?? null;
  }

  return project ?? null;
}
