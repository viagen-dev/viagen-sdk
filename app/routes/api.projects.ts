import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq } from 'drizzle-orm'
import { log } from '~/lib/logger.server'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id))
    .orderBy(projects.createdAt)

  return Response.json({ projects: result })
}

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { role, org } = await requireAuth(request)
  if (role !== 'admin') {
    return Response.json({ error: 'Admin role required to create projects' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return Response.json({ error: 'Project name is required' }, { status: 400 })
  }

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      name: body.name.trim(),
      vercelProjectId: body.vercelProjectId ?? null,
      vercelTeamId: body.vercelTeamId ?? null,
      githubRepo: body.githubRepo ?? null,
      gitBranch: body.gitBranch ?? 'main',
      templateId: body.templateId ?? null,
    })
    .returning()

  log.info({ orgId: org.id, projectId: project.id, projectName: project.name }, 'project created')
  return Response.json({ project }, { status: 201 })
}
