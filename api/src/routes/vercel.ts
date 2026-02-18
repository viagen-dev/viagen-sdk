import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { getSecret, setSecret, deleteSecret } from '../lib/infisical.js'
import {
  listVercelProjects,
  createVercelProject,
  VercelApiError,
  type VercelCreateProjectInput,
} from '../lib/vercel.js'

const VERCEL_TOKEN_KEY = 'VERCEL_ACCESS_TOKEN'

const vercelRoutes = new Hono<AuthEnv>()

vercelRoutes.use('*', requireAuth)

/** PUT /vercel/token — set the org's Vercel access token. Admin only. */
vercelRoutes.put('/token', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Admin role required' }, 403)
  }

  const body = await c.req.json<{ token: string }>()

  if (!body.token || typeof body.token !== 'string' || body.token.trim().length === 0) {
    return c.json({ error: 'Vercel access token is required' }, 400)
  }

  await setSecret(c.get('organizationId'), VERCEL_TOKEN_KEY, body.token.trim())
  return c.json({ success: true })
})

/** DELETE /vercel/token — remove the org's Vercel access token. Admin only. */
vercelRoutes.delete('/token', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Admin role required' }, 403)
  }

  await deleteSecret(c.get('organizationId'), VERCEL_TOKEN_KEY)
  return c.json({ success: true })
})

/** GET /vercel/token — check if a Vercel token is configured. */
vercelRoutes.get('/token', async (c) => {
  const token = await getSecret(c.get('organizationId'), VERCEL_TOKEN_KEY)
  return c.json({ configured: !!token })
})

/** GET /vercel/projects — list projects from Vercel. */
vercelRoutes.get('/projects', async (c) => {
  const token = await getSecret(c.get('organizationId'), VERCEL_TOKEN_KEY)
  if (!token) {
    return c.json({ error: 'Vercel access token not configured' }, 400)
  }

  try {
    const data = await listVercelProjects(token, {
      search: c.req.query('search') || undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      from: c.req.query('from') || undefined,
      teamId: c.req.query('teamId') || undefined,
    })
    return c.json(data)
  } catch (err) {
    if (err instanceof VercelApiError) {
      return c.json({ error: err.message }, err.status === 401 ? 401 : 502)
    }
    throw err
  }
})

/** POST /vercel/projects — create a project in Vercel. Admin only. */
vercelRoutes.post('/projects', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Admin role required' }, 403)
  }

  const token = await getSecret(c.get('organizationId'), VERCEL_TOKEN_KEY)
  if (!token) {
    return c.json({ error: 'Vercel access token not configured' }, 400)
  }

  const body = await c.req.json<VercelCreateProjectInput & { teamId?: string }>()
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return c.json({ error: 'Project name is required' }, 400)
  }

  try {
    const project = await createVercelProject(
      token,
      {
        name: body.name.trim(),
        framework: body.framework,
        gitRepository: body.gitRepository,
        rootDirectory: body.rootDirectory,
        buildCommand: body.buildCommand,
      },
      body.teamId,
    )
    return c.json({ project }, 201)
  } catch (err) {
    if (err instanceof VercelApiError) {
      return c.json({ error: err.message }, err.status === 401 ? 401 : 502)
    }
    throw err
  }
})

export { vercelRoutes }
