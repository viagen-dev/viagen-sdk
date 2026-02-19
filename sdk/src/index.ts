import { createAuthClient, type AuthClient } from './auth.js'
import { createOrgsClient, type OrgsClient } from './orgs.js'
import { createProjectsClient, type ProjectsClient } from './projects.js'
import { createVercelClient, type VercelClient } from './vercel.js'
import { createGitHubClient, type GitHubClient } from './github.js'

export type { ViagenUser, OrgInfo, AuthResult, AuthClient, ApiTokenInfo } from './auth.js'
export type { OrgMembership, Org, OrgsClient } from './orgs.js'
export type { Project, CreateProjectInput, UpdateProjectInput, ProjectsClient } from './projects.js'
export type { VercelProject, VercelListProjectsParams, IntegrationStatus, VercelClient } from './vercel.js'
export type { GitHubRepo, GitHubListReposParams, GitHubClient } from './github.js'
export { loadCredentials, saveCredentials, clearCredentials, type StoredCredentials } from './credentials.js'

export interface ViagenConfig {
  baseUrl: string
  /** API token for CLI/server-side usage. When set, uses Bearer auth instead of cookies. */
  token?: string
}

export interface ViagenClient {
  auth: AuthClient
  orgs: OrgsClient
  projects: ProjectsClient
  vercel: VercelClient
  github: GitHubClient
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

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>

export function createViagen(config: ViagenConfig): ViagenClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    }

    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`
    }

    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      ...(config.token ? {} : { credentials: 'include' as const }),
      headers,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ViagenApiError(res.status, body.error ?? 'Request failed', body.message)
    }

    return res.json()
  }

  return {
    auth: createAuthClient(baseUrl, request),
    orgs: createOrgsClient(baseUrl, request),
    projects: createProjectsClient(baseUrl, request),
    vercel: createVercelClient(baseUrl, request),
    github: createGitHubClient(baseUrl, request),
  }
}

/**
 * Create a Viagen client from stored CLI credentials.
 * Returns null if no credentials are stored.
 */
export async function createViagenFromCredentials(
  overrides?: Partial<ViagenConfig>,
): Promise<ViagenClient | null> {
  const { loadCredentials } = await import('./credentials.js')
  const creds = await loadCredentials()
  if (!creds) return null

  return createViagen({
    baseUrl: creds.baseUrl,
    token: creds.token,
    ...overrides,
  })
}
