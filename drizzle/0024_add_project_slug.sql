ALTER TABLE projects ADD COLUMN slug VARCHAR(32);

-- Backfill: use task_prefix (lowercased) if set, otherwise slugify the name
UPDATE projects SET slug = LOWER(COALESCE(
  NULLIF(TRIM(task_prefix), ''),
  REGEXP_REPLACE(LOWER(TRIM(name)), '[^a-z0-9]+', '-', 'g')
));

-- Deduplicate slugs within each org by appending -2, -3, etc.
WITH dupes AS (
  SELECT id, slug, organization_id,
         ROW_NUMBER() OVER (PARTITION BY organization_id, slug ORDER BY created_at) AS rn
  FROM projects
)
UPDATE projects SET slug = projects.slug || '-' || dupes.rn
FROM dupes
WHERE projects.id = dupes.id AND dupes.rn > 1;

CREATE UNIQUE INDEX projects_org_slug_unique ON projects (organization_id, slug) WHERE slug IS NOT NULL;
