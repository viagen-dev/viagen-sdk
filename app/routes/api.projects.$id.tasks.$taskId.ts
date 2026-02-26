import { eq, and } from 'drizzle-orm'
import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects, tasks } from '~/lib/db/schema'
import { log } from '~/lib/logger.server'

export async function loader({ params, request }: { params: { id: string; taskId: string }; request: Request }) {
  const { user, org } = await requireAuth(request)
  const { id: projectId, taskId } = params

  // Verify project belongs to user's org
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)))

  if (!project) {
    log.warn({ userId: user.id, projectId }, 'task detail: project not found or not in org')
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))

  if (!task) {
    log.warn({ userId: user.id, projectId, taskId }, 'task detail: task not found')
    return Response.json({ error: 'Task not found' }, { status: 404 })
  }

  log.debug({ projectId, taskId }, 'task detail fetched')
  return Response.json({ task })
}

export async function action({ params, request }: { params: { id: string; taskId: string }; request: Request }) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { user, org } = await requireAuth(request)
  const { id: projectId, taskId } = params

  // Verify project belongs to user's org
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)))

  if (!project) {
    log.warn({ userId: user.id, projectId }, 'task update: project not found or not in org')
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Verify task exists and belongs to this project
  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))

  if (!existing) {
    log.warn({ userId: user.id, projectId, taskId }, 'task update: task not found')
    return Response.json({ error: 'Task not found' }, { status: 404 })
  }

  let body: {
    status?: string
    result?: string | null
    error?: string | null
    prUrl?: string | null
    workspaceId?: string | null
    durationMs?: number | null
    inputTokens?: number | null
    outputTokens?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validStatuses = ['ready', 'running', 'validating', 'completed']
  if (body.status && !validStatuses.includes(body.status)) {
    return Response.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
      { status: 400 },
    )
  }

  // Build the update payload — only include provided fields
  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) {
    updates.status = body.status

    // Automatically set timestamps based on status transitions
    if (body.status === 'running' && !existing.startedAt) {
      updates.startedAt = new Date()
    }
    if (body.status === 'completed' && !existing.completedAt) {
      updates.completedAt = new Date()
    }
  }
  if (body.result !== undefined) updates.result = body.result
  if (body.error !== undefined) updates.error = body.error
  if (body.prUrl !== undefined) updates.prUrl = body.prUrl
  if (body.workspaceId !== undefined) updates.workspaceId = body.workspaceId
  if (body.durationMs !== undefined) updates.durationMs = body.durationMs
  if (body.inputTokens !== undefined) updates.inputTokens = body.inputTokens
  if (body.outputTokens !== undefined) updates.outputTokens = body.outputTokens

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, taskId))
    .returning()

  log.info(
    {
      userId: user.id,
      projectId,
      taskId,
      oldStatus: existing.status,
      newStatus: body.status ?? existing.status,
    },
    'task updated',
  )

  return Response.json({ task: updated })
}
