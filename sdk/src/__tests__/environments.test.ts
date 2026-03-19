import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN
const TOKEN_OTHER = process.env.VIAGEN_TEST_TOKEN_OTHER

describe.skipIf(!TOKEN)('environments', () => {
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
      await unauthed.environments.list()
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── list ────────────────────────────────────────────

  it('list() returns the seeded app', async () => {
    const environments = await authed.environments.list()
    expect(environments).toBeInstanceOf(Array)
    const seeded = environments.find((p) => p.name === 'Test Environment')
    expect(seeded).toBeDefined()
    expect(seeded!.templateId).toBe('react-router')
  })

  // ── CRUD cycle ──────────────────────────────────────

  let environmentId: string

  it('create() creates an app', async () => {
    const app = await authed.environments.create({
      name: `sdk-test-${Date.now()}`,
      templateId: 'react-router',
    })
    expect(app.id).toBeTypeOf('string')
    expect(app.templateId).toBe('react-router')
    environmentId = app.id
  })

  it('get() returns the created app', async () => {
    const app = await authed.environments.get(environmentId)
    expect(app.id).toBe(environmentId)
    expect(app.templateId).toBe('react-router')
  })

  it('update() renames the app', async () => {
    const newName = `renamed-${Date.now()}`
    const app = await authed.environments.update(environmentId, { name: newName })
    expect(app.name).toBe(newName)
  })

  it('update() sets optional fields', async () => {
    const app = await authed.environments.update(environmentId, {
      githubRepo: 'org/repo',
    })
    expect(app.githubRepo).toBe('org/repo')
  })

  it('delete() removes the app', async () => {
    await authed.environments.delete(environmentId)
    try {
      await authed.environments.get(environmentId)
      expect.fail('Expected 404')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(404)
    }
  })

  // ── error cases ─────────────────────────────────────

  it('get() returns 404 for non-existent app', async () => {
    try {
      await authed.environments.get('00000000-0000-0000-0000-000000000000')
      expect.fail('Expected 404')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(404)
    }
  })

  it('create() returns 400 without a name', async () => {
    try {
      await authed.environments.create({ name: '' })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(400)
    }
  })

  // ── cross-org isolation ─────────────────────────────
  // User B (outsider) should never be able to read, update,
  // or delete environments belonging to User A's org.

  describe('cross-org isolation', () => {
    let targetAppId: string

    beforeAll(async () => {
      const app = await authed.environments.create({
        name: `isolation-target-${Date.now()}`,
      })
      targetAppId = app.id
    })

    it('outsider cannot list environments from another org', async () => {
      const environments = await outsider.environments.list()
      const leaked = environments.find((p) => p.id === targetAppId)
      expect(leaked).toBeUndefined()
    })

    it('outsider cannot read an app from another org', async () => {
      try {
        await outsider.environments.get(targetAppId)
        expect.fail('Expected 404')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(404)
      }
    })

    it('outsider cannot update an app from another org', async () => {
      try {
        await outsider.environments.update(targetAppId, { name: 'hacked' })
        expect.fail('Expected 404')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(404)
      }
    })

    it('outsider cannot delete an app from another org', async () => {
      try {
        await outsider.environments.delete(targetAppId)
        expect.fail('Expected 404')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(404)
      }
    })

    it('app still exists after outsider attack attempts', async () => {
      const app = await authed.environments.get(targetAppId)
      expect(app.id).toBe(targetAppId)
      expect(app.name).toContain('isolation-target-')
    })
  })

  // ── sync ──────────────────────────────────────────────

  describe('sync', () => {
    it('sync() creates a new app', async () => {
      const result = await authed.environments.sync({
        name: `sync-new-${Date.now()}`,
      })
      expect(result.app.id).toBeTypeOf('string')
      expect(result.app.name).toContain('sync-new-')
      expect(result.secrets.stored).toBe(0)
    })

    it('sync() upserts an existing app by ID', async () => {
      const first = await authed.environments.sync({
        name: `sync-upsert-${Date.now()}`,
        templateId: 'react-router',
      })

      const newName = `sync-updated-${Date.now()}`
      const second = await authed.environments.sync({
        id: first.app.id,
        name: newName,
      })

      expect(second.app.id).toBe(first.app.id)
      expect(second.app.name).toBe(newName)
    })

    it('sync() sets vercel fields', async () => {
      const result = await authed.environments.sync({
        name: `sync-vercel-${Date.now()}`,
        vercelProjectId: 'prj_test123',
        vercelOrgId: 'team_test456',
      })
      expect(result.app.vercelProjectId).toBe('prj_test123')
      expect(result.app.vercelOrgId).toBe('team_test456')
    })

    it('sync() creates a new app when ID is not found', async () => {
      const result = await authed.environments.sync({
        id: '00000000-0000-0000-0000-000000000000',
        name: `sync-notfound-${Date.now()}`,
      })
      expect(result.app.id).not.toBe('00000000-0000-0000-0000-000000000000')
      expect(result.app.name).toContain('sync-notfound-')
    })

    it('sync() returns 400 without a name', async () => {
      try {
        await authed.environments.sync({ name: '' })
        expect.fail('Expected error')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(400)
      }
    })

    it('sync() returns 401 without a token', async () => {
      try {
        await unauthed.environments.sync({ name: 'no-auth' })
        expect.fail('Expected error')
      } catch (err) {
        expect(err).toBeInstanceOf(ViagenApiError)
        expect((err as ViagenApiError).status).toBe(401)
      }
    })

    it('outsider cannot sync to another org\'s app', async () => {
      const owned = await authed.environments.sync({
        name: `sync-isolation-${Date.now()}`,
      })

      // Outsider tries to sync with authed's app ID
      const result = await outsider.environments.sync({
        id: owned.app.id,
        name: 'hijack-attempt',
      })

      // Should create a new app in outsider's org, not modify the original
      expect(result.app.id).not.toBe(owned.app.id)
      expect(result.app.name).toBe('hijack-attempt')

      // Original app is untouched
      const original = await authed.environments.get(owned.app.id)
      expect(original.name).toContain('sync-isolation-')
    })
  })
})
