/**
 * One-time backfill: create a Project for each Environment,
 * copying the name and taskPrefix. Then link all tasks in that
 * environment to the new project.
 *
 * Usage:  npx tsx scripts/backfill-projects.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import {
  environments,
  projects,
  tasks,
} from "../app/lib/db/schema";

const db = drizzle(process.env.DATABASE_URL!);

async function main() {
  const allEnvs = await db.select().from(environments);
  console.log(`Found ${allEnvs.length} environments to backfill`);

  for (const env of allEnvs) {
    // Create a project mirroring this environment
    const [project] = await db
      .insert(projects)
      .values({
        organizationId: env.organizationId,
        name: env.name,
        taskPrefix: env.taskPrefix,
      })
      .returning();

    // Link all tasks in this environment to the new project
    const result = await db
      .update(tasks)
      .set({ projectId: project.id })
      .where(eq(tasks.environmentId, env.id));

    console.log(
      `  env "${env.name}" (${env.id}) → project ${project.id} — tasks updated`,
    );
  }

  console.log("Done");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
