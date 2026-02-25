/**
 * Sandbox helpers — auto-configured from environment variables.
 *
 * Used by Claude inside a viagen sandbox to report task status
 * back to the platform without raw fetch calls.
 *
 * Env vars (set automatically by the platform):
 *   VIAGEN_CALLBACK_URL — platform callback endpoint
 *   VIAGEN_AUTH_TOKEN    — one-time bearer token
 *   VIAGEN_TASK_ID       — task being worked on
 */

function env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

async function report(body: Record<string, unknown>): Promise<void> {
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
}

/** Report that the task is ready for review (PR created). */
export async function reviewReady(opts: {
  prUrl: string
  result: string
}): Promise<void> {
  await report({
    status: 'validating',
    prUrl: opts.prUrl,
    result: opts.result,
  })
}

/** Report that the task completed successfully. */
export async function complete(opts: {
  prUrl?: string
  result: string
}): Promise<void> {
  await report({
    status: 'completed',
    prUrl: opts.prUrl,
    result: opts.result,
  })
}
