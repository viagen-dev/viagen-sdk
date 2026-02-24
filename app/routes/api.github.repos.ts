import { requireAuth, isAdminRole } from '~/lib/session.server'
import { getSecret } from '~/lib/infisical.server'
import { log } from '~/lib/logger.server'

const GITHUB_TOKEN_KEY = 'GITHUB_TOKEN'

// ── POST: Create a new GitHub repository ──────────────────────────────────

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { user, org, role } = await requireAuth(request)

  if (!isAdminRole(role)) {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  const token = await getSecret(org.id, GITHUB_TOKEN_KEY)
  if (!token) {
    log.warn({ userId: user.id, orgId: org.id }, 'github create repo: token not configured')
    return Response.json({ error: 'GitHub access token not configured' }, { status: 400 })
  }

  const body = await request.json()
  const repoName = body.name?.trim()
  if (!repoName) {
    return Response.json({ error: 'Repository name is required' }, { status: 400 })
  }

  const templateRepo = body.templateRepo?.trim() // e.g. "viagen-dev/viagen-react-router"

  log.info(
    { userId: user.id, orgId: org.id, repoName, private: body.private ?? true, templateRepo: templateRepo ?? null },
    templateRepo ? 'github create repo: generating from template' : 'github create repo: creating repository',
  )

  let res: Response

  if (templateRepo) {
    // Use GitHub's template repository API: POST /repos/{template_owner}/{template_repo}/generate
    const ghUrl = `https://api.github.com/repos/${templateRepo}/generate`
    res = await fetch(ghUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'viagen-sdk',
      },
      body: JSON.stringify({
        name: repoName,
        private: body.private ?? true,
        description: body.description ?? '',
      }),
    })
  } else {
    res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'viagen-sdk',
      },
      body: JSON.stringify({
        name: repoName,
        private: body.private ?? true,
        description: body.description ?? '',
        auto_init: true,
      }),
    })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      log.warn({ userId: user.id }, 'github create repo: token invalid or expired')
      return Response.json({ error: 'GitHub token is invalid or expired' }, { status: 401 })
    }
    if (res.status === 404 && templateRepo) {
      log.error({ userId: user.id, templateRepo }, 'github create repo: template not found — is it marked as a template repo in GitHub settings?')
      return Response.json(
        { error: `Template repo "${templateRepo}" not found. Ensure it exists and is marked as a Template Repository in GitHub settings.` },
        { status: 404 },
      )
    }
    if (res.status === 422) {
      log.warn({ userId: user.id, repoName }, 'github create repo: name already exists or invalid')
      return Response.json(
        { error: data.message ?? 'Repository name already exists or is invalid' },
        { status: 422 },
      )
    }
    log.error({ userId: user.id, status: res.status, body: data }, 'github create repo: upstream error')
    return Response.json({ error: 'Failed to create GitHub repository' }, { status: 502 })
  }

  const r = await res.json()
  const repo = {
    id: r.id,
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    defaultBranch: r.default_branch,
    url: r.html_url,
  }

  log.info({ userId: user.id, repo: repo.fullName }, 'github create repo: success')
  return Response.json({ repo }, { status: 201 })
}

// ── GET: List GitHub repositories ─────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { user, org } = await requireAuth(request)

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
      log.warn({ userId: user.id }, 'github repos: token invalid or expired')
      return Response.json({ error: 'GitHub token is invalid or expired' }, { status: 401 })
    }
    log.error({ userId: user.id, status: res.status }, 'github repos: upstream error')
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
