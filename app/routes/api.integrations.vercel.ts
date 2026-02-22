import { requireAuth } from '~/lib/session.server'
import { deleteSecret } from '~/lib/infisical.server'
import { log } from '~/lib/logger.server'

const VERCEL_TOKEN_KEY = 'VERCEL_TOKEN'

export async function action({ request }: { request: Request }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { user, org } = await requireAuth(request)

  await deleteSecret(org.id, VERCEL_TOKEN_KEY)
  log.info({ userId: user.id, orgId: org.id }, 'vercel integration disconnected')
  return Response.json({ success: true })
}
