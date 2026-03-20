-- Add description to projects
ALTER TABLE "projects" ADD COLUMN "description" text;

-- Create project_attachments table
CREATE TABLE "project_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "filename" varchar(255) NOT NULL,
  "blob_url" text NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
