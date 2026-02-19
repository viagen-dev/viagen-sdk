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
}

export interface IntegrationStatus {
  github: boolean
  vercel: boolean
}

export interface VercelClient {
  /** Check integration connection status for the current org. */
  integrationStatus(): Promise<IntegrationStatus>
  /** Disconnect the org's Vercel integration. Admin only. */
  disconnect(): Promise<void>
  /** List Vercel projects for the org. */
  listProjects(params?: VercelListProjectsParams): Promise<VercelProject[]>
}

export function createVercelClient(_baseUrl: string, request: RequestFn): VercelClient {
  return {
    async integrationStatus() {
      return request<IntegrationStatus>('/api/integrations/status')
    },

    async disconnect() {
      await request<{ success: boolean }>('/api/integrations/vercel', { method: 'DELETE' })
    },

    async listProjects(params) {
      const qs = new URLSearchParams()
      if (params?.search) qs.set('search', params.search)
      if (params?.limit) qs.set('limit', String(params.limit))
      const query = qs.toString()
      const data = await request<{ projects: VercelProject[] }>(`/api/vercel/projects${query ? `?${query}` : ''}`)
      return data.projects
    },
  }
}
