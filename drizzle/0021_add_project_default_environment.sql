ALTER TABLE "projects" ADD COLUMN "default_environment_id" uuid REFERENCES "environments"("id") ON DELETE SET NULL;
