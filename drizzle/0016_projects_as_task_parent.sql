-- Step 1: Add github_repo + vercel fields to projects so they can own environment context
ALTER TABLE "projects" ADD COLUMN "github_repo" varchar(255);
ALTER TABLE "projects" ADD COLUMN "vercel_project_id" varchar(255);
ALTER TABLE "projects" ADD COLUMN "vercel_project_name" varchar(255);
ALTER TABLE "projects" ADD COLUMN "vercel_org_id" varchar(255);
ALTER TABLE "projects" ADD COLUMN "is_default" boolean NOT NULL DEFAULT false;

-- Step 2: Create a default "Unassigned" project for each existing org that has tasks
INSERT INTO "projects" ("organization_id", "name", "is_default", "created_at", "updated_at")
SELECT DISTINCT e."organization_id", 'Unassigned', true, now(), now()
FROM "tasks" t
JOIN "environments" e ON e.id = t.environment_id
WHERE t.project_id IS NULL
ON CONFLICT DO NOTHING;

-- Step 3: Back-fill orphaned tasks to their org's default project
UPDATE "tasks" t
SET "project_id" = p.id
FROM "environments" e
JOIN "projects" p ON p.organization_id = e.organization_id AND p.is_default = true
WHERE t.environment_id = e.id
  AND t.project_id IS NULL;

-- Step 4: Make project_id NOT NULL now that all rows are filled
ALTER TABLE "tasks" ALTER COLUMN "project_id" SET NOT NULL;

-- Step 5: Ensure each org gets an Unassigned project going forward (for orgs with no tasks yet)
-- This is handled in application code (org creation hook), not SQL.
