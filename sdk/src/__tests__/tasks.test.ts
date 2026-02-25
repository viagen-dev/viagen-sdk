import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN
const TOKEN_OTHER = process.env.VIAGEN_TEST_TOKEN_OTHER

describe.skipIf(!TOKEN)('tasks', () => {
  let authed: ViagenClient
  let unauthed: ViagenClient
  let outsider: ViagenClient

  beforeAll(() => {
    authed = createViagen({ baseUrl: BASE_URL, token: TOKEN! })
    unauthed = createViagen({ baseUrl: BASE_URL })
    outsider = createViagen({ baseUrl: BASE_URL, token: TOKEN_OTHER! })
  })

  // ── setup: find the seeded project ────────────────────

  let projectId: string

  it('finds the seeded project', async () => {
    const projects = await authed.projects.list()
    const seeded = projects.find((p) => p.name === 'Test Project')
    expect(seeded).toBeDefined()
    projectId = seeded!.id
  })

  // ── unauthorized ──────────────────────────────────────

  it('list() returns 401 without a token', async () => {
    try {
      await unauthed.tasks.list(projectId)
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── CRUD cycle ────────────────────────────────────────

  let taskId: string

  it('create() creates a task', async () => {
    const task = await authed.tasks.create(projectId, {
      prompt: `sdk-test-task-${Date.now()}`,
      branch: 'test-branch',
    })
    expect(task.id).toBeTypeOf('string')
    expect(task.status).toBe('ready')
    expect(task.branch).toBe('test-branch')
    expect(task.prUrl).toBeNull()
    taskId = task.id
  })

  it('get() returns the created task', async () => {
    const task = await authed.tasks.get(projectId, taskId)
    expect(task.id).toBe(taskId)
    expect(task.projectId).toBe(projectId)
  })

  it('list() includes the created task', async () => {
    const all = await authed.tasks.list(projectId)
    expect(all.some((t) => t.id === taskId)).toBe(true)
  })

  it('list() supports status filter', async () => {
    const ready = await authed.tasks.list(projectId, 'ready')
    expect(ready.every((t) => t.status === 'ready')).toBe(true)
  })

  it('update() transitions to running', async () => {
    const task = await authed.tasks.update(projectId, taskId, { status: 'running' })
    expect(task.status).toBe('running')
    expect(task.startedAt).toBeTruthy()
  })

  it('update() transitions to completed with prUrl', async () => {
    const task = await authed.tasks.update(projectId, taskId, {
      status: 'completed',
      prUrl: 'https://github.com/test/repo/pull/99',
      result: 'Done',
    })
    expect(task.status).toBe('completed')
    expect(task.prUrl).toBe('https://github.com/test/repo/pull/99')
    expect(task.result).toBe('Done')
    expect(task.completedAt).toBeTruthy()
  })

  // ── cross-org isolation ───────────────────────────────

  it('outsider cannot list tasks from another org', async () => {
    try {
      await outsider.tasks.list(projectId)
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(404)
    }
  })

  it('outsider cannot get a task from another org', async () => {
    try {
      await outsider.tasks.get(projectId, taskId)
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(404)
    }
  })
})
