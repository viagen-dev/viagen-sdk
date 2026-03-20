/**
 * One-time migration: run 0016_projects_as_task_parent
 *
 * This migration was applied outside of drizzle-kit's journal, so we run it
 * directly here. It is safe to re-run — each statement is guarded or idempotent.
 *
 * Usage:  npx tsx scripts/migrate-0016.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

async function main() {
  console.log("Running migration 0016_projects_as_task_parent...\n");

  // Step 1: Add new columns to projects (skip if already exist)
  const newColumns: Array<{ name: string; ddl: string }> = [
    { name: "github_repo", ddl: 'ADD COLUMN "github_repo" varchar(255)' },
    {
      name: "vercel_project_id",
      ddl: 'ADD COLUMN "vercel_project_id" varchar(255)',
    },
    {
      name: "vercel_project_name",
      ddl: 'ADD COLUMN "vercel_project_name" varchar(255)',
    },
    { name: "vercel_org_id", ddl: 'ADD COLUMN "vercel_org_id" varchar(255)' },
    {
      name: "is_default",
      ddl: 'ADD COLUMN "is_default" boolean NOT NULL DEFAULT false',
    },
  ];

  for (const col of newColumns) {
    const exists = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = ${col.name}
    `);
    if (exists.rows.length > 0) {
      console.log(`  ✓ projects.${col.name} already exists — skipping`);
    } else {
      await db.execute(sql.raw(`ALTER TABLE "projects" ${col.ddl}`));
      console.log(`  ✓ Added projects.${col.name}`);
    }
  }

  // Step 2: Create a default "Unassigned" project for each org that has orphaned tasks
  const inserted = await db.execute(sql`
    INSERT INTO "projects" ("organization_id", "name", "is_default", "created_at", "updated_at")
    SELECT DISTINCT e."organization_id", 'No project', true, now(), now()
    FROM "tasks" t
    JOIN "environments" e ON e.id = t.environment_id
    WHERE t.project_id IS NULL
    ON CONFLICT DO NOTHING
    RETURNING id, organization_id
  `);
  console.log(
    `\n  ✓ Inserted ${inserted.rows.length} No project bucket(s) for orgs with orphaned tasks`,
  );

  // Also ensure every org that exists has an Unassigned project, even if it has no tasks yet
  const insertedAll = await db.execute(sql`
    INSERT INTO "projects" ("organization_id", "name", "is_default", "created_at", "updated_at")
    SELECT o.id, 'No project', true, now(), now()
    FROM "organizations" o
    WHERE NOT EXISTS (
      SELECT 1 FROM "projects" p
      WHERE p.organization_id = o.id AND p.is_default = true
    )
    RETURNING id, organization_id
  `);
  console.log(
    `  ✓ Inserted ${insertedAll.rows.length} No project bucket(s) for orgs with no default project`,
  );

  // Step 3: Back-fill orphaned tasks to their org's default project
  const backfilled = await db.execute(sql`
    UPDATE "tasks" t
    SET "project_id" = p.id
    FROM "environments" e
    JOIN "projects" p ON p.organization_id = e.organization_id AND p.is_default = true
    WHERE t.environment_id = e.id
      AND t.project_id IS NULL
    RETURNING t.id
  `);
  console.log(
    `  ✓ Back-filled ${backfilled.rows.length} orphaned task(s) to their No project bucket`,
  );

  // Step 4: Check if any tasks still have a null project_id before adding NOT NULL constraint
  const nullCheck = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM "tasks" WHERE project_id IS NULL
  `);
  const nullCount = Number((nullCheck.rows[0] as { cnt: string }).cnt);

  if (nullCount > 0) {
    console.error(
      `\n  ✗ ${nullCount} task(s) still have NULL project_id — cannot add NOT NULL constraint`,
    );
    console.error("    Fix these rows manually before re-running.");
    process.exit(1);
  }

  // Step 5: Make project_id NOT NULL (skip if already constrained)
  const colNullable = await db.execute(sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  `);
  const isNullable =
    (colNullable.rows[0] as { is_nullable: string } | undefined)
      ?.is_nullable === "YES";

  if (!isNullable) {
    console.log(
      "\n  ✓ tasks.project_id is already NOT NULL — skipping constraint change",
    );
  } else {
    await db.execute(
      sql`ALTER TABLE "tasks" ALTER COLUMN "project_id" SET NOT NULL`,
    );
    console.log("\n  ✓ tasks.project_id is now NOT NULL");
  }

  console.log("\nMigration 0016 complete ✓");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
