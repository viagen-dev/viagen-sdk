import { requireAuth } from '~/lib/session.server'
import { getSecret } from '~/lib/infisical.server'
import { listVercelProjects } from '~/lib/vercel.server'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

  const token = await getSecret(org.id, 'VERCEL_ACCESS_TOKEN').catch(() => null)
  if (!token) {
    return Response.json({ error: 'Vercel not connected' }, { status: 400 })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit')) || 20
  const search = url.searchParams.get('search') ?? undefined

  const data = await listVercelProjects(token, { limit, search })
  return Response.json({ projects: data.projects })
}
