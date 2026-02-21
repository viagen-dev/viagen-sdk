import { pgTable, uuid, varchar, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  provider: varchar('provider', { length: 32 }).notNull(),
  providerUserId: varchar('provider_user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const orgMembers = pgTable('org_members', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.organizationId] }),
])

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  vercelProjectId: varchar('vercel_project_id', { length: 255 }),
  vercelTeamId: varchar('vercel_team_id', { length: 255 }),
  githubRepo: varchar('github_repo', { length: 255 }),
  templateId: varchar('template_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sandboxId: varchar('sandbox_id', { length: 255 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  branch: varchar('branch', { length: 255 }).notNull().default('main'),
  gitRemoteUrl: varchar('git_remote_url', { length: 1024 }),
  gitUserName: varchar('git_user_name', { length: 255 }),
  gitUserEmail: varchar('git_user_email', { length: 255 }),
  vercelTeamId: varchar('vercel_team_id', { length: 255 }),
  vercelProjectId: varchar('vercel_project_id', { length: 255 }),
  viagenProjectId: uuid('viagen_project_id'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const apiTokens = pgTable('api_tokens', {
  id: varchar('id', { length: 64 }).primaryKey(), // SHA-256 hash of plaintext token
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  tokenPrefix: varchar('token_prefix', { length: 8 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Organization = typeof organizations.$inferSelect
export type OrgMember = typeof orgMembers.$inferSelect
export type Project = typeof projects.$inferSelect
export type Workspace = typeof workspaces.$inferSelect
export type ApiToken = typeof apiTokens.$inferSelect
