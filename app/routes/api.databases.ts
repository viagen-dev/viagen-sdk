import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { databases } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSecret, setSecret, deleteSecret } from '~/lib/infisical.server'
import { createNeonProject, deleteNeonProject } from '~/lib/neon.server'
import { log } from '~/lib/logger.server'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

  const rows = await db
    .select()
    .from(databases)
    .where(eq(databases.organizationId, org.id))

  log.info({ orgId: org.id, count: rows.length }, 'databases list')
  return Response.json({ databases: rows })
}

export async function action({ request }: { request: Request }) {
  const { role, user, org } = await requireAuth(request)

  // ── POST: Add a new data source ────────────────────
  if (request.method === 'POST') {
    if (role !== 'admin') {
      log.warn({ userId: user.id, orgId: org.id }, 'database create denied: not admin')
      return Response.json({ error: 'Admin role required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const provider = body.provider ?? 'manual'
    const dbName = body.name
    const type = body.type ?? 'pg'
    const region = body.region ?? 'aws-us-east-2'

    if (!dbName || typeof dbName !== 'string' || !dbName.trim()) {
      return Response.json({ error: 'name is required' }, { status: 400 })
    }

    if (provider === 'manual') {
      const connectionString = body.connectionString
      if (!connectionString || typeof connectionString !== 'string') {
        return Response.json({ error: 'connectionString is required for manual provider' }, { status: 400 })
      }

      try {
        log.info({ orgId: org.id, provider, type }, 'database manual add: starting')

        const [database] = await db
          .insert(databases)
          .values({
            organizationId: org.id,
            name: dbName.trim(),
            type,
            provider: 'manual',
            providerMeta: null,
            status: 'ready',
            createdBy: user.id,
          })
          .returning()

        await setSecret(`${org.id}/databases/${database.id}`, 'CONNECTION_URL', connectionString)
        log.info({ orgId: org.id, databaseId: database.id }, 'database added manually')
        return Response.json({ database })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add database'
        log.error({ orgId: org.id, err }, 'database manual add failed')
        return Response.json({ error: message }, { status: 500 })
      }
    }

    if (provider === 'neon') {
      const neonApiKey = await getSecret(org.id, 'NEON_API_KEY').catch(() => null)
      if (!neonApiKey) {
        log.warn({ orgId: org.id }, 'database provision: NEON_API_KEY not configured')
        return Response.json({
          error: 'Neon API key not configured. Add NEON_API_KEY in team settings.',
        }, { status: 400 })
      }

      try {
        log.info({ orgId: org.id, provider, region }, 'database provision: starting')

        const neonResult = await createNeonProject(neonApiKey, {
          name: `viagen-${dbName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)}`,
          region,
        })

        const connectionUri = neonResult.connection_uris[0]?.connection_uri
        if (!connectionUri) {
          throw new Error('No connection URI returned from Neon')
        }

        const providerMeta = JSON.stringify({
          neonProjectId: neonResult.project.id,
          neonBranchId: neonResult.branch.id,
          neonEndpointId: neonResult.endpoints[0]?.id ?? null,
          neonDatabaseName: neonResult.databases[0]?.name ?? 'neondb',
          neonRoleName: neonResult.roles[0]?.name ?? 'neondb_owner',
          region,
        })

        const [database] = await db
          .insert(databases)
          .values({
            organizationId: org.id,
            name: dbName.trim(),
            type: 'pg',
            provider: 'neon',
            providerMeta,
            status: 'ready',
            createdBy: user.id,
          })
          .returning()

        await setSecret(`${org.id}/databases/${database.id}`, 'CONNECTION_URL', connectionUri)
        log.info({ orgId: org.id, databaseId: database.id }, 'database provisioned via Neon')
        return Response.json({ database })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to provision database'
        log.error({ orgId: org.id, err }, 'database provision failed')
        return Response.json({ error: message }, { status: 500 })
      }
    }

    return Response.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
  }

  // ── DELETE: Remove a data source ───────────────────
  if (request.method === 'DELETE') {
    if (role !== 'admin') {
      log.warn({ userId: user.id, orgId: org.id }, 'database delete denied: not admin')
      return Response.json({ error: 'Admin role required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const databaseId = body.id
    if (!databaseId) {
      return Response.json({ error: 'id is required' }, { status: 400 })
    }

    const [database] = await db
      .select()
      .from(databases)
      .where(and(eq(databases.id, databaseId), eq(databases.organizationId, org.id)))

    if (!database) {
      return Response.json({ error: 'Database not found' }, { status: 404 })
    }

    try {
      await db
        .update(databases)
        .set({ status: 'deleting' })
        .where(eq(databases.id, database.id))

      if (database.provider === 'neon' && database.providerMeta) {
        const neonApiKey = await getSecret(org.id, 'NEON_API_KEY').catch(() => null)
        if (neonApiKey) {
          const meta = JSON.parse(database.providerMeta)
          await deleteNeonProject(neonApiKey, meta.neonProjectId)
        }
      }

      await deleteSecret(`${org.id}/databases/${database.id}`, 'CONNECTION_URL').catch(() => {})
      await db.delete(databases).where(eq(databases.id, database.id))

      log.info({ orgId: org.id, databaseId: database.id, provider: database.provider }, 'database deleted')
      return Response.json({ success: true })
    } catch (err) {
      log.error({ orgId: org.id, databaseId: database.id, err }, 'database delete failed')
      return Response.json({ error: 'Failed to delete database' }, { status: 500 })
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
