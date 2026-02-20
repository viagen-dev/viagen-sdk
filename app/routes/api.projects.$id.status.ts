import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getProjectSecret, getSecret } from '~/lib/infisical.server'

const CLAUDE_KEYS = ['CLAUDE_ACCESS_TOKEN', 'ANTHROPIC_API_KEY']

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const { user, org } = await requireAuth(request)
  const id = params.id

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Helper: check if a secret exists at project or user level
  const hasToken = async (key: string): Promise<boolean> => {
    const projectVal = await getProjectSecret(org.id, id, key).catch(() => null)
    if (projectVal) return true
    const userVal = await getSecret(`user/${user.id}`, key).catch(() => null)
    return !!userVal
  }

  // GitHub: linked (has repo in DB) + token available
  const githubLinked = !!project.githubRepo
  const githubToken = await hasToken('GITHUB_ACCESS_TOKEN')

  // Vercel: linked (has vercelProjectId in DB) + token available
  const vercelLinked = !!project.vercelProjectId
  const vercelToken = await hasToken('VERCEL_ACCESS_TOKEN')

  // Claude: check project > org > user cascade, plus expiration
  let claudeConnected = false
  let claudeSource: string | null = null
  let claudeKeyPrefix: string | null = null
  let claudeExpired = false

  // Check project level
  for (const key of CLAUDE_KEYS) {
    const val = await getProjectSecret(org.id, id, key).catch(() => null)
    if (val) {
      claudeConnected = true
      claudeSource = 'project'
      claudeKeyPrefix = val.slice(0, 12) + '...'
      break
    }
  }

  // Check org level
  if (!claudeConnected) {
    for (const key of CLAUDE_KEYS) {
      const val = await getSecret(org.id, key).catch(() => null)
      if (val) {
        claudeConnected = true
        claudeSource = 'org'
        claudeKeyPrefix = val.slice(0, 12) + '...'
        break
      }
    }
  }

  // Check user level
  if (!claudeConnected) {
    for (const key of CLAUDE_KEYS) {
      const val = await getSecret(`user/${user.id}`, key).catch(() => null)
      if (val) {
        claudeConnected = true
        claudeSource = 'user'
        claudeKeyPrefix = val.slice(0, 12) + '...'
        break
      }
    }
  }

  // Check Claude OAuth token expiration (project > org level)
  if (claudeConnected && claudeSource !== 'user') {
    const expires =
      await getProjectSecret(org.id, id, 'CLAUDE_TOKEN_EXPIRES').catch(() => null) ??
      await getSecret(org.id, 'CLAUDE_TOKEN_EXPIRES').catch(() => null)
    if (expires) {
      const expiresMs = Number(expires)
      if (!isNaN(expiresMs) && expiresMs < Date.now()) {
        claudeExpired = true
      }
    }
  }

  // Ready = can launch a sandbox. GitHub repo + token and Claude are hard requirements.
  // Vercel linkage is optional — enhances deployment but doesn't block sandbox launch.
  const ready =
    githubLinked && githubToken &&
    claudeConnected && !claudeExpired

  return Response.json({
    ready,
    github: { linked: githubLinked, tokenAvailable: githubToken },
    vercel: { linked: vercelLinked, tokenAvailable: vercelToken },
    claude: {
      connected: claudeConnected,
      source: claudeSource,
      keyPrefix: claudeKeyPrefix,
      expired: claudeExpired,
    },
  })
}
