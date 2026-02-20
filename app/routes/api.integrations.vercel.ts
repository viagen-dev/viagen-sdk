import { requireAuth } from '~/lib/session.server'
import { deleteSecret } from '~/lib/infisical.server'

const VERCEL_TOKEN_KEY = 'VERCEL_ACCESS_TOKEN'

export async function action({ request }: { request: Request }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { user } = await requireAuth(request)

  await deleteSecret(`user/${user.id}`, VERCEL_TOKEN_KEY)
  return Response.json({ success: true })
}
