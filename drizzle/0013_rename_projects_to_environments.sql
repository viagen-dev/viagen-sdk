-- Rename projects table to environments
ALTER TABLE "projects" RENAME TO "environments";

-- Add kind and domain columns
ALTER TABLE "environments" ADD COLUMN "kind" varchar(64) NOT NULL DEFAULT 'app';
ALTER TABLE "environments" ADD COLUMN "domain" varchar(255);

-- Rename project_id foreign key columns to environment_id
ALTER TABLE "workspaces" RENAME COLUMN "project_id" TO "environment_id";
ALTER TABLE "tasks" RENAME COLUMN "project_id" TO "environment_id";
