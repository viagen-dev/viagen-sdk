import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN
const TOKEN_OTHER = process.env.VIAGEN_TEST_TOKEN_OTHER

describe.skipIf(!TOKEN)('projects', () => {
  let authed: ViagenClient
  let unauthed: ViagenClient
  let outsider: ViagenClient

  beforeAll(() => {
    authed = createViagen({ baseUrl: BASE_URL, token: TOKEN! })
    unauthed = createViagen({ baseUrl: BASE_URL })
    outsider = createViagen({ baseUrl: BASE_URL, token: TOKEN_OTHER! })
  })

  // ── unauthorized ────────────────────────────────────

  it('list() returns 401 without a token', async () => {
    try {
      await unauthed.projects.list()
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── list ────────────────────────────────────────────

  it('list() returns the seeded project', async () => {
    const projects = await authed.projects.list()
    expect(projects).toBeInstanceOf(Array)
    const seeded = projects.find((p) => p.name === 'Test Project')
    expect(seeded).toBeDefined()
    expect(seeded!.templateId).toBe('react-router')
  })

  // ── CRUD cycle ──────────────────────────────────────

  let projectId: string

  it('create() creates a project', async () => {
    const project = await authed.projects.create({
      name: `sdk-test-${Date.now()}`,
      templateId: 'react-router',
    })
    expect(project.id).toBeTypeOf('string')
    expect(project.templateId).toBe('react-router')
    projectId = project.id
  })

  it('get() returns the created project', async () => {
    const project = await authed.projects.get(projectId)
    expect(project.id).toBe(projectId)
    expect(project.templateId).toBe('react-router')
  })

  it('update() renames the project', async () => {
    const newName = `renamed-${Date.now()}`
    const project = await authed.projects.update(projectId, { name: newName })
    expect(project.name).toBe(newName)
  })

  it('update() sets optional fields', async () => {
    const project = await authed.projects.update(projectId, {
      githubRepo: 'org/repo',
    })
    expect(project.githubRepo).toBe('org/repo')
  })

  it('delete() removes the project', async () => {
    await authed.projects.delete(projectId)
    try {
      await authed.projects.get(projectId)
      expect.fail('Expected 404')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(404)
    }
  })

  // ── error cases ─────────────────────────────────────

  it('get() returns 404 for non-existent project', async () => {
    try {
      await authed.projects.get('00000000-0000-0000-0000-000000000000')
      expect.fail('Expected 404')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(404)
    }
  })

  it('create() returns 400 without a name', async () => {
    try {
      await authed.projects.create({ name: '' })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(400)
    }
  })

  // ── cross-org isolation ─────────────────────────────
  // User B (outsider) should never be able to read, update,
  // or delete projects belonging to User A's org.

  describe('cross-org isolation', () => {
    let targetProjectId: string

    beforeAll(async () => {
      const project = await authed.projects.create({
        name: `isolation-target-${Date.now()}`,
      })
      targetProjectId = project.id
    })

    it('outsider cannot list projects from another org', async () => {
      const projects = await outsider.projects.list()
      const leaked = projects.find((p) => p.id === targetProjectId)
      expect(leaked).toBeUndefined()
    })

    it('outsider cannot read a project from another org', async () => {
      try {
        await outsider.projects.get(targetProjectId)
        expect.fail('Expected 404')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(404)
      }
    })

    it('outsider cannot update a project from another org', async () => {
      try {
        await outsider.projects.update(targetProjectId, { name: 'hacked' })
        expect.fail('Expected 404')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(404)
      }
    })

    it('outsider cannot delete a project from another org', async () => {
      try {
        await outsider.projects.delete(targetProjectId)
        expect.fail('Expected 404')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(404)
      }
    })

    it('project still exists after outsider attack attempts', async () => {
      const project = await authed.projects.get(targetProjectId)
      expect(project.id).toBe(targetProjectId)
      expect(project.name).toContain('isolation-target-')
    })
  })

  // ── sync ──────────────────────────────────────────────

  describe('sync', () => {
    it('sync() creates a new project', async () => {
      const result = await authed.projects.sync({
        name: `sync-new-${Date.now()}`,
      })
      expect(result.project.id).toBeTypeOf('string')
      expect(result.project.name).toContain('sync-new-')
      expect(result.secrets.stored).toBe(0)
    })

    it('sync() upserts an existing project by ID', async () => {
      const first = await authed.projects.sync({
        name: `sync-upsert-${Date.now()}`,
        templateId: 'react-router',
      })

      const newName = `sync-updated-${Date.now()}`
      const second = await authed.projects.sync({
        id: first.project.id,
        name: newName,
      })

      expect(second.project.id).toBe(first.project.id)
      expect(second.project.name).toBe(newName)
    })

    it('sync() sets vercel fields', async () => {
      const result = await authed.projects.sync({
        name: `sync-vercel-${Date.now()}`,
        vercelProjectId: 'prj_test123',
        vercelOrgId: 'team_test456',
      })
      expect(result.project.vercelProjectId).toBe('prj_test123')
      expect(result.project.vercelOrgId).toBe('team_test456')
    })

    it('sync() creates a new project when ID is not found', async () => {
      const result = await authed.projects.sync({
        id: '00000000-0000-0000-0000-000000000000',
        name: `sync-notfound-${Date.now()}`,
      })
      expect(result.project.id).not.toBe('00000000-0000-0000-0000-000000000000')
      expect(result.project.name).toContain('sync-notfound-')
    })

    it('sync() returns 400 without a name', async () => {
      try {
        await authed.projects.sync({ name: '' })
        expect.fail('Expected error')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(400)
      }
    })

    it('sync() returns 401 without a token', async () => {
      try {
        await unauthed.projects.sync({ name: 'no-auth' })
        expect.fail('Expected error')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(401)
      }
    })

    it('outsider cannot sync to another org\'s project', async () => {
      const owned = await authed.projects.sync({
        name: `sync-isolation-${Date.now()}`,
      })

      // Outsider tries to sync with authed's project ID
      const result = await outsider.projects.sync({
        id: owned.project.id,
        name: 'hijack-attempt',
      })

      // Should create a new project in outsider's org, not modify the original
      expect(result.project.id).not.toBe(owned.project.id)
      expect(result.project.name).toBe('hijack-attempt')

      // Original project is untouched
      const original = await authed.projects.get(owned.project.id)
      expect(original.name).toContain('sync-isolation-')
    })
  })
})
