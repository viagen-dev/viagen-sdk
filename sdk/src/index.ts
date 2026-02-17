import { createAuthClient, type AuthClient } from './auth.js'
import { createOrgsClient, type OrgsClient } from './orgs.js'
import { createProjectsClient, type ProjectsClient } from './projects.js'

export type { ViagenUser, OrgInfo, AuthResult, AuthClient } from './auth.js'
export type { OrgMembership, Org, OrgsClient } from './orgs.js'
export type { Project, CreateProjectInput, ProjectsClient } from './projects.js'

export interface ViagenConfig {
  baseUrl: string
}

export interface ViagenClient {
  auth: AuthClient
  orgs: OrgsClient
  projects: ProjectsClient
}

export class ViagenApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
  ) {
    super(message)
    this.name = 'ViagenApiError'
  }
}

export function createViagen(config: ViagenConfig): ViagenClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ViagenApiError(res.status, body.error ?? 'Request failed', body.message)
    }

    return res.json()
  }

  return {
    auth: createAuthClient(baseUrl),
    orgs: createOrgsClient(baseUrl, request),
    projects: createProjectsClient(baseUrl, request),
  }
}
