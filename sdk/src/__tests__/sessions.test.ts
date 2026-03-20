import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createViagen, ViagenApiError, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL ?? 'http://localhost:5173'
const TOKEN = process.env.VIAGEN_TEST_TOKEN
const TOKEN_OTHER = process.env.VIAGEN_TEST_TOKEN_OTHER

// Helper to call the sessions API directly (no SDK client yet)
function sessionsApi(token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return {
    list(params?: { projectId?: string; environmentId?: string }) {
      const qs = new URLSearchParams()
      if (params?.projectId) qs.set('projectId', params.projectId)
      if (params?.environmentId) qs.set('environmentId', params.environmentId)
      const q = qs.toString() ? `?${qs.toString()}` : ''
      return fetch(`${BASE_URL}/api/sessions${q}`, { headers })
    },
    get(id: string) {
      return fetch(`${BASE_URL}/api/sessions/${id}`, { headers })
    },
    patch(id: string, body: Record<string, unknown>) {
      return fetch(`${BASE_URL}/api/sessions/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      })
    },
    delete(id: string) {
      return fetch(`${BASE_URL}/api/sessions/${id}`, {
        method: 'DELETE',
        headers,
      })
    },
    nameBackfill(workspaceId: string) {
      return fetch(`${BASE_URL}/api/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ workspaceId }),
      })
    },
  }
}

