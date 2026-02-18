import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { projects } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'

const projectRoutes = new Hono<AuthEnv>()

projectRoutes.use('*', requireAuth)

/** GET /projects — list all projects for the user's org. */
projectRoutes.get('/', async (c) => {
  const organizationId = c.get('organizationId')

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(projects.createdAt)

  return c.json({ projects: result })
})

/** POST /projects — create a project. Admin only. */
projectRoutes.post('/', async (c) => {
  const role = c.get('role')
  if (role !== 'admin') {
    return c.json({ error: 'Admin role required to create projects' }, 403)
  }

  const body = await c.req.json<{ name: string; vercelProjectId?: string; githubRepo?: string }>()

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return c.json({ error: 'Project name is required' }, 400)
  }

  const organizationId = c.get('organizationId')

  const [project] = await db
    .insert(projects)
    .values({
      organizationId,
      name: body.name.trim(),
      vercelProjectId: body.vercelProjectId ?? null,
      githubRepo: body.githubRepo ?? null,
    })
    .returning()

  return c.json({ project }, 201)
})

/** GET /projects/:id — get a single project, org-scoped. */
projectRoutes.get('/:id', async (c) => {
  const organizationId = c.get('organizationId')
  const id = c.req.param('id')

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))

  if (!project) {
    return c.json({ error: 'Project not found' }, 404)
  }

  return c.json({ project })
})

/** PATCH /projects/:id — update a project (e.g., link Vercel project). Admin only. */
projectRoutes.patch('/:id', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Admin role required to update projects' }, 403)
  }

  const organizationId = c.get('organizationId')
  const id = c.req.param('id')
  const body = await c.req.json<{ vercelProjectId?: string | null; githubRepo?: string | null }>()

  const updates: Record<string, unknown> = {}
  if ('vercelProjectId' in body) {
    updates.vercelProjectId = body.vercelProjectId ?? null
  }
  if ('githubRepo' in body) {
    updates.githubRepo = body.githubRepo ?? null
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  const [project] = await db
    .update(projects)
    .set(updates)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
    .returning()

  if (!project) {
    return c.json({ error: 'Project not found' }, 404)
  }

  return c.json({ project })
})

/** DELETE /projects/:id — delete a project. Admin only, org-scoped. */
projectRoutes.delete('/:id', async (c) => {
  const role = c.get('role')
  if (role !== 'admin') {
    return c.json({ error: 'Admin role required to delete projects' }, 403)
  }

  const organizationId = c.get('organizationId')
  const id = c.req.param('id')

  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
    .returning()

  if (!deleted) {
    return c.json({ error: 'Project not found' }, 404)
  }

  return c.json({ success: true })
})

export { projectRoutes }
