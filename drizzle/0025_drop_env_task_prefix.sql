-- Move any environment task_prefix values to their associated projects first
UPDATE projects p
SET task_prefix = e.task_prefix
FROM environments e
WHERE p.default_environment_id = e.id
  AND p.task_prefix IS NULL
  AND e.task_prefix IS NOT NULL;

ALTER TABLE environments DROP COLUMN task_prefix;