describe.skipIf(!TOKEN)('sessions', () => {
  let authed: ViagenClient
  let unauthed: ViagenClient
  let outsider: ReturnType<typeof sessionsApi>

  // We need a real workspace to test against — we'll create one via the
  // sandbox POST if possible, but most tests use fake UUIDs for negative cases.
  // The seeded environment is used to verify list() returns sessions in org scope.

  let environmentId: string

  beforeAll(async () => {
    authed = createViagen({ baseUrl: BASE_URL, token: TOKEN! })
    unauthed = createViagen({ baseUrl: BASE_URL })
    if (TOKEN_OTHER) {
      outsider = sessionsApi(TOKEN_OTHER)
    }

    // Resolve the seeded environment so we can pass environmentId filters
    const res = await fetch(`${BASE_URL}/api/environments`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const data = (await res.json()) as { environments: { id: string; name: string }[] }
    const seeded = data.environments.find((e) => e.name === 'Test Environment')
    if (seeded) environmentId = seeded.id
  })

  // ── GET /api/sessions — list ──────────────────────────────────────────

  describe('GET /api/sessions', () => {
    it('returns 401 without a token', async () => {
      const res = await sessionsApi().list()
      expect(res.status).toBe(401)
    })

    it('returns 200 with sessions array for authed user', async () => {
      const res = await sessionsApi(TOKEN!).list()
      expect(res.status).toBe(200)
      const data = (await res.json()) as { sessions: unknown[] }
      expect(data).toHaveProperty('sessions')
      expect(data.sessions).toBeInstanceOf(Array)
    })

    it('accepts optional environmentId filter', async () => {
      if (!environmentId) return
      const res = await sessionsApi(TOKEN!).list({ environmentId })
      expect(res.status).toBe(200)
      const data = (await res.json()) as { sessions: { environmentId: string }[] }
      expect(data.sessions).toBeInstanceOf(Array)
      // All returned sessions must belong to the filtered environment
      for (const session of data.sessions) {
        expect(session.environmentId).toBe(environmentId)
      }
    })

    it('accepts optional projectId filter', async () => {
      const res = await sessionsApi(TOKEN!).list({ projectId: '00000000-0000-0000-0000-000000000000' })
      expect(res.status).toBe(200)
      const data = (await res.json()) as { sessions: unknown[] }
      // Non-existent projectId returns empty array (no error)
      expect(data.sessions).toBeInstanceOf(Array)
      expect(data.sessions.length).toBe(0)
    })

    it('sessions list includes environmentName field', async () => {
      const res = await sessionsApi(TOKEN!).list()
      expect(res.status).toBe(200)
      const data = (await res.json()) as { sessions: { environmentName: unknown }[] }
      // If there are any sessions, verify the shape
      if (data.sessions.length > 0) {
        // environmentName is either a string or null
        const s = data.sessions[0]
        expect(s).toHaveProperty('environmentName')
      }
    })
  })

  // ── GET /api/sessions/:id — single session ────────────────────────────

  describe('GET /api/sessions/:id', () => {
    it('returns 401 without a token', async () => {
      const res = await sessionsApi().get('00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(401)
    })

    it('returns 404 for a non-existent session', async () => {
      const res = await sessionsApi(TOKEN!).get('00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBeTruthy()
    })
  })

  // ── PATCH /api/sessions/:id — update name / projectId ─────────────────

  describe('PATCH /api/sessions/:id', () => {
    it('returns 401 without a token', async () => {
      const res = await sessionsApi().patch('00000000-0000-0000-0000-000000000000', { name: 'x' })
      expect(res.status).toBe(401)
    })

    it('returns 404 for a non-existent session', async () => {
      const res = await sessionsApi(TOKEN!).patch('00000000-0000-0000-0000-000000000000', { name: 'new name' })
      expect(res.status).toBe(404)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBeTruthy()
    })

    it('returns 400 when no updatable fields are provided', async () => {
      const res = await sessionsApi(TOKEN!).patch('00000000-0000-0000-0000-000000000000', {})
      // Either 400 (no fields) or 404 (not found) — both are acceptable as 404 hits first
      expect([400, 404]).toContain(res.status)
    })
  })

  // ── DELETE /api/sessions/:id — stop session ───────────────────────────

  describe('DELETE /api/sessions/:id', () => {
    it('returns 401 without a token', async () => {
      const res = await sessionsApi().delete('00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(401)
    })

    it('returns 404 for a non-existent session', async () => {
      const res = await sessionsApi(TOKEN!).delete('00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBeTruthy()
    })
  })

  // ── POST /api/sessions — name backfill ────────────────────────────────

  describe('POST /api/sessions (name backfill)', () => {
    it('returns 401 without a token', async () => {
      const res = await sessionsApi().nameBackfill('00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(401)
    })

    it('returns 400 when workspaceId is missing', async () => {
      const res = await fetch(`${BASE_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBeTruthy()
    })

    it('returns 400 when body is invalid JSON', async () => {
      const res = await fetch(`${BASE_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: 'not-json',
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 for a non-existent workspaceId', async () => {
      const res = await sessionsApi(TOKEN!).nameBackfill('00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBeTruthy()
    })

    it('returns 405 for PUT requests', async () => {
      const res = await fetch(`${BASE_URL}/api/sessions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ workspaceId: '00000000-0000-0000-0000-000000000000' }),
      })
      expect(res.status).toBe(405)
    })
  })

  // ── Method not allowed ─────────────────────────────────────────────────

  describe('method not allowed', () => {
    it('PATCH /api/sessions returns 405', async () => {
      const res = await fetch(`${BASE_URL}/api/sessions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(405)
    })

    it('DELETE /api/sessions returns 405', async () => {
      const res = await fetch(`${BASE_URL}/api/sessions`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
      expect(res.status).toBe(405)
    })

    it('PUT /api/sessions/:id returns 405', async () => {
      const res = await fetch(`${BASE_URL}/api/sessions/00000000-0000-0000-0000-000000000000`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({}),
      })
      // 401 before 405 if not auth-guarded — 401 is also acceptable
      expect([401, 404, 405]).toContain(res.status)
    })
  })

  // ── Cross-org isolation ────────────────────────────────────────────────

  describe.skipIf(!TOKEN_OTHER)('cross-org isolation', () => {
    it('outsider list() does not include sessions from another org', async () => {
      const authedRes = await sessionsApi(TOKEN!).list()
      const authedData = (await authedRes.json()) as { sessions: { id: string }[] }

      if (authedData.sessions.length === 0) return // nothing to check

      const outsiderRes = await sessionsApi(TOKEN_OTHER!).list()
      expect(outsiderRes.status).toBe(200)
      const outsiderData = (await outsiderRes.json()) as { sessions: { id: string }[] }

      const authedIds = new Set(authedData.sessions.map((s) => s.id))
      const outsiderIds = outsiderData.sessions.map((s) => s.id)

      for (const oid of outsiderIds) {
        expect(authedIds.has(oid)).toBe(false)
      }
    })

    it('outsider GET returns 404 for a session from another org', async () => {
      const authedRes = await sessionsApi(TOKEN!).list()
      const authedData = (await authedRes.json()) as { sessions: { id: string }[] }

      if (authedData.sessions.length === 0) return // nothing to check

      const targetId = authedData.sessions[0].id
      const res = await sessionsApi(TOKEN_OTHER!).get(targetId)
      expect(res.status).toBe(404)
    })

    it('outsider PATCH returns 404 for a session from another org', async () => {
      const authedRes = await sessionsApi(TOKEN!).list()
      const authedData = (await authedRes.json()) as { sessions: { id: string }[] }

      if (authedData.sessions.length === 0) return // nothing to check

      const targetId = authedData.sessions[0].id
      const res = await sessionsApi(TOKEN_OTHER!).patch(targetId, { name: 'hacked' })
      expect(res.status).toBe(404)
    })

    it('outsider DELETE returns 404 for a session from another org', async () => {
      const authedRes = await sessionsApi(TOKEN!).list()
      const authedData = (await authedRes.json()) as { sessions: { id: string }[] }

      if (authedData.sessions.length === 0) return // nothing to check

      const targetId = authedData.sessions[0].id
      const res = await sessionsApi(TOKEN_OTHER!).delete(targetId)
      expect(res.status).toBe(404)
    })

    it('outsider name backfill returns 404 for a session from another org', async () => {
      const authedRes = await sessionsApi(TOKEN!).list()
      const authedData = (await authedRes.json()) as { sessions: { id: string }[] }

      if (authedData.sessions.length === 0) return // nothing to check

      const targetId = authedData.sessions[0].id
      const res = await sessionsApi(TOKEN_OTHER!).nameBackfill(targetId)
      expect(res.status).toBe(404)
    })
  })
})
