import type { RequestFn } from './projects.js'

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
}

export interface VercelListProjectsParams {
  search?: string
  limit?: number
  from?: string
  teamId?: string
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
  teamId?: string
}

export interface VercelClient {
  /** Check if the org has a Vercel token configured. */
  isConnected(): Promise<boolean>
  /** Set the org's Vercel access token. Admin only. */
  setToken(token: string): Promise<void>
  /** Remove the org's Vercel access token. Admin only. */
  removeToken(): Promise<void>
  /** List Vercel projects for the org. */
  listProjects(params?: VercelListProjectsParams): Promise<VercelListProjectsResponse>
  /** Create a Vercel project. Admin only. */
  createProject(input: VercelCreateProjectInput): Promise<VercelProject>
}

export function createVercelClient(_baseUrl: string, request: RequestFn): VercelClient {
  return {
    async isConnected() {
      const data = await request<{ configured: boolean }>('/vercel/token')
      return data.configured
    },

    async setToken(token) {
      await request<{ success: boolean }>('/vercel/token', {
        method: 'PUT',
        body: JSON.stringify({ token }),
      })
    },

    async removeToken() {
      await request<{ success: boolean }>('/vercel/token', { method: 'DELETE' })
    },

    async listProjects(params) {
      const qs = new URLSearchParams()
      if (params?.search) qs.set('search', params.search)
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.from) qs.set('from', params.from)
      if (params?.teamId) qs.set('teamId', params.teamId)
      const query = qs.toString()
      return request<VercelListProjectsResponse>(`/vercel/projects${query ? `?${query}` : ''}`)
    },

    async createProject(input) {
      const data = await request<{ project: VercelProject }>('/vercel/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.project
    },
  }
}
