-- Change tasks.environment_id from CASCADE to SET NULL on delete
-- so deleting an environment doesn't destroy all its tasks
ALTER TABLE "tasks" ALTER COLUMN "environment_id" DROP NOT NULL;
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_environment_id_environments_id_fk";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_environment_id_environments_id_fk"
  FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE SET NULL;
