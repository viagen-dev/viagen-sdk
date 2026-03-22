import { eq, sql } from "drizzle-orm";
import { db } from "~/lib/db/index.server";
import { tasks, projects } from "~/lib/db/schema";

/**
 * Get the next org-global monotonic task number.
 * Task numbers are scoped to the organization, not the project,
 * so tasks can move between projects without conflicts.
 */
export async function nextTaskNumber(orgId: string): Promise<number> {
  const [{ max: maxNum }] = await db
    .select({ max: sql<number>`coalesce(max(${tasks.taskNumber}), 0)` })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(projects.organizationId, orgId));

  return (maxNum ?? 0) + 1;
}
