import 'dotenv/config'

const INFISICAL_API = 'https://app.infisical.com'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const res = await fetch(`${INFISICAL_API}/api/v1/auth/universal-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      clientId: process.env.INFISICAL_CLIENT_ID!,
      clientSecret: process.env.INFISICAL_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Infisical auth failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  cachedToken = {
    accessToken: data.accessToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
  }
  return cachedToken.accessToken
}

const projectId = () => process.env.INFISICAL_PROJECT_ID!
const environment = 'dev'

export async function getProjectSecret(orgId: string, viagenProjectId: string, key: string): Promise<string | null> {
  return getSecret(`${orgId}/${viagenProjectId}`, key)
}

export async function setProjectSecret(orgId: string, viagenProjectId: string, key: string, value: string, opts?: { skipEnsure?: boolean }): Promise<void> {
  return setSecret(`${orgId}/${viagenProjectId}`, key, value, opts)
}

export async function deleteProjectSecret(orgId: string, viagenProjectId: string, key: string): Promise<void> {
  return deleteSecret(`${orgId}/${viagenProjectId}`, key)
}

export async function getSecret(orgId: string, key: string): Promise<string | null> {
  const token = await getAccessToken()
  const url = new URL(`${INFISICAL_API}/api/v3/secrets/raw/${key}`)
  url.searchParams.set('workspaceId', projectId())
  url.searchParams.set('environment', environment)
  url.searchParams.set('secretPath', `/${orgId}`)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Infisical get failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.secret?.secretValue ?? null
}

export async function ensureFolder(secretPath: string): Promise<void> {
  const token = await getAccessToken()
  const segments = secretPath.split('/').filter(Boolean)
  let currentPath = '/'

  for (const segment of segments) {
    const res = await fetch(`${INFISICAL_API}/api/v1/folders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: projectId(),
        environment,
        name: segment,
        path: currentPath,
      }),
    })
    if (!res.ok && res.status !== 400) {
      const body = await res.text()
      throw new Error(`Infisical folder create failed (${res.status}): ${body}`)
    }
    currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`
  }
}

export async function setSecret(orgId: string, key: string, value: string, opts?: { skipEnsure?: boolean }): Promise<void> {
  const token = await getAccessToken()
  if (!opts?.skipEnsure) await ensureFolder(orgId)

  const existing = await getSecret(orgId, key)

  if (existing !== null) {
    const res = await fetch(`${INFISICAL_API}/api/v3/secrets/raw/${key}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: projectId(),
        environment,
        secretPath: `/${orgId}`,
        secretValue: value,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Infisical update failed (${res.status}): ${body}`)
    }
  } else {
    const res = await fetch(`${INFISICAL_API}/api/v3/secrets/raw/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: projectId(),
        environment,
        secretPath: `/${orgId}`,
        secretValue: value,
        type: 'shared',
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Infisical create failed (${res.status}): ${body}`)
    }
  }
}

export async function listProjectSecrets(
  orgId: string,
  viagenProjectId: string,
): Promise<{ key: string; value: string }[]> {
  const token = await getAccessToken()
  const url = new URL(`${INFISICAL_API}/api/v3/secrets/raw`)
  url.searchParams.set('workspaceId', projectId())
  url.searchParams.set('environment', environment)
  url.searchParams.set('secretPath', `/${orgId}/${viagenProjectId}`)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 404) return []
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Infisical list failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return (data.secrets ?? []).map((s: any) => ({
    key: s.secretKey,
    value: s.secretValue,
  }))
}

export async function listOrgSecrets(orgId: string): Promise<{ key: string; value: string }[]> {
  const token = await getAccessToken()
  const url = new URL(`${INFISICAL_API}/api/v3/secrets/raw`)
  url.searchParams.set('workspaceId', projectId())
  url.searchParams.set('environment', environment)
  url.searchParams.set('secretPath', `/${orgId}`)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 404) return []
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Infisical list failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return (data.secrets ?? []).map((s: any) => ({
    key: s.secretKey,
    value: s.secretValue,
  }))
}

export interface ResolvedSecrets {
  project: { key: string; value: string }[]
  org: { key: string; value: string }[]
}

/** Fetch secrets from both scopes in parallel */
export async function resolveAllSecrets(
  orgId: string,
  projectId: string,
): Promise<ResolvedSecrets> {
  const [project, org] = await Promise.all([
    listProjectSecrets(orgId, projectId),
    listOrgSecrets(orgId),
  ])
  return { project, org }
}

/**
 * Merge secrets into a flat map: project > org.
 * Handles expired Claude OAuth tokens — if CLAUDE_TOKEN_EXPIRES indicates
 * the token is expired, CLAUDE_ACCESS_TOKEN and CLAUDE_REFRESH_TOKEN are
 * excluded so ANTHROPIC_API_KEY is used instead.
 */
export function flattenSecrets(resolved: ResolvedSecrets): Record<string, string> {
  const map: Record<string, string> = {}

  // Org (lower priority)
  for (const s of resolved.org) map[s.key] = s.value
  // Project (highest priority)
  for (const s of resolved.project) map[s.key] = s.value

  // Handle expired OAuth: if the token is expired, remove it so
  // consumers fall back to ANTHROPIC_API_KEY
  const expires = map['CLAUDE_TOKEN_EXPIRES']
  if (expires) {
    const expiresMs = Number(expires)
    if (!isNaN(expiresMs) && expiresMs < Date.now()) {
      delete map['CLAUDE_ACCESS_TOKEN']
      delete map['CLAUDE_REFRESH_TOKEN']
      delete map['CLAUDE_TOKEN_EXPIRES']
    }
  }

  return map
}

export async function deleteSecret(orgId: string, key: string): Promise<void> {
  const token = await getAccessToken()

  const res = await fetch(`${INFISICAL_API}/api/v3/secrets/raw/${key}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: projectId(),
      environment,
      secretPath: `/${orgId}`,
    }),
  })

  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    throw new Error(`Infisical delete failed (${res.status}): ${body}`)
  }
}
