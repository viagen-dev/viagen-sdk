import {
  type RouteConfig,
  route,
  layout,
  index,
  prefix,
} from "@react-router/dev/routes";

export default [
  // Public pages
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("company", "routes/company.tsx"),
  route("request-invite", "routes/early-access.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("cli/authorize", "routes/cli.authorize.tsx"),

  // Authenticated layout
  layout("routes/_auth.tsx", [
    route("dashboard", "routes/_auth.environments.tsx"),
    route("environments/new", "routes/_auth.environments.new.tsx"),
    route("environments/:id/settings", "routes/_auth.environments.$id_.settings.tsx"),
    route("environments/:id/deploys", "routes/_auth.environments.$id_.deploys.tsx"),
    route(
      "environments/:id/tasks/:taskId",
      "routes/_auth.environments.$id_.tasks.$taskId.tsx",
    ),
    route("settings", "routes/_auth.settings.tsx"),
    route("data", "routes/_auth.data.tsx"),
    route("billing", "routes/_auth.billing.tsx"),
  ]),

  // Resource routes (REST API for SDK)
  route("api/auth/invite", "routes/api.auth.invite.ts"),
  route("api/auth/login/:provider", "routes/api.auth.login.$provider.ts"),
  route("api/auth/callback/:provider", "routes/api.auth.callback.$provider.ts"),
  route("api/auth/me", "routes/api.auth.me.ts"),
  route("api/auth/profile", "routes/api.auth.profile.ts"),
  route("api/auth/logout", "routes/api.auth.logout.ts"),
  route("api/auth/tokens", "routes/api.auth.tokens.ts"),
  route("api/orgs", "routes/api.orgs.ts"),
  route("api/orgs/members", "routes/api.orgs.members.ts"),
  route("api/environments", "routes/api.environments.ts"),
  route("api/environments/sync", "routes/api.environments.sync.ts"),
  route("api/environments/:id", "routes/api.environments.$id.ts"),
  route("api/environments/:id/claude", "routes/api.environments.$id.claude.ts"),
  route("api/environments/:id/secrets", "routes/api.environments.$id.secrets.ts"),
  route(
    "api/environments/:id/vercel-sync",
    "routes/api.environments.$id.vercel-sync.ts",
  ),
  route("api/environments/:id/sandbox", "routes/api.environments.$id.sandbox.ts"),
  route("api/sandbox/callback", "routes/api.sandbox.callback.ts"),
  route(
    "api/environments/:id/workspaces/:workspaceId/logs",
    "routes/api.environments.$id.workspaces.$workspaceId.logs.ts",
  ),
  route("api/databases", "routes/api.databases.ts"),
  route("api/environments/:id/status", "routes/api.environments.$id.status.ts"),
  route("api/environments/:id/tasks", "routes/api.environments.$id.tasks.ts"),
  route(
    "api/environments/:id/tasks/:taskId",
    "routes/api.environments.$id.tasks.$taskId.ts",
  ),
  route(
    "api/environments/:id/tasks/:taskId/merge",
    "routes/api.environments.$id.tasks.$taskId.merge.ts",
  ),
  route(
    "api/environments/:id/tasks/:taskId/cancel",
    "routes/api.environments.$id.tasks.$taskId.cancel.ts",
  ),
  route(
    "api/environments/:id/tasks/:taskId/delete",
    "routes/api.environments.$id.tasks.$taskId.delete.ts",
  ),
  route(
    "api/environments/:id/tasks/:taskId/attachments",
    "routes/api.environments.$id.tasks.$taskId.attachments.ts",
  ),
  route("api/tasks", "routes/api.tasks.ts"),
  route(
    "api/environments/:id/deployments",
    "routes/api.environments.$id.deployments.ts",
  ),
  route("api/vercel/environments", "routes/api.vercel.environments.ts"),
  route("api/github/repos", "routes/api.github.repos.ts"),
  route(
    "api/integrations/github/start",
    "routes/api.integrations.github.start.ts",
  ),
  route("api/integrations/github", "routes/api.integrations.github.ts"),
  route(
    "api/integrations/vercel/start",
    "routes/api.integrations.vercel.start.ts",
  ),
  route(
    "api/integrations/vercel/callback",
    "routes/api.integrations.vercel.callback.ts",
  ),
  route("api/integrations/vercel", "routes/api.integrations.vercel.ts"),
  route("api/integrations/status", "routes/api.integrations.status.ts"),
  route("api/claude-key", "routes/api.claude-key.ts"),
] satisfies RouteConfig;
