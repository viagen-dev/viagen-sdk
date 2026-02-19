import { requireAuth } from '~/lib/session.server'
import { deleteSecret } from '~/lib/infisical.server'

const VERCEL_TOKEN_KEY = 'VERCEL_ACCESS_TOKEN'

export async function action({ request }: { request: Request }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { role, org } = await requireAuth(request)
  if (role !== 'admin') {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  await deleteSecret(org.id, VERCEL_TOKEN_KEY)
  return Response.json({ success: true })
}
