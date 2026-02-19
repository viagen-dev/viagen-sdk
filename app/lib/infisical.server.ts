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

export async function setProjectSecret(orgId: string, viagenProjectId: string, key: string, value: string): Promise<void> {
  return setSecret(`${orgId}/${viagenProjectId}`, key, value)
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

async function ensureFolder(secretPath: string): Promise<void> {
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

export async function setSecret(orgId: string, key: string, value: string): Promise<void> {
  const token = await getAccessToken()
  await ensureFolder(orgId)

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
