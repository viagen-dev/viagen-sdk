/**
 * One-time migration: rename all default "Unassigned" projects to "No project"
 *
 * Usage:  npx tsx scripts/rename-unassigned-projects.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

async function main() {
  console.log('Renaming default "Unassigned" projects to "No project"...\n');

  const result = await db.execute(sql`
    UPDATE "projects"
    SET "name" = 'No project'
    WHERE "is_default" = true
      AND "name" = 'Unassigned'
    RETURNING id, organization_id
  `);

  if (result.rows.length === 0) {
    console.log('  ✓ No "Unassigned" default projects found — nothing to do.');
  } else {
    console.log(
      `  ✓ Renamed ${result.rows.length} project(s) to "No project":`,
    );
    for (const row of result.rows as { id: string; organization_id: string }[]) {
      console.log(`    - project ${row.id} (org ${row.organization_id})`);
    }
  }

  console.log("\nDone ✓");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
