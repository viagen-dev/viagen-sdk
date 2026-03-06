-- Add task prefix to projects and sequential task number to tasks
ALTER TABLE "projects" ADD COLUMN "task_prefix" varchar(10);
ALTER TABLE "tasks" ADD COLUMN "task_number" integer;
