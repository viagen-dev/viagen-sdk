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

  const body = await c.req.json<{ name: string; vercelProjectId?: string }>()

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
