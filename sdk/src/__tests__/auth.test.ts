import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN

describe.skipIf(!TOKEN)('auth', () => {
  let authed: ViagenClient
  let unauthed: ViagenClient

  beforeAll(() => {
    authed = createViagen({ baseUrl: BASE_URL!, token: TOKEN! })
    unauthed = createViagen({ baseUrl: BASE_URL! })
  })

  // ── unauthorized ────────────────────────────────────

  it('me() returns null without a token', async () => {
    const user = await unauthed.auth.me()
    expect(user).toBeNull()
  })

  it('listTokens() returns 401 without a token', async () => {
    try {
      await unauthed.auth.listTokens()
      expect.fail('Expected 401')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── authenticated ───────────────────────────────────

  it('me() returns the authenticated user', async () => {
    const user = await authed.auth.me()
    expect(user).not.toBeNull()
    expect(user!.id).toBeTypeOf('string')
    expect(user!.email).toBe('test@viagen.dev')
    expect(user!.organizations).toBeInstanceOf(Array)
    expect(user!.organizations.length).toBeGreaterThan(0)
  })

  it('me() includes org membership with id, name, role', async () => {
    const user = await authed.auth.me()
    const org = user!.organizations[0]
    expect(org.id).toBeTypeOf('string')
    expect(org.name).toBe('Test Org')
    expect(org.role).toBe('admin')
  })

  it('listTokens() returns the seeded token', async () => {
    const tokens = await authed.auth.listTokens()
    expect(tokens).toBeInstanceOf(Array)
    expect(tokens.length).toBeGreaterThan(0)
    const token = tokens[0]
    expect(token.id).toBeTypeOf('string')
    expect(token.name).toBe('sdk-test')
    expect(token.prefix).toBeTypeOf('string')
    expect(token.createdAt).toBeTypeOf('string')
  })
})
