-- Add name and project_id to workspaces
ALTER TABLE "workspaces" ADD COLUMN "name" varchar(255);
ALTER TABLE "workspaces" ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;
