import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN

describe.skipIf(!TOKEN)('deployments', () => {
  let authed: ViagenClient
  let unauthed: ViagenClient
  let projectId: string

  beforeAll(async () => {
    authed = createViagen({ baseUrl: BASE_URL, token: TOKEN! })
    unauthed = createViagen({ baseUrl: BASE_URL })

    const projects = await authed.projects.list()
    const seeded = projects.find((p) => p.name === 'Test Project')
    expect(seeded).toBeDefined()
    projectId = seeded!.id
  })

  // ── unauthorized ────────────────────────────────────

  it('list() returns 401 without a token', async () => {
    try {
      await unauthed.deployments.list(projectId)
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  it('redeploy() returns 401 without a token', async () => {
    try {
      await unauthed.deployments.redeploy(projectId)
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── list ────────────────────────────────────────────

  it('list() returns deployments array (possibly empty)', async () => {
    const deployments = await authed.deployments.list(projectId)
    expect(deployments).toBeInstanceOf(Array)
  })
})
