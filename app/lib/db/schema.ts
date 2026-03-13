import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  primaryKey,
  jsonb,
  integer,
  real,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.organizationId] })],
);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  vercelProjectId: varchar("vercel_project_id", { length: 255 }),
  vercelProjectName: varchar("vercel_project_name", { length: 255 }),
  vercelOrgId: varchar("vercel_org_id", { length: 255 }),
  githubRepo: varchar("github_repo", { length: 255 }),
  templateId: varchar("template_id", { length: 64 }),
  taskPrefix: varchar("task_prefix", { length: 10 }),
  vercelEnvSync: jsonb("vercel_env_sync").$type<Record<string, boolean>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sandboxId: varchar("sandbox_id", { length: 255 }).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  branch: varchar("branch", { length: 255 }).notNull().default("main"),
  gitRemoteUrl: varchar("git_remote_url", { length: 1024 }),
  gitUserName: varchar("git_user_name", { length: 255 }),
  gitUserEmail: varchar("git_user_email", { length: 255 }),
  vercelOrgId: varchar("vercel_org_id", { length: 255 }),
  vercelProjectId: varchar("vercel_project_id", { length: 255 }),
  viagenProjectId: uuid("viagen_project_id"),
  taskId: uuid("task_id"),
  status: varchar("status", { length: 32 }).notNull().default("provisioning"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const databases = pgTable("databases", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 32 }).notNull().default("pg"),
  provider: varchar("provider", { length: 32 }).notNull().default("neon"),
  providerMeta: text("provider_meta"),
  status: varchar("status", { length: 32 }).notNull().default("provisioning"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const apiTokens = pgTable("api_tokens", {
  id: varchar("id", { length: 64 }).primaryKey(), // SHA-256 hash of plaintext token
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  tokenPrefix: varchar("token_prefix", { length: 8 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  model: varchar("model", { length: 100 })
    .notNull()
    .default("claude-sonnet-4-6"),
  type: varchar("type", { length: 32 }).notNull().default("task"),
  status: varchar("status", { length: 32 }).notNull().default("ready"),
  result: text("result"),
  error: text("error"),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "set null",
  }),
  taskNumber: integer("task_number"),
  branch: varchar("branch", { length: 255 }).notNull().default("feat"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  prUrl: varchar("pr_url", { length: 2048 }),
  callbackTokenHash: varchar("callback_token_hash", { length: 64 }),
  durationMs: integer("duration_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: real("cost_usd"),
  prReviewStatus: varchar("pr_review_status", { length: 32 }),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrgMember = typeof orgMembers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Database = typeof databases.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  blobUrl: text("blob_url").notNull(),
  contentType: varchar("content_type", { length: 128 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
