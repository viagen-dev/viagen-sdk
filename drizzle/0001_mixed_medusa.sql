CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sandbox_id" varchar(255) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"branch" varchar(255) DEFAULT 'main' NOT NULL,
	"git_remote_url" varchar(1024),
	"git_user_name" varchar(255),
	"git_user_email" varchar(255),
	"vercel_team_id" varchar(255),
	"vercel_project_id" varchar(255),
	"viagen_project_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "git_branch";