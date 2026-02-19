import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'

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

  return Response.json({ project })
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const { role, org } = await requireAuth(request)
  const id = params.id

  if (request.method === 'PATCH') {
    if (role !== 'admin') {
      return Response.json({ error: 'Admin role required to update projects' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if ('name' in body) updates.name = body.name
    if ('vercelProjectId' in body) updates.vercelProjectId = body.vercelProjectId ?? null
    if ('githubRepo' in body) updates.githubRepo = body.githubRepo ?? null
    if ('gitBranch' in body) updates.gitBranch = body.gitBranch ?? 'main'

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No updates provided' }, { status: 400 })
    }

    const [project] = await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))
      .returning()

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    return Response.json({ project })
  }

  if (request.method === 'DELETE') {
    if (role !== 'admin') {
      return Response.json({ error: 'Admin role required to delete projects' }, { status: 403 })
    }

    const [deleted] = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))
      .returning()

    if (!deleted) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    return Response.json({ success: true })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
