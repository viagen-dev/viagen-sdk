const VERCEL_API = 'https://api.vercel.com'

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  link?: {
    type: string
    org: string
    repo: string
    productionBranch: string
  }
  latestDeployments?: {
    id: string
    url: string
    readyState: string
    createdAt: number
  }[]
}

export interface VercelListProjectsResponse {
  projects: VercelProject[]
  pagination: { count: number; next: string | null }
}

export interface VercelCreateProjectInput {
  name: string
  framework?: string
  gitRepository?: { type: 'github'; repo: string }
  rootDirectory?: string
  buildCommand?: string
}

export class VercelApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'VercelApiError'
  }
}

export async function listVercelProjects(
  token: string,
  params?: { teamId?: string; search?: string; limit?: number; from?: string },
): Promise<VercelListProjectsResponse> {
  const url = new URL(`${VERCEL_API}/v10/projects`)
  if (params?.teamId) url.searchParams.set('teamId', params.teamId)
  if (params?.search) url.searchParams.set('search', params.search)
  if (params?.limit) url.searchParams.set('limit', String(params.limit))
  if (params?.from) url.searchParams.set('from', params.from)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new VercelApiError(res.status, body.error?.message ?? 'Vercel API error')
  }

  return res.json()
}

export async function createVercelProject(
  token: string,
  input: VercelCreateProjectInput,
  teamId?: string,
): Promise<VercelProject> {
  const url = new URL(`${VERCEL_API}/v11/projects`)
  if (teamId) url.searchParams.set('teamId', teamId)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new VercelApiError(res.status, body.error?.message ?? 'Vercel API error')
  }

  return res.json()
}

// ── Environment Variables ────────────────────────────

export interface VercelEnvVar {
  id: string
  key: string
  value: string
  target: string[]
  type: string
}

export async function listVercelEnvVars(
  token: string,
  vercelProjectId: string,
): Promise<VercelEnvVar[]> {
  const url = new URL(`${VERCEL_API}/v9/projects/${vercelProjectId}/env`)
  url.searchParams.set('decrypt', 'true')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new VercelApiError(res.status, body.error?.message ?? 'Vercel API error')
  }

  const data = await res.json()
  return data.envs ?? []
}

export async function upsertVercelEnvVars(
  token: string,
  vercelProjectId: string,
  envVars: { key: string; value: string; target?: string[]; type?: string }[],
): Promise<void> {
  const url = new URL(`${VERCEL_API}/v10/projects/${vercelProjectId}/env`)
  url.searchParams.set('upsert', 'true')

  const body = envVars.map((v) => ({
    key: v.key,
    value: v.value,
    target: v.target ?? ['production', 'preview', 'development'],
    type: v.type ?? 'encrypted',
  }))

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}))
    throw new VercelApiError(res.status, resBody.error?.message ?? 'Vercel API error')
  }
}

export async function deleteVercelEnvVar(
  token: string,
  vercelProjectId: string,
  envVarId: string,
): Promise<void> {
  const res = await fetch(`${VERCEL_API}/v9/projects/${vercelProjectId}/env/${envVarId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}))
    throw new VercelApiError(res.status, body.error?.message ?? 'Vercel API error')
  }
}
