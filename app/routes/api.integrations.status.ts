import { requireAuth } from '~/lib/session.server'
import { getSecret } from '~/lib/infisical.server'

const GITHUB_TOKEN_KEY = 'GITHUB_ACCESS_TOKEN'
const VERCEL_TOKEN_KEY = 'VERCEL_ACCESS_TOKEN'

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request)

  const safeGet = async (key: string): Promise<boolean> => {
    try {
      const val = await getSecret(`user/${user.id}`, key)
      return !!val
    } catch {
      return false
    }
  }

  const [github, vercel] = await Promise.all([
    safeGet(GITHUB_TOKEN_KEY),
    safeGet(VERCEL_TOKEN_KEY),
  ])

  return Response.json({ github, vercel })
}
