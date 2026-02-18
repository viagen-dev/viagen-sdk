import type { RequestFn } from './projects.js'

export interface GitHubRepo {
  id: number
  fullName: string
  name: string
  owner: string
  private: boolean
  defaultBranch: string
  url: string
}

export interface GitHubListReposParams {
  page?: number
  perPage?: number
}

export interface GitHubClient {
  /** List GitHub repos accessible to the org's connected GitHub account. */
  listRepos(params?: GitHubListReposParams): Promise<GitHubRepo[]>
}

export function createGitHubClient(_baseUrl: string, request: RequestFn): GitHubClient {
  return {
    async listRepos(params) {
      const qs = new URLSearchParams()
      if (params?.page) qs.set('page', String(params.page))
      if (params?.perPage) qs.set('per_page', String(params.perPage))
      const query = qs.toString()
      const data = await request<{ repos: GitHubRepo[] }>(`/github/repos${query ? `?${query}` : ''}`)
      return data.repos
    },
  }
}
