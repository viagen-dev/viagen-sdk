export interface Project {
  id: string
  organizationId: string
  name: string
  templateId: string | null
  vercelProjectId: string | null
  githubRepo: string | null
  gitBranch: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  templateId?: string
  vercelProjectId?: string
  githubRepo?: string
  gitBranch?: string
}

export interface UpdateProjectInput {
  name?: string
  vercelProjectId?: string | null
  githubRepo?: string | null
  gitBranch?: string
}

export interface SyncProjectInput {
  id?: string
  name: string
  templateId?: string
  githubRepo?: string
  gitBranch?: string
  secrets?: Record<string, string>
}

export interface SyncResult {
  project: Project
  secrets: { stored: number }
}

export interface ProjectSecret {
  key: string
  value: string
  source: 'project' | 'org'
}

export interface ClaudeStatus {
  connected: boolean
  source?: 'project' | 'org' | 'user'
  keyPrefix?: string
}

export interface ProjectsClient {
  /** List all projects in the current organization. */
  list(): Promise<Project[]>
  /** Create a new project. Admin only. */
  create(input: CreateProjectInput): Promise<Project>
  /** Get a single project by ID. */
  get(id: string): Promise<Project>
  /** Update a project. Admin only. */
  update(id: string, input: UpdateProjectInput): Promise<Project>
  /** Delete a project by ID. Admin only. */
  delete(id: string): Promise<void>
  /** Get Claude API key status for a project (resolves project > org > user). */
  getClaudeStatus(id: string): Promise<ClaudeStatus>
  /** Set Anthropic API key for a project. Admin only. */
  setClaudeKey(id: string, apiKey: string): Promise<void>
  /** Remove project-level Anthropic API key. Admin only. */
  removeClaudeKey(id: string): Promise<void>
  /** Sync a project (upsert) with optional secrets. Admin only. */
  sync(input: SyncProjectInput): Promise<SyncResult>
  /** List all secrets for a project (project + inherited org). */
  listSecrets(id: string): Promise<ProjectSecret[]>
  /** Set a project secret. Admin only. */
  setSecret(id: string, key: string, value: string): Promise<void>
  /** Delete a project secret. Admin only. */
  deleteSecret(id: string, key: string): Promise<void>
}

export function createProjectsClient(_baseUrl: string, request: RequestFn): ProjectsClient {
  return {
    async list() {
      const data = await request<{ projects: Project[] }>('/api/projects')
      return data.projects
    },

    async create(input) {
      const data = await request<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.project
    },

    async get(id) {
      const data = await request<{ project: Project }>(`/api/projects/${id}`)
      return data.project
    },

    async update(id, input) {
      const data = await request<{ project: Project }>(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      return data.project
    },

    async delete(id) {
      await request<{ success: boolean }>(`/api/projects/${id}`, { method: 'DELETE' })
    },

    async getClaudeStatus(id) {
      return request<ClaudeStatus>(`/api/projects/${id}/claude`)
    },

    async setClaudeKey(id, apiKey) {
      await request<{ success: boolean }>(`/api/projects/${id}/claude`, {
        method: 'PUT',
        body: JSON.stringify({ apiKey }),
      })
    },

    async removeClaudeKey(id) {
      await request<{ success: boolean }>(`/api/projects/${id}/claude`, {
        method: 'DELETE',
      })
    },

    async sync(input) {
      return request<SyncResult>('/api/projects/sync', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async listSecrets(id) {
      const data = await request<{ secrets: ProjectSecret[] }>(`/api/projects/${id}/secrets`)
      return data.secrets
    },

    async setSecret(id, key, value) {
      await request<{ success: boolean }>(`/api/projects/${id}/secrets`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      })
    },

    async deleteSecret(id, key) {
      await request<{ success: boolean }>(`/api/projects/${id}/secrets`, {
        method: 'DELETE',
        body: JSON.stringify({ key }),
      })
    },
  }
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>
