ALTER TABLE "tasks" ADD COLUMN "pr_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "callback_token_hash" varchar(64);
