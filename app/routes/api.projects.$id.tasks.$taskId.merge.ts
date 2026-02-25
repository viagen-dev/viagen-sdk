import { eq, and } from 'drizzle-orm'
import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects, tasks } from '~/lib/db/schema'
import { getSecret } from '~/lib/infisical.server'
import { parsePrUrl, mergePr } from '~/lib/github.server'
import { log } from '~/lib/logger.server'

export async function action({
  params,
  request,
}: {
  params: { id: string; taskId: string }
  request: Request
}) {
  if (request.method !== 'POST') {
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
    log.warn({ userId: user.id, projectId }, 'merge: project not found or not in org')
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Fetch the task
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))

  if (!task) {
    log.warn({ userId: user.id, projectId, taskId }, 'merge: task not found')
    return Response.json({ error: 'Task not found' }, { status: 404 })
  }

  if (!task.prUrl) {
    log.warn({ userId: user.id, taskId }, 'merge: task has no PR URL')
    return Response.json({ error: 'Task has no pull request' }, { status: 400 })
  }

  const parsed = parsePrUrl(task.prUrl)
  if (!parsed) {
    log.warn({ userId: user.id, taskId, prUrl: task.prUrl }, 'merge: could not parse PR URL')
    return Response.json({ error: 'Could not parse PR URL' }, { status: 400 })
  }

  // Get GitHub token
  const githubToken = await getSecret(org.id, 'GITHUB_TOKEN')
  if (!githubToken) {
    log.warn({ orgId: org.id }, 'merge: no GitHub token configured')
    return Response.json({ error: 'GitHub is not connected' }, { status: 400 })
  }

  try {
    const result = await mergePr(githubToken, parsed.owner, parsed.repo, parsed.number)
    log.info(
      { userId: user.id, projectId, taskId, pr: `${parsed.owner}/${parsed.repo}#${parsed.number}` },
      'PR merged successfully',
    )

    // Mark task as completed
    const [updated] = await db
      .update(tasks)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning()

    return Response.json({ task: updated, merge: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error({ userId: user.id, taskId, error: message }, 'merge: GitHub merge failed')
    return Response.json({ error: message }, { status: 422 })
  }
}
