/**
 * Integration tests — SDK against a running API server.
 *
 * Requires:
 *   VIAGEN_TEST_URL    — e.g. http://localhost:5175
 *   VIAGEN_TEST_TOKEN  — a valid API token (create via CLI authorize flow)
 *
 * Run:
 *   VIAGEN_TEST_URL=http://localhost:5175 VIAGEN_TEST_TOKEN=abc123 npm test -w sdk
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createViagen, type ViagenClient } from '../index.js'

const BASE_URL = process.env.VIAGEN_TEST_URL
const TOKEN = process.env.VIAGEN_TEST_TOKEN

describe.skipIf(!BASE_URL || !TOKEN)('SDK → API integration', () => {
  let viagen: ViagenClient

  beforeAll(() => {
    viagen = createViagen({ baseUrl: BASE_URL!, token: TOKEN! })
  })

  // ── auth ──────────────────────────────────────────────

  describe('auth', () => {
    it('me() returns the authenticated user', async () => {
      const user = await viagen.auth.me()
      expect(user).not.toBeNull()
      expect(user!.id).toBeTypeOf('string')
      expect(user!.email).toBeTypeOf('string')
      expect(user!.organizations).toBeInstanceOf(Array)
    })

    it('me() returns organizations with id, name, role', async () => {
      const user = await viagen.auth.me()
      expect(user!.organizations.length).toBeGreaterThan(0)
      const org = user!.organizations[0]
      expect(org.id).toBeTypeOf('string')
      expect(org.name).toBeTypeOf('string')
      expect(org.role).toBeTypeOf('string')
    })

    it('listTokens() returns an array of tokens', async () => {
      const tokens = await viagen.auth.listTokens()
      expect(tokens).toBeInstanceOf(Array)
      // The token we're using should appear in the list
      expect(tokens.length).toBeGreaterThan(0)
      const token = tokens[0]
      expect(token.id).toBeTypeOf('string')
      expect(token.name).toBeTypeOf('string')
      expect(token.prefix).toBeTypeOf('string')
      expect(token.createdAt).toBeTypeOf('string')
    })
  })

  // ── orgs ──────────────────────────────────────────────

  describe('orgs', () => {
    it('list() returns an array of orgs', async () => {
      const orgs = await viagen.orgs.list()
      expect(orgs).toBeInstanceOf(Array)
      expect(orgs.length).toBeGreaterThan(0)
    })

    it('list() returns orgs with id, name, role', async () => {
      const orgs = await viagen.orgs.list()
      const org = orgs[0]
      expect(org.id).toBeTypeOf('string')
      expect(org.name).toBeTypeOf('string')
      expect(org.role).toBeTypeOf('string')
    })

    it('create() creates an org and returns it', async () => {
      const name = `test-org-${Date.now()}`
      const org = await viagen.orgs.create({ name })
      expect(org.id).toBeTypeOf('string')
      expect(org.name).toBe(name)
    })
  })

  // ── projects ──────────────────────────────────────────

  describe('projects', () => {
    let createdProjectId: string

    it('list() returns an array', async () => {
      const projects = await viagen.projects.list()
      expect(projects).toBeInstanceOf(Array)
    })

    it('create() creates a project and returns it', async () => {
      const project = await viagen.projects.create({
        name: `test-project-${Date.now()}`,
        templateId: 'react-router',
      })
      expect(project.id).toBeTypeOf('string')
      expect(project.name).toContain('test-project-')
      expect(project.templateId).toBe('react-router')
      createdProjectId = project.id
    })

    it('get() returns the created project', async () => {
      const project = await viagen.projects.get(createdProjectId)
      expect(project.id).toBe(createdProjectId)
      expect(project.templateId).toBe('react-router')
    })

    it('update() updates the project name', async () => {
      const newName = `renamed-${Date.now()}`
      const project = await viagen.projects.update(createdProjectId, { name: newName })
      expect(project.name).toBe(newName)
    })

    it('delete() removes the project', async () => {
      await viagen.projects.delete(createdProjectId)

      // Verify it's gone
      try {
        await viagen.projects.get(createdProjectId)
        expect.fail('Expected get() to throw after delete')
      } catch (err: any) {
        expect(err.status).toBe(404)
      }
    })
  })
})
