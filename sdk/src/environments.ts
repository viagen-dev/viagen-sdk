export interface Environment {
  id: string
  organizationId: string
  name: string
  kind: string
  domain: string | null
  templateId: string | null
  vercelProjectId: string | null
  vercelOrgId: string | null
  githubRepo: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateEnvironmentInput {
  name: string
  kind?: string
  domain?: string
  templateId?: string
  vercelProjectId?: string
  vercelOrgId?: string
  githubRepo?: string
}

export interface UpdateEnvironmentInput {
  name?: string
  kind?: string
  domain?: string | null
  vercelProjectId?: string | null
  vercelOrgId?: string | null
  githubRepo?: string | null
}

export interface SyncEnvironmentInput {
  id?: string
  name: string
  kind?: string
  domain?: string
  templateId?: string
  githubRepo?: string
  vercelProjectId?: string
  vercelOrgId?: string
  secrets?: Record<string, string>
}

export interface SyncResult {
  app: Environment
  secrets: { stored: number; failed: string[] }
  resolvedKeys: string[]
}

export interface EnvironmentSecret {
  key: string
  value: string
  source: 'environment' | 'org'
}

export interface EnvironmentDatabase {
  id: string
  projectId: string
  name: string
  type: string
  provider: string
  providerMeta: string | null
  status: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ProvisionDatabaseInput {
  name?: string
  provider?: string
  region?: string
}

export interface ClaudeStatus {
  connected: boolean
  source?: 'app' | 'org'
  keyPrefix?: string
}

export interface EnvironmentsClient {
  /** List all apps in the current organization. */
  list(): Promise<Environment[]>
  /** Create a new app. Admin only. */
  create(input: CreateEnvironmentInput): Promise<Environment>
  /** Get a single app by ID. */
  get(id: string): Promise<Environment>
  /** Update an app. Admin only. */
  update(id: string, input: UpdateEnvironmentInput): Promise<Environment>
  /** Delete an app by ID. Admin only. */
  delete(id: string): Promise<void>
  /** Get Claude API key status for an app (resolves app > org). */
  getClaudeStatus(id: string): Promise<ClaudeStatus>
  /** Set Anthropic API key for an app. Admin only. */
  setClaudeKey(id: string, apiKey: string): Promise<void>
  /** Remove app-level Anthropic API key. Admin only. */
  removeClaudeKey(id: string): Promise<void>
  /** Sync an app (upsert) with optional secrets. Admin only. */
  sync(input: SyncEnvironmentInput): Promise<SyncResult>
  /** List all secrets for an app (app + inherited org). */
  listSecrets(id: string): Promise<EnvironmentSecret[]>
  /** Pull all secrets for an app as a flat map with unmasked values. Admin only. */
  pullSecrets(id: string): Promise<Record<string, string>>
  /** Set an app secret. Admin only. */
  setSecret(id: string, key: string, value: string): Promise<void>
  /** Delete an app secret. Admin only. */
  deleteSecret(id: string, key: string): Promise<void>
  /** Get the database for an app. */
  getDatabase(id: string): Promise<EnvironmentDatabase | null>
  /** Provision a database for an app. Admin only. */
  provisionDatabase(id: string, input?: ProvisionDatabaseInput): Promise<EnvironmentDatabase>
  /** Delete the database for an app. Admin only. */
  deleteDatabase(id: string): Promise<void>
}

export function createEnvironmentsClient(_baseUrl: string, request: RequestFn): EnvironmentsClient {
  return {
    async list() {
      const data = await request<{ environments: Environment[] }>('/api/environments')
      return data.environments
    },

    async create(input) {
      const data = await request<{ environment: Environment }>('/api/environments', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.environment
    },

    async get(id) {
      const data = await request<{ environment: Environment }>(`/api/environments/${id}`)
      return data.environment
    },

    async update(id, input) {
      const data = await request<{ environment: Environment }>(`/api/environments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      return data.environment
    },

    async delete(id) {
      await request<{ success: boolean }>(`/api/environments/${id}`, { method: 'DELETE' })
    },

    async getClaudeStatus(id) {
      return request<ClaudeStatus>(`/api/environments/${id}/claude`)
    },

    async setClaudeKey(id, apiKey) {
      await request<{ success: boolean }>(`/api/environments/${id}/claude`, {
        method: 'PUT',
        body: JSON.stringify({ apiKey }),
      })
    },

    async removeClaudeKey(id) {
      await request<{ success: boolean }>(`/api/environments/${id}/claude`, {
        method: 'DELETE',
      })
    },

    async sync(input) {
      return request<SyncResult>('/api/environments/sync', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async listSecrets(id) {
      const data = await request<{
        environment: { key: string; value: string }[]
        org: { key: string; value: string }[]
      }>(`/api/environments/${id}/secrets`)
      return [
        ...data.environment.map((s) => ({ ...s, source: 'environment' as const })),
        ...data.org.map((s) => ({ ...s, source: 'org' as const })),
      ]
    },

    async pullSecrets(id) {
      const data = await request<{ secrets: Record<string, string> }>(`/api/environments/${id}/pull`)
      return data.secrets
    },

    async setSecret(id, key, value) {
      await request<{ success: boolean }>(`/api/environments/${id}/secrets`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      })
    },

    async deleteSecret(id, key) {
      await request<{ success: boolean }>(`/api/environments/${id}/secrets`, {
        method: 'DELETE',
        body: JSON.stringify({ key }),
      })
    },

    async getDatabase(id) {
      const data = await request<{ database: EnvironmentDatabase | null }>(`/api/environments/${id}/database`)
      return data.database
    },

    async provisionDatabase(id, input = {}) {
      const data = await request<{ database: EnvironmentDatabase }>(`/api/environments/${id}/database`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.database
    },

    async deleteDatabase(id) {
      await request<{ success: boolean }>(`/api/environments/${id}/database`, { method: 'DELETE' })
    },
  }
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>
