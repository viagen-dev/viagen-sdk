ALTER TABLE "workspaces" ADD COLUMN "status" varchar(32) NOT NULL DEFAULT 'running';
UPDATE "workspaces" SET "status" = 'running' WHERE "status" = 'provisioning';
