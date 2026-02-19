import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN

describe.skipIf(!TOKEN)('orgs', () => {
  let authed: ViagenClient
  let unauthed: ViagenClient

  beforeAll(() => {
    authed = createViagen({ baseUrl: BASE_URL, token: TOKEN! })
    unauthed = createViagen({ baseUrl: BASE_URL })
  })

  // ── unauthorized ────────────────────────────────────

  it('list() returns 401 without a token', async () => {
    try {
      await unauthed.orgs.list()
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── list ────────────────────────────────────────────

  it('list() returns the seeded org', async () => {
    const orgs = await authed.orgs.list()
    expect(orgs).toBeInstanceOf(Array)
    expect(orgs.length).toBeGreaterThan(0)
    const org = orgs.find((o) => o.name === 'Test Org')
    expect(org).toBeDefined()
    expect(org!.id).toBeTypeOf('string')
    expect(org!.role).toBe('admin')
  })

  // ── create ──────────────────────────────────────────

  it('create() creates an org and returns it', async () => {
    const name = `test-org-${Date.now()}`
    const org = await authed.orgs.create({ name })
    expect(org.id).toBeTypeOf('string')
    expect(org.name).toBe(name)
  })

  it('create() makes the creator appear in list', async () => {
    const name = `list-check-${Date.now()}`
    await authed.orgs.create({ name })
    const orgs = await authed.orgs.list()
    expect(orgs.find((o) => o.name === name)).toBeDefined()
  })

  // ── addMember ───────────────────────────────────────

  it('addMember() returns 400 for missing email', async () => {
    try {
      await authed.orgs.addMember({ email: '' })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(400)
    }
  })

  it('addMember() returns 404 for unknown user', async () => {
    try {
      await authed.orgs.addMember({ email: 'nobody@example.com' })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(404)
    }
  })
})
