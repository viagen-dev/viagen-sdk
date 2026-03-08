/**
 * Sandbox helpers — auto-configured from environment variables.
 *
 * Used by Claude inside a viagen sandbox to report task status
 * back to the platform without raw fetch calls.
 *
 * Env vars (set automatically by the platform):
 *   VIAGEN_CALLBACK_URL  — platform callback endpoint
 *   VIAGEN_AUTH_TOKEN    — one-time bearer token
 *   VIAGEN_TASK_ID       — task being worked on
 *   VIAGEN_PROJECT_ID    — project the task belongs to
 */

import type { Task } from './tasks.js'

function env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

async function report(body: Record<string, unknown>): Promise<unknown> {
  const url = env('VIAGEN_CALLBACK_URL')
  const token = env('VIAGEN_AUTH_TOKEN')
  const taskId = env('VIAGEN_TASK_ID')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ taskId, ...body }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Viagen callback failed (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Report task status to the platform.
 *
 * Maps user-facing statuses to internal ones:
 * - `'review'` → `'validating'` (PR created, ready for human review)
 * - `'completed'` → `'completed'` (task fully done)
 */
export async function updateTask(opts: {
  status: 'review' | 'completed'
  prUrl?: string
  result: string
  prReviewStatus?: 'pass' | 'flag' | 'fail'
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
}): Promise<void> {
  const internalStatus = opts.status === 'review' ? 'validating' : 'completed'
  await report({
    status: internalStatus,
    ...(opts.prUrl && { prUrl: opts.prUrl }),
    result: opts.result,
    ...(opts.prReviewStatus && { prReviewStatus: opts.prReviewStatus }),
    ...(opts.inputTokens != null && { inputTokens: opts.inputTokens }),
    ...(opts.outputTokens != null && { outputTokens: opts.outputTokens }),
    ...(opts.costUsd != null && { costUsd: opts.costUsd }),
  })
}

/**
 * Report that the task is ready for review (PR created).
 * @deprecated Use `updateTask({ status: 'review', ... })` instead.
 */
export async function reviewReady(opts: {
  prUrl: string
  result: string
  inputTokens?: number
  outputTokens?: number
}): Promise<void> {
  await report({
    status: 'validating',
    prUrl: opts.prUrl,
    result: opts.result,
    ...(opts.inputTokens != null && { inputTokens: opts.inputTokens }),
    ...(opts.outputTokens != null && { outputTokens: opts.outputTokens }),
  })
}

/**
 * Report that the task completed successfully.
 * @deprecated Use `updateTask({ status: 'completed', ... })` instead.
 */
export async function complete(opts: {
  prUrl?: string
  result: string
  inputTokens?: number
  outputTokens?: number
}): Promise<void> {
  await report({
    status: 'completed',
    prUrl: opts.prUrl,
    result: opts.result,
    ...(opts.inputTokens != null && { inputTokens: opts.inputTokens }),
    ...(opts.outputTokens != null && { outputTokens: opts.outputTokens }),
  })
}

/**
 * List tasks for the current project, optionally filtered by status.
 */
export async function listTasks(opts?: { status?: string }): Promise<Task[]> {
  const data = await report({
    action: 'list_tasks',
    projectId: env('VIAGEN_PROJECT_ID'),
    ...(opts?.status != null && { status: opts.status }),
  }) as { tasks: Task[] }
  return data.tasks
}

/**
 * Get a task by ID within the current project.
 */
export async function getTask(taskId: string): Promise<Task> {
  const data = await report({
    action: 'get_task',
    projectId: env('VIAGEN_PROJECT_ID'),
    taskId,
  }) as { task: Task }
  return data.task
}

/**
 * Create a new task in the current project.
 */
export async function createTask(opts: {
  prompt: string
  branch?: string
  type?: string
}): Promise<Task> {
  const data = await report({
    action: 'create_task',
    projectId: env('VIAGEN_PROJECT_ID'),
    ...opts,
  }) as { task: Task }
  return data.task
}
