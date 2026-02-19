import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  listProjectSecrets,
  listOrgSecrets,
  setProjectSecret,
  deleteProjectSecret,
  getSecret,
} from '~/lib/infisical.server'
import {
  upsertVercelEnvVars,
  listVercelEnvVars,
  deleteVercelEnvVar,
} from '~/lib/vercel.server'

const INTEGRATION_KEYS = new Set([
  'VERCEL_ACCESS_TOKEN',
  'ANTHROPIC_API_KEY',
  'GITHUB_ACCESS_TOKEN',
])

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const { org } = await requireAuth(request)
  const id = params.id

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const [projectSecrets, orgSecrets] = await Promise.all([
    listProjectSecrets(org.id, id),
    listOrgSecrets(org.id),
  ])

  // Build merged list: project secrets override org secrets with same key
  const projectKeySet = new Set(projectSecrets.map((s) => s.key))
  const secrets: { key: string; value: string; source: 'project' | 'org' }[] = [
    ...projectSecrets.map((s) => ({ ...s, source: 'project' as const })),
    ...orgSecrets
      .filter((s) => !INTEGRATION_KEYS.has(s.key) && !projectKeySet.has(s.key))
      .map((s) => ({ ...s, source: 'org' as const })),
  ]

  secrets.sort((a, b) => a.key.localeCompare(b.key))

  return Response.json({ secrets })
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const { role, org } = await requireAuth(request)
  const id = params.id

  if (role !== 'admin') {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  if (request.method === 'POST') {
    const body = await request.json()
    const key = body.key?.trim()
    const value = body.value

    if (!key || typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return Response.json({ error: 'Invalid key. Use letters, numbers, and underscores.' }, { status: 400 })
    }
    if (typeof value !== 'string') {
      return Response.json({ error: 'Value is required' }, { status: 400 })
    }

    await setProjectSecret(org.id, id, key, value)

    // Sync to Vercel if connected
    if (project.vercelProjectId) {
      try {
        const vercelToken = await getSecret(org.id, 'VERCEL_ACCESS_TOKEN')
        if (vercelToken) {
          await upsertVercelEnvVars(vercelToken, project.vercelProjectId, [{ key, value }])
        }
      } catch {
        // Vercel sync is best-effort
      }
    }

    return Response.json({ success: true })
  }

  if (request.method === 'DELETE') {
    const body = await request.json()
    const key = body.key?.trim()

    if (!key || typeof key !== 'string') {
      return Response.json({ error: 'Key is required' }, { status: 400 })
    }

    await deleteProjectSecret(org.id, id, key)

    // Remove from Vercel if connected
    if (project.vercelProjectId) {
      try {
        const vercelToken = await getSecret(org.id, 'VERCEL_ACCESS_TOKEN')
        if (vercelToken) {
          const envVars = await listVercelEnvVars(vercelToken, project.vercelProjectId)
          const match = envVars.find((v) => v.key === key)
          if (match) {
            await deleteVercelEnvVar(vercelToken, project.vercelProjectId, match.id)
          }
        }
      } catch {
        // Vercel sync is best-effort
      }
    }

    return Response.json({ success: true })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
