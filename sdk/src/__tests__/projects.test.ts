import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
    if (TOKEN_OTHER) {
      outsider = createViagen({ baseUrl: BASE_URL, token: TOKEN_OTHER })
    }
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

  it('list() returns seeded projects', async () => {
    const projects = await authed.projects.list()
    expect(projects).toBeInstanceOf(Array)
    expect(projects.length).toBeGreaterThan(0)
  })

  // ── CRUD cycle ───────────────────────────────────────

  let projectId: string

  it('create() creates a project', async () => {
    const project = await authed.projects.create({
      name: `sdk-test-project-${Date.now()}`,
      taskPrefix: 'TST',
    })
    expect(project.id).toBeTypeOf('string')
    expect(project.name).toContain('sdk-test-project-')
    expect(project.taskPrefix).toBe('TST')
    expect(project.isDefault).toBe(false)
    projectId = project.id
  })

  it('list() includes the created project', async () => {
    const projects = await authed.projects.list()
    expect(projects.some((p) => p.id === projectId)).toBe(true)
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

  it('create() returns 401 without a token', async () => {
    try {
      await unauthed.projects.create({ name: 'should-fail' })
      expect.fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(ViagenApiError)
      expect((err as ViagenApiError).status).toBe(401)
    }
  })

  // ── PATCH (update) ────────────────────────────────────

  it('PATCH updates the project name', async () => {
    const newName = `updated-project-${Date.now()}`
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ id: projectId, name: newName }),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { project: { id: string; name: string } }
    expect(data.project.id).toBe(projectId)
    expect(data.project.name).toBe(newName)
  })

  it('PATCH updates the project description', async () => {
    const description = 'This is a test project description with specs.'
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ id: projectId, description }),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { project: { id: string; description: string | null } }
    expect(data.project.id).toBe(projectId)
    expect(data.project.description).toBe(description)
  })

  it('PATCH clears description when set to empty string', async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ id: projectId, description: '' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { project: { description: string | null } }
    // Empty string becomes null or empty — either is acceptable
    expect(data.project.description === null || data.project.description === '').toBe(true)
  })

  it('PATCH returns 400 when id is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ name: 'no-id' }),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBeTruthy()
  })

  it('PATCH returns 400 when name is empty string', async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ id: projectId, name: '' }),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBeTruthy()
  })

  it('PATCH returns 401 without a token', async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: projectId, name: 'hacked' }),
    })
    expect(res.status).toBe(401)
  })

  it('PATCH returns 404 for non-existent project', async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000', name: 'ghost' }),
    })
    expect(res.status).toBe(404)
  })

  // ── Project attachments: GET (list) ──────────────────

  it('GET /api/projects/:id/attachments returns 200 with empty list', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { attachments: unknown[] }
    expect(data.attachments).toBeInstanceOf(Array)
    expect(data.attachments.length).toBe(0)
  })

  it('GET /api/projects/:id/attachments returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`)
    expect(res.status).toBe(401)
  })

  it('GET /api/projects/:id/attachments returns 404 for non-existent project', async () => {
    const res = await fetch(
      `${BASE_URL}/api/projects/00000000-0000-0000-0000-000000000000/attachments`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    )
    expect(res.status).toBe(404)
  })

  // ── Project attachments: POST (upload) ───────────────

  it('POST /api/projects/:id/attachments returns 400 when file field is missing', async () => {
    const formData = new FormData()
    // No file field
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: formData,
    })
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBeTruthy()
  })

  it('POST /api/projects/:id/attachments returns 401 without token', async () => {
    const formData = new FormData()
    formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt')
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
      method: 'POST',
      body: formData,
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/projects/:id/attachments returns 404 for non-existent project', async () => {
    const formData = new FormData()
    formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt')
    const res = await fetch(
      `${BASE_URL}/api/projects/00000000-0000-0000-0000-000000000000/attachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: formData,
      },
    )
    expect(res.status).toBe(404)
  })

  // ── Project attachments: DELETE ───────────────────────

  it('DELETE /api/projects/:id/attachments returns 400 when attachmentId is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBeTruthy()
  })

  it('DELETE /api/projects/:id/attachments returns 404 for non-existent attachment', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ attachmentId: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(res.status).toBe(404)
  })

  it('DELETE /api/projects/:id/attachments returns 401 without token', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachmentId: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(res.status).toBe(401)
  })

  // ── Method not allowed ───────────────────────────────

  it('PUT /api/projects/:id/attachments returns 405', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(405)
  })

  // ── Cross-org isolation ──────────────────────────────

  describe.skipIf(!TOKEN_OTHER)('cross-org isolation', () => {
    it('outsider cannot PATCH a project from another org', async () => {
      const res = await fetch(`${BASE_URL}/api/projects`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN_OTHER}`,
        },
        body: JSON.stringify({ id: projectId, name: 'hacked-by-outsider' }),
      })
      // Should return 404 (project not in outsider's org)
      expect(res.status).toBe(404)
    })

    it('outsider cannot list attachments for a project from another org', async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
        headers: { Authorization: `Bearer ${TOKEN_OTHER}` },
      })
      expect(res.status).toBe(404)
    })

    it('outsider cannot upload an attachment to a project from another org', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt')
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN_OTHER}` },
        body: formData,
      })
      expect(res.status).toBe(404)
    })
  })

  // ── Cleanup ──────────────────────────────────────────

  afterAll(async () => {
    if (projectId) {
      try {
        await authed.projects.delete(projectId)
      } catch {
        // best-effort cleanup
      }
    }
  })
})
