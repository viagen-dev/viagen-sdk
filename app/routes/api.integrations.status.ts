import { requireAuth } from '~/lib/session.server'
import { getSecret } from '~/lib/infisical.server'

const GITHUB_TOKEN_KEY = 'GITHUB_TOKEN'
const VERCEL_TOKEN_KEY = 'VERCEL_TOKEN'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

  const safeGet = async (key: string): Promise<boolean> => {
    try {
      const val = await getSecret(org.id, key)
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
