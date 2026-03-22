-- Indexes for slug/taskNumber-based routing lookups

-- Project lookup by slug within an org (findProject)
CREATE INDEX IF NOT EXISTS idx_projects_org_slug ON projects (organization_id, slug);

-- Task lookup by task_number within a project (task detail page)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_task_number ON tasks (project_id, task_number) WHERE task_number IS NOT NULL;

-- Task lookup by project_id (project detail page task list)
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);

-- Next task number query: max(task_number) across org via projects join
-- (covered by idx_tasks_project_id + idx_projects_org_slug)
