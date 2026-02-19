import { requireAuth } from '~/lib/session.server'
import { getSecret } from '~/lib/infisical.server'

const GITHUB_TOKEN_KEY = 'GITHUB_ACCESS_TOKEN'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

  const token = await getSecret(org.id, GITHUB_TOKEN_KEY)
  if (!token) {
    return Response.json({ error: 'GitHub access token not configured' }, { status: 400 })
  }

  const url = new URL(request.url)
  const page = url.searchParams.get('page') ?? '1'
  const perPage = url.searchParams.get('per_page') ?? '30'

  const ghUrl = new URL('https://api.github.com/user/repos')
  ghUrl.searchParams.set('sort', 'updated')
  ghUrl.searchParams.set('direction', 'desc')
  ghUrl.searchParams.set('per_page', perPage)
  ghUrl.searchParams.set('page', page)

  const res = await fetch(ghUrl.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'viagen-sdk',
    },
  })

  if (!res.ok) {
    if (res.status === 401) {
      return Response.json({ error: 'GitHub token is invalid or expired' }, { status: 401 })
    }
    return Response.json({ error: 'Failed to fetch GitHub repos' }, { status: 502 })
  }

  const repos = await res.json()
  return Response.json({
    repos: repos.map((r: any) => ({
      id: r.id,
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      defaultBranch: r.default_branch,
      url: r.html_url,
    })),
  })
}
