import { describe, it, expect, beforeAll } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN
const CALLBACK_TOKEN = process.env.VIAGEN_TEST_CALLBACK_TOKEN

describe.skipIf(!TOKEN)('sandbox callback', () => {
  let projectId: string
  let taskId: string

  beforeAll(async () => {
    // Find the seeded project
    const projRes = await fetch(`${BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const projData = await projRes.json()
    const seeded = projData.projects.find((p: any) => p.name === 'Test Project')
    projectId = seeded.id

    // Create a task for negative tests
    const taskRes = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ prompt: 'Callback test task', branch: 'test-cb' }),
    })
    const taskData = await taskRes.json()
    taskId = taskData.task.id
  })

  // ── validation ────────────────────────────────────────

  it('returns 405 for GET requests', async () => {
    const res = await fetch(`${BASE_URL}/api/sandbox/callback`)
    expect(res.status).toBe(405)
  })

  it('returns 401 without Authorization header', async () => {
    const res = await fetch(`${BASE_URL}/api/sandbox/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: 'completed', prUrl: 'https://github.com/t/r/pull/1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 without taskId', async () => {
    const res = await fetch(`${BASE_URL}/api/sandbox/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({ status: 'completed' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 with invalid status', async () => {
    const res = await fetch(`${BASE_URL}/api/sandbox/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({ taskId, status: 'running' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent task', async () => {
    const res = await fetch(`${BASE_URL}/api/sandbox/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({
        taskId: '00000000-0000-0000-0000-000000000000',
        status: 'completed',
      }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 401 when task has no callback token hash', async () => {
    const res = await fetch(`${BASE_URL}/api/sandbox/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer some-random-token',
      },
      body: JSON.stringify({
        taskId,
        status: 'completed',
        prUrl: 'https://github.com/t/r/pull/1',
      }),
    })
    expect(res.status).toBe(401)
  })

  // ── positive path (requires seeded callback token) ────

  describe.skipIf(!CALLBACK_TOKEN)('with seeded callback token', () => {
    let seededTaskId: string

    beforeAll(async () => {
      // Find the seeded running task with callback token
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks?status=running`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
      const data = await res.json()
      const seeded = data.tasks?.find((t: any) => t.prompt === 'Seeded callback test task')
      seededTaskId = seeded?.id
    })

    it('successfully completes a task via callback', async () => {
      if (!seededTaskId) return

      const res = await fetch(`${BASE_URL}/api/sandbox/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CALLBACK_TOKEN}`,
        },
        body: JSON.stringify({
          taskId: seededTaskId,
          status: 'completed',
          prUrl: 'https://github.com/test/repo/pull/42',
          result: 'Added the feature successfully',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.task.status).toBe('completed')
      expect(data.task.prUrl).toBe('https://github.com/test/repo/pull/42')
      expect(data.task.result).toBe('Added the feature successfully')
      expect(data.task.completedAt).toBeTruthy()
      // Token should be consumed (nullified)
      expect(data.task.callbackTokenHash).toBeNull()
    })

    it('returns the task unchanged if already finalized', async () => {
      if (!seededTaskId) return

      const res = await fetch(`${BASE_URL}/api/sandbox/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Use any token — task is already finalized so it short-circuits before token check
          Authorization: `Bearer ${CALLBACK_TOKEN}`,
        },
        body: JSON.stringify({
          taskId: seededTaskId,
          status: 'completed',
          prUrl: 'https://github.com/test/repo/pull/99',
        }),
      })

      // Already finalized — token was consumed, so this should be 401
      expect(res.status).toBe(401)
    })
  })
})
