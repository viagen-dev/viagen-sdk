import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { getSecret } from '../lib/infisical.js'

const GITHUB_TOKEN_KEY = 'GITHUB_ACCESS_TOKEN'

const githubRoutes = new Hono<AuthEnv>()

githubRoutes.use('*', requireAuth)

/** GET /github/repos — list repos accessible to the org's GitHub token. */
githubRoutes.get('/repos', async (c) => {
  const token = await getSecret(c.get('organizationId'), GITHUB_TOKEN_KEY)
  if (!token) {
    return c.json({ error: 'GitHub access token not configured' }, 400)
  }

  const page = c.req.query('page') ? Number(c.req.query('page')) : 1
  const perPage = c.req.query('per_page') ? Number(c.req.query('per_page')) : 30

  const url = new URL('https://api.github.com/user/repos')
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('direction', 'desc')
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'viagen-sdk',
    },
  })

  if (!res.ok) {
    if (res.status === 401) {
      return c.json({ error: 'GitHub token is invalid or expired' }, 401)
    }
    return c.json({ error: 'Failed to fetch GitHub repos' }, 502)
  }

  const repos = await res.json()
  return c.json({
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
})

export { githubRoutes }
