import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN
const TOKEN_OTHER = process.env.VIAGEN_TEST_TOKEN_OTHER

describe.skipIf(!TOKEN)('team tasks (/api/tasks)', () => {
  let authed: ViagenClient
  let unauthed: ViagenClient
  let outsider: ViagenClient

  beforeAll(() => {
    authed = createViagen({ baseUrl: BASE_URL, token: TOKEN! })
    unauthed = createViagen({ baseUrl: BASE_URL })
    outsider = createViagen({ baseUrl: BASE_URL, token: TOKEN_OTHER! })
  })

  // ── unauthorized ──────────────────────────────────────

  it('listTeam() returns 401 without a token', async () => {
    try {
      await unauthed.tasks.listTeam()
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  it('createTeam() returns 401 without a token', async () => {
    try {
      await unauthed.tasks.createTeam({
        prompt: 'should fail',
        githubRepo: 'owner/repo',
        vercelProjectId: 'prj_123',
      })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── validation ────────────────────────────────────────

  it('createTeam() returns 400 when prompt is missing', async () => {
    try {
      await authed.tasks.createTeam({
        prompt: '',
        githubRepo: 'owner/repo',
        vercelProjectId: 'prj_123',
      })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(400)
    }
  })

  it('createTeam() returns 400 when githubRepo is missing', async () => {
    try {
      await authed.tasks.createTeam({
        prompt: 'Build a landing page',
        githubRepo: '',
        vercelProjectId: 'prj_123',
      })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(400)
    }
  })

  it('createTeam() returns 400 when vercelProjectId is missing', async () => {
    try {
      await authed.tasks.createTeam({
        prompt: 'Build a landing page',
        githubRepo: 'owner/repo',
        vercelProjectId: '',
      })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(400)
    }
  })

  // ── create + list cycle ───────────────────────────────

  let createdTaskId: string
  let createdProjectId: string
  const uniqueRepo = `test-org/team-task-test-${Date.now()}`
  const vercelId = `prj_team_${Date.now()}`

  it('createTeam() creates a task and auto-creates a project', async () => {
    const result = await authed.tasks.createTeam({
      prompt: `Team task test ${Date.now()}`,
      githubRepo: uniqueRepo,
      vercelProjectId: vercelId,
      vercelProjectName: 'team-task-test',
      model: 'claude-sonnet-4-20250514',
    })

    expect(result.task).toBeDefined()
    expect(result.task.id).toBeTypeOf('string')
    expect(result.task.status).toBe('ready')
    expect(result.task.githubRepo).toBe(uniqueRepo)
    expect(result.task.vercelProjectId).toBe(vercelId)
    expect(result.task.projectName).toBeTypeOf('string')
    expect(result.task.projectName.length).toBeGreaterThan(0)
    expect(result.projectId).toBeTypeOf('string')

    createdTaskId = result.task.id
    createdProjectId = result.projectId
  })

  it('createTeam() reuses the same project for the same repo+vercel combo', async () => {
    const result = await authed.tasks.createTeam({
      prompt: `Second task on same project ${Date.now()}`,
      githubRepo: uniqueRepo,
      vercelProjectId: vercelId,
      vercelProjectName: 'team-task-test',
    })

    expect(result.projectId).toBe(createdProjectId)
    expect(result.task.id).not.toBe(createdTaskId)
    expect(result.task.status).toBe('ready')
  })

  it('listTeam() returns tasks across all projects', async () => {
    const tasks = await authed.tasks.listTeam()
    expect(Array.isArray(tasks)).toBe(true)

    // Should contain the task we just created
    const found = tasks.find((t) => t.id === createdTaskId)
    expect(found).toBeDefined()
    expect(found!.projectName).toBeTypeOf('string')
    expect(found!.githubRepo).toBe(uniqueRepo)
  })

  it('listTeam() supports status filter', async () => {
    const readyTasks = await authed.tasks.listTeam({ status: 'ready' })
    expect(readyTasks.every((t) => t.status === 'ready')).toBe(true)
  })

  it('listTeam() supports limit parameter', async () => {
    const limited = await authed.tasks.listTeam({ limit: 1 })
    expect(limited.length).toBeLessThanOrEqual(1)
  })

  it('listTeam() returns tasks ordered by createdAt desc', async () => {
    const tasks = await authed.tasks.listTeam()
    if (tasks.length >= 2) {
      for (let i = 1; i < tasks.length; i++) {
        const prev = new Date(tasks[i - 1].createdAt).getTime()
        const curr = new Date(tasks[i].createdAt).getTime()
        expect(prev).toBeGreaterThanOrEqual(curr)
      }
    }
  })

  // ── team task is accessible via project-level API too ─

  it('created task is accessible via project-level tasks.get()', async () => {
    const task = await authed.tasks.get(createdProjectId, createdTaskId)
    expect(task.id).toBe(createdTaskId)
    expect(task.projectId).toBe(createdProjectId)
  })

  it('created task appears in project-level tasks.list()', async () => {
    const tasks = await authed.tasks.list(createdProjectId)
    expect(tasks.some((t) => t.id === createdTaskId)).toBe(true)
  })

  // ── auto-created project is accessible via projects API ─

  it('auto-created project appears in projects.list()', async () => {
    const projects = await authed.projects.list()
    const found = projects.find((p) => p.id === createdProjectId)
    expect(found).toBeDefined()
    expect(found!.githubRepo).toBe(uniqueRepo)
    expect(found!.vercelProjectId).toBe(vercelId)
  })

  // ── update team task via project-level API ────────────

  it('team task can be updated via project-level tasks.update()', async () => {
    const updated = await authed.tasks.update(createdProjectId, createdTaskId, {
      status: 'running',
    })
    expect(updated.status).toBe('running')
    expect(updated.startedAt).toBeTruthy()
  })

  it('updated task status reflected in listTeam()', async () => {
    const tasks = await authed.tasks.listTeam()
    const found = tasks.find((t) => t.id === createdTaskId)
    expect(found).toBeDefined()
    expect(found!.status).toBe('running')
  })

  // ── cross-org isolation ───────────────────────────────

  describe.skipIf(!TOKEN_OTHER)('cross-org isolation', () => {
    it('outsider cannot list team tasks from another org', async () => {
      // The outsider has a different org, so listTeam should return their own tasks (if any)
      // but NOT the tasks we just created
      const tasks = await outsider.tasks.listTeam()
      const found = tasks.find((t) => t.id === createdTaskId)
      expect(found).toBeUndefined()
    })

    it('outsider cannot create a team task that lands in another org', async () => {
      // The outsider creates their own task — it should get a different projectId
      const result = await outsider.tasks.createTeam({
        prompt: `outsider task ${Date.now()}`,
        githubRepo: uniqueRepo, // same repo name, but different org
        vercelProjectId: vercelId,
      })

      // The project should be different because it's in the outsider's org
      expect(result.projectId).not.toBe(createdProjectId)
    })
  })

  // ── cleanup: complete the task so it doesn't pollute ──

  it('completes the created task for cleanup', async () => {
    const task = await authed.tasks.update(createdProjectId, createdTaskId, {
      status: 'completed',
      result: 'Test completed',
    })
    expect(task.status).toBe('completed')
    expect(task.completedAt).toBeTruthy()
  })
})
