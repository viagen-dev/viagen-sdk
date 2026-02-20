import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { listProjectSecrets, getSecret, getProjectSecret } from '~/lib/infisical.server'

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { role, user, org } = await requireAuth(request)
  if (role !== 'admin') {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  const id = params.id
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.githubRepo) {
    return Response.json({ error: 'Project must have a GitHub repo to launch a sandbox' }, { status: 400 })
  }

  // Gather secrets as env vars
  const projectSecrets = await listProjectSecrets(org.id, id)
  const envVars: Record<string, string> = {}
  for (const s of projectSecrets) {
    envVars[s.key] = s.value
  }

  // Resolve Claude credentials (project > org)
  const claudeAccessToken =
    await getProjectSecret(org.id, id, 'CLAUDE_ACCESS_TOKEN').catch(() => null) ??
    await getSecret(org.id, 'CLAUDE_ACCESS_TOKEN').catch(() => null)
  const claudeRefreshToken =
    await getProjectSecret(org.id, id, 'CLAUDE_REFRESH_TOKEN').catch(() => null) ??
    await getSecret(org.id, 'CLAUDE_REFRESH_TOKEN').catch(() => null)
  const claudeTokenExpires =
    await getProjectSecret(org.id, id, 'CLAUDE_TOKEN_EXPIRES').catch(() => null) ??
    await getSecret(org.id, 'CLAUDE_TOKEN_EXPIRES').catch(() => null)
  const anthropicApiKey =
    await getProjectSecret(org.id, id, 'ANTHROPIC_API_KEY').catch(() => null) ??
    await getSecret(org.id, 'ANTHROPIC_API_KEY').catch(() => null)

  // Resolve Vercel credentials (project override > user's token)
  const vercelToken =
    await getProjectSecret(org.id, id, 'VERCEL_ACCESS_TOKEN').catch(() => null) ??
    await getSecret(`user/${user.id}`, 'VERCEL_ACCESS_TOKEN').catch(() => null)

  // Resolve GitHub token (project override > user's token)
  const githubToken =
    await getProjectSecret(org.id, id, 'GITHUB_ACCESS_TOKEN').catch(() => null) ??
    await getSecret(`user/${user.id}`, 'GITHUB_ACCESS_TOKEN').catch(() => null)

  // Inject resolved credentials into envVars so they're available inside the sandbox
  if (vercelToken) {
    envVars['VERCEL_TOKEN'] = vercelToken
  }
  if (githubToken) {
    envVars['GITHUB_TOKEN'] = githubToken
  }
  if (project.vercelProjectId) {
    envVars['VERCEL_PROJECT_ID'] = project.vercelProjectId
  }
  const vercelTeamId = process.env.VERCEL_TEAM_ID
  if (vercelTeamId) {
    envVars['VERCEL_TEAM_ID'] = vercelTeamId
  }

  // Dynamic import — viagen is a devDependency, only available in dev
  const { deploySandbox } = await import('viagen').catch(() => {
    throw new Error('Sandbox launching is only available in development')
  })

  // Build deploySandbox options
  const opts: any = {
    cwd: process.cwd(),
    envVars,
  }

  // Claude auth: prefer OAuth tokens, fall back to API key
  if (claudeAccessToken && claudeRefreshToken && claudeTokenExpires) {
    opts.oauth = {
      accessToken: claudeAccessToken,
      refreshToken: claudeRefreshToken,
      tokenExpires: claudeTokenExpires,
    }
  } else if (anthropicApiKey) {
    opts.apiKey = anthropicApiKey
  }

  // Git info
  if (githubToken) {
    const remoteUrl = `https://github.com/${project.githubRepo}.git`
    opts.git = {
      remoteUrl,
      branch: project.gitBranch ?? 'main',
      userName: 'viagen',
      userEmail: 'bot@viagen.dev',
      token: githubToken,
    }
  }

  // Vercel credentials
  if (vercelToken && project.vercelProjectId) {
    opts.vercel = {
      token: vercelToken,
      teamId: process.env.VERCEL_TEAM_ID ?? '',
      projectId: project.vercelProjectId,
    }
  }

  try {
    const result = await deploySandbox(opts)
    return Response.json({
      url: result.url,
      sandboxId: result.sandboxId,
      mode: result.mode,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sandbox deployment failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
