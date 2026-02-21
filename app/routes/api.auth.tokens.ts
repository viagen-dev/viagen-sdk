import { requireUser } from '~/lib/session.server'
import { listApiTokens, revokeApiToken } from '~/lib/auth.server'
import { log } from '~/lib/logger.server'

export async function loader({ request }: { request: Request }) {
  const { user } = await requireUser(request)
  const tokens = await listApiTokens(user.id)

  return Response.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.tokenPrefix,
      expiresAt: t.expiresAt,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt,
    })),
  })
}

export async function action({ request }: { request: Request }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { user } = await requireUser(request)
  const { tokenId } = await request.json()

  if (!tokenId) {
    return Response.json({ error: 'tokenId required' }, { status: 400 })
  }

  await revokeApiToken(tokenId, user.id)
  log.info({ userId: user.id, tokenId }, 'api token revoked')
  return Response.json({ success: true })
}
