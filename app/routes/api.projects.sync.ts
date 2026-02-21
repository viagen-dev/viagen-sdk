import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { setProjectSecret } from '~/lib/infisical.server'
import { log } from '~/lib/logger.server'

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { role, org } = await requireAuth(request)
  if (role !== 'admin') {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return Response.json({ error: 'Project name is required' }, { status: 400 })
  }

  let project

  // If id is provided, try to find and update the existing project
  if (body.id) {
    const [existing] = await db
      .update(projects)
      .set({
        name: body.name.trim(),
        ...(body.templateId !== undefined && { templateId: body.templateId }),
        ...(body.githubRepo !== undefined && { githubRepo: body.githubRepo }),
      })
      .where(and(eq(projects.id, body.id), eq(projects.organizationId, org.id)))
      .returning()

    if (existing) {
      project = existing
    }
  }

  // If no existing project found (or no id provided), create a new one
  if (!project) {
    const [created] = await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: body.name.trim(),
        templateId: body.templateId ?? null,
        githubRepo: body.githubRepo ?? null,
      })
      .returning()

    project = created
  }

  // Store secrets in Infisical
  let stored = 0
  if (body.secrets && typeof body.secrets === 'object') {
    const entries = Object.entries(body.secrets)
    for (const [key, value] of entries) {
      if (typeof key === 'string' && typeof value === 'string') {
        await setProjectSecret(org.id, project.id, key, value)
        stored++
      }
    }
  }

  log.info({ projectId: project.id, projectName: project.name, secretsStored: stored }, 'project synced')
  return Response.json({ project, secrets: { stored } })
}
