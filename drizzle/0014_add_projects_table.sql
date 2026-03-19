-- Create projects table
CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "task_prefix" varchar(10),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add project_id to tasks (nullable, backfilled later)
ALTER TABLE "tasks" ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;
