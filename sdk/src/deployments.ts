export interface Deployment {
  uid: string
  name: string
  url: string
  state: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED'
  created: number
  ready?: number
  meta?: {
    githubCommitRef?: string
    githubCommitSha?: string
    githubCommitMessage?: string
    githubCommitAuthorLogin?: string
  }
  target: string | null
  inspectorUrl?: string
  creator?: { username: string }
}

export interface DeploymentsClient {
  /** List recent Vercel deployments for a project. */
  list(projectId: string): Promise<Deployment[]>
  /** Trigger a redeploy for a project. Admin only. */
  redeploy(projectId: string, target?: 'production' | 'preview'): Promise<Deployment>
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>

export function createDeploymentsClient(_baseUrl: string, request: RequestFn): DeploymentsClient {
  return {
    async list(projectId) {
      const data = await request<{ deployments: Deployment[] }>(`/api/projects/${projectId}/deployments`)
      return data.deployments
    },

    async redeploy(projectId, target) {
      const data = await request<{ deployment: Deployment }>(`/api/projects/${projectId}/deployments`, {
        method: 'POST',
        body: JSON.stringify({ target }),
      })
      return data.deployment
    },
  }
}
