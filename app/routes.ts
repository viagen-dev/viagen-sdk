import { type RouteConfig, route, layout, index, prefix } from "@react-router/dev/routes"

export default [
  // Public pages
  route("login", "routes/login.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("cli/authorize", "routes/cli.authorize.tsx"),

  // Authenticated layout
  layout("routes/_auth.tsx", [
    index("routes/_auth.dashboard.tsx"),
    route("projects", "routes/_auth.projects.tsx"),
    route("projects/new", "routes/_auth.projects.new.tsx"),
    route("projects/:id", "routes/_auth.projects.$id.tsx"),
    route("settings", "routes/_auth.settings.tsx"),
  ]),

  // Resource routes (REST API for SDK)
  route("api/auth/login/:provider", "routes/api.auth.login.$provider.ts"),
  route("api/auth/callback/:provider", "routes/api.auth.callback.$provider.ts"),
  route("api/auth/me", "routes/api.auth.me.ts"),
  route("api/auth/logout", "routes/api.auth.logout.ts"),
  route("api/auth/tokens", "routes/api.auth.tokens.ts"),
  route("api/orgs", "routes/api.orgs.ts"),
  route("api/orgs/members", "routes/api.orgs.members.ts"),
  route("api/projects", "routes/api.projects.ts"),
  route("api/projects/sync", "routes/api.projects.sync.ts"),
  route("api/projects/:id", "routes/api.projects.$id.ts"),
  route("api/projects/:id/claude", "routes/api.projects.$id.claude.ts"),
  route("api/projects/:id/secrets", "routes/api.projects.$id.secrets.ts"),
  route("api/projects/:id/sandbox", "routes/api.projects.$id.sandbox.ts"),
  route("api/vercel/projects", "routes/api.vercel.projects.ts"),
  route("api/github/repos", "routes/api.github.repos.ts"),
  route("api/integrations/github/start", "routes/api.integrations.github.start.ts"),
  route("api/integrations/github", "routes/api.integrations.github.ts"),
  route("api/integrations/vercel/start", "routes/api.integrations.vercel.start.ts"),
  route("api/integrations/vercel/callback", "routes/api.integrations.vercel.callback.ts"),
  route("api/integrations/vercel", "routes/api.integrations.vercel.ts"),
  route("api/integrations/status", "routes/api.integrations.status.ts"),
  route("api/claude-key", "routes/api.claude-key.ts"),
] satisfies RouteConfig
