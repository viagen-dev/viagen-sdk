import { log } from '~/lib/logger.server'

const NEON_API = 'https://console.neon.tech/api/v2'

export class NeonApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'NeonApiError'
  }
}

async function neonFetch(apiKey: string, path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${NEON_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new NeonApiError(res.status, body.message ?? `Neon API error (${res.status})`)
  }
  return res
}

export interface NeonCreateProjectResponse {
  project: { id: string; name: string; region_id: string }
  connection_uris: Array<{
    connection_uri: string
    connection_parameters: { database: string; role: string; host: string }
  }>
  databases: Array<{ id: number; name: string; owner_name: string }>
  roles: Array<{ name: string; password: string }>
  branch: { id: string; name: string }
  endpoints: Array<{ id: string; host: string }>
}

export async function createNeonProject(
  apiKey: string,
  opts: { name: string; region?: string },
): Promise<NeonCreateProjectResponse> {
  log.info({ name: opts.name, region: opts.region }, 'neon: creating project')
  const res = await neonFetch(apiKey, '/projects', {
    method: 'POST',
    body: JSON.stringify({
      project: {
        name: opts.name,
        region_id: opts.region ?? 'aws-us-east-2',
        pg_version: 17,
      },
    }),
  })
  const data = await res.json()
  log.info({ neonProjectId: data.project.id }, 'neon: project created')
  return data
}

export async function deleteNeonProject(apiKey: string, neonProjectId: string): Promise<void> {
  log.info({ neonProjectId }, 'neon: deleting project')
  await neonFetch(apiKey, `/projects/${neonProjectId}`, { method: 'DELETE' })
  log.info({ neonProjectId }, 'neon: project deleted')
}
