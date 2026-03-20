-- Rename all existing default "Unassigned" projects to "No project"
UPDATE "projects"
SET "name" = 'No project'
WHERE "is_default" = true
  AND "name" = 'Unassigned';
