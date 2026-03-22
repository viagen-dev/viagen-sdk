import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, asc, inArray } from "drizzle-orm";
import { tasks, projects, organizations } from "../app/lib/db/schema";

const db = drizzle(process.env.DATABASE_URL!);

/**
 * One-time backfill: re-number all tasks per org with a monotonic counter.
 * Tasks are ordered by createdAt so the numbering is chronological.
 */
async function main() {
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);

  for (const org of orgs) {
    // Get all tasks for this org via projects
    const orgProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, org.id));

    const projectIds = orgProjects.map((p) => p.id);
    if (projectIds.length === 0) {
      console.log(`Org "${org.name}" (${org.id}): no projects, skipping`);
      continue;
    }

    // Fetch all tasks for these projects, ordered by creation date
    const allTasks = await db
      .select({ id: tasks.id, taskNumber: tasks.taskNumber, projectId: tasks.projectId })
      .from(tasks)
      .where(
        inArray(tasks.projectId, projectIds),
      )
      .orderBy(asc(tasks.createdAt));

    console.log(`Org "${org.name}" (${org.id}): ${allTasks.length} tasks to renumber`);

    for (let i = 0; i < allTasks.length; i++) {
      const newNumber = i + 1;
      const task = allTasks[i];
      if (task.taskNumber === newNumber) continue;

      await db
        .update(tasks)
        .set({ taskNumber: newNumber })
        .where(eq(tasks.id, task.id));

      console.log(`  Task ${task.id}: ${task.taskNumber ?? "null"} -> ${newNumber}`);
    }
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
