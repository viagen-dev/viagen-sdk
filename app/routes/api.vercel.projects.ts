import { requireAuth, isAdminRole } from '~/lib/session.server'
import { getSecret } from '~/lib/infisical.server'
import { listVercelProjects, createVercelProject, VercelApiError } from '~/lib/vercel.server'
import { log } from '~/lib/logger.server'

// ── POST: Create a new Vercel project ─────────────────────────────────────

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { user, org, role } = await requireAuth(request)

  if (!isAdminRole(role)) {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  const token = await getSecret(org.id, 'VERCEL_TOKEN').catch(() => null)
  if (!token) {
    log.warn({ userId: user.id, orgId: org.id }, 'vercel create project: token not configured')
    return Response.json({ error: 'Vercel not connected' }, { status: 400 })
  }

  const body = await request.json()
  const projectName = body.name?.trim()
  if (!projectName) {
    return Response.json({ error: 'Project name is required' }, { status: 400 })
  }

  log.info(
    { userId: user.id, orgId: org.id, projectName, framework: body.framework },
    'vercel create project: creating project',
  )

  try {
    const project = await createVercelProject(token, {
      name: projectName,
      framework: body.framework ?? undefined,
      gitRepository: body.githubRepo
        ? { type: 'github', repo: body.githubRepo }
        : undefined,
    })

    log.info(
      { userId: user.id, projectId: project.id, projectName: project.name },
      'vercel create project: success',
    )

    return Response.json({ project }, { status: 201 })
  } catch (err) {
    if (err instanceof VercelApiError) {
      log.error(
        { userId: user.id, status: err.status, message: err.message },
        'vercel create project: API error',
      )
      return Response.json({ error: err.message }, { status: err.status >= 500 ? 502 : err.status })
    }
    log.error(
      { userId: user.id, err: err instanceof Error ? err.message : String(err) },
      'vercel create project: unexpected error',
    )
    return Response.json({ error: 'Failed to create Vercel project' }, { status: 500 })
  }
}

// ── GET: List Vercel projects ─────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

  const token = await getSecret(org.id, 'VERCEL_TOKEN').catch(() => null)
  if (!token) {
    return Response.json({ error: 'Vercel not connected' }, { status: 400 })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit')) || 20
  const search = url.searchParams.get('search') ?? undefined

  const data = await listVercelProjects(token, { limit, search })
  return Response.json({ projects: data.projects })
}
