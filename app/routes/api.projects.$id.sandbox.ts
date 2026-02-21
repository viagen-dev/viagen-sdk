import { randomUUID } from 'crypto'
import { Sandbox } from '@vercel/sandbox'
import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects, workspaces } from '~/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { listProjectSecrets, getSecret, getProjectSecret } from '~/lib/infisical.server'
import { log } from '~/lib/logger.server'

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const { org } = await requireAuth(request)
  const id = params.id

  // Verify project belongs to org
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Return active workspace (not expired)
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.projectId, id), gt(workspaces.expiresAt, new Date())))
    .orderBy(workspaces.createdAt)
    .limit(1)

  return Response.json({ workspace: workspace ?? null })
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { role, user, org } = await requireAuth(request)
  if (role !== 'admin') {
    log.warn({ userId: user.id, orgId: org.id, projectId: params.id }, 'sandbox launch denied: not admin')
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  const id = params.id
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))

  if (!project) {
    log.warn({ userId: user.id, projectId: id }, 'sandbox launch: project not found')
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.githubRepo) {
    log.warn({ projectId: id }, 'sandbox launch: no github repo linked')
    return Response.json({ error: 'Project must have a GitHub repo to launch a sandbox' }, { status: 400 })
  }

  // Accept optional branch from request body
  const body = await request.json().catch(() => ({}))
  const branch = body.branch ?? 'main'

  log.info({ projectId: id, userId: user.id, orgId: org.id, repo: project.githubRepo, branch }, 'sandbox launch requested')

  // ── Gather secrets ──────────────────────────────────
  const projectSecrets = await listProjectSecrets(org.id, id)
  const envVars: Record<string, string> = {}
  for (const s of projectSecrets) {
    envVars[s.key] = s.value
  }

  // Claude credentials (project > org)
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

  // Vercel credentials (project override > user's token)
  const vercelToken =
    await getProjectSecret(org.id, id, 'VERCEL_ACCESS_TOKEN').catch(() => null) ??
    await getSecret(`user/${user.id}`, 'VERCEL_ACCESS_TOKEN').catch(() => null)

  // GitHub token (project override > user's token)
  const githubToken =
    await getProjectSecret(org.id, id, 'GITHUB_ACCESS_TOKEN').catch(() => null) ??
    await getSecret(`user/${user.id}`, 'GITHUB_ACCESS_TOKEN').catch(() => null)

  const claudeAuth = claudeAccessToken ? 'oauth' : anthropicApiKey ? 'api_key' : 'none'
  log.info(
    { projectId: id, claudeAuth, hasGithubToken: !!githubToken, hasVercelToken: !!vercelToken },
    'sandbox credentials resolved',
  )

  // ── Build sandbox ───────────────────────────────────
  const token = randomUUID()
  const timeoutMinutes = 30
  const timeoutMs = timeoutMinutes * 60 * 1000
  const remoteUrl = `https://github.com/${project.githubRepo}.git`

  try {
    const start = Date.now()

    // 1. Create sandbox with git source
    const sandbox = await Sandbox.create({
      runtime: 'node22',
      ports: [5173],
      timeout: timeoutMs,
      ...(githubToken ? {
        source: {
          type: 'git' as const,
          url: remoteUrl,
          username: 'x-access-token',
          password: githubToken,
        },
      } : {}),
    })

    try {
      // 2. Configure git inside sandbox
      if (githubToken) {
        await sandbox.runCommand('git', ['config', '--global', 'user.name', 'viagen'])
        await sandbox.runCommand('git', ['config', '--global', 'user.email', 'bot@viagen.dev'])
        await sandbox.runCommand('git', ['checkout', '-B', branch])
        await sandbox.runCommand('bash', [
          '-c',
          `echo 'https://x-access-token:${githubToken}@github.com' > ~/.git-credentials`,
        ])
        await sandbox.runCommand('git', ['config', '--global', 'credential.helper', 'store'])
        await sandbox.runCommand('bash', [
          '-c',
          'apt-get update -qq && apt-get install -y -qq gh > /dev/null 2>&1 || true',
        ])
      }

      // 3. Install vercel CLI if credentials available
      if (vercelToken && project.vercelProjectId) {
        await sandbox.runCommand('npm', ['install', '-g', 'vercel', '--silent'])
      }

      // 4. Build .env — use per-project vercelTeamId, NOT process.env
      const envMap: Record<string, string> = { ...envVars }
      envMap['VIAGEN_AUTH_TOKEN'] = token
      envMap['VIAGEN_SESSION_START'] = String(Math.floor(Date.now() / 1000))
      envMap['VIAGEN_SESSION_TIMEOUT'] = String(timeoutMinutes * 60)
      envMap['VIAGEN_PROJECT_ID'] = id

      if (anthropicApiKey) envMap['ANTHROPIC_API_KEY'] = anthropicApiKey
      if (claudeAccessToken) envMap['CLAUDE_ACCESS_TOKEN'] = claudeAccessToken
      if (claudeRefreshToken) envMap['CLAUDE_REFRESH_TOKEN'] = claudeRefreshToken
      if (claudeTokenExpires) envMap['CLAUDE_TOKEN_EXPIRES'] = claudeTokenExpires

      if (githubToken) {
        envMap['GITHUB_TOKEN'] = githubToken
        envMap['VIAGEN_BRANCH'] = branch
      }

      if (vercelToken) envMap['VERCEL_TOKEN'] = vercelToken
      if (project.vercelTeamId) envMap['VERCEL_ORG_ID'] = project.vercelTeamId
      if (project.vercelProjectId) envMap['VERCEL_PROJECT_ID'] = project.vercelProjectId

      const envLines = Object.entries(envMap).map(([k, v]) => `${k}=${v}`)
      await sandbox.writeFiles([
        { path: '.env', content: Buffer.from(envLines.join('\n')) },
      ])

      // 5. Install dependencies
      const install = await sandbox.runCommand('npm', ['install'])
      if (install.exitCode !== 0) {
        const stderr = await install.stderr()
        throw new Error(`npm install failed (exit ${install.exitCode}): ${stderr}`)
      }

      // 6. Start dev server (detached)
      await sandbox.runCommand({
        cmd: 'npm',
        args: ['run', 'dev', '--', '--host', '0.0.0.0'],
        detached: true,
      })

      // 7. Build result and save workspace
      const baseUrl = sandbox.domain(5173)
      const url = `${baseUrl}?token=${token}`
      const expiresAt = new Date(Date.now() + timeoutMs)

      const [workspace] = await db
        .insert(workspaces)
        .values({
          projectId: id,
          sandboxId: sandbox.sandboxId,
          url,
          expiresAt,
          branch,
          gitRemoteUrl: remoteUrl,
          gitUserName: 'viagen',
          gitUserEmail: 'bot@viagen.dev',
          vercelTeamId: project.vercelTeamId ?? null,
          vercelProjectId: project.vercelProjectId ?? null,
          viagenProjectId: id,
          createdBy: user.id,
        })
        .returning()

      const durationMs = Date.now() - start
      log.info(
        { projectId: id, workspaceId: workspace.id, sandboxId: sandbox.sandboxId, durationMs },
        'sandbox deployed successfully',
      )

      return Response.json({ workspace })
    } catch (err) {
      await sandbox.stop().catch(() => {})
      throw err
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sandbox deployment failed'
    log.error({ projectId: id, err }, 'sandbox deployment failed')
    return Response.json({ error: message }, { status: 500 })
  }
}
