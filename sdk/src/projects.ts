export interface Project {
  id: string
  organizationId: string
  name: string
  templateId: string | null
  vercelProjectId: string | null
  githubRepo: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  templateId?: string
  vercelProjectId?: string
  githubRepo?: string
}

export interface UpdateProjectInput {
  name?: string
  vercelProjectId?: string | null
  githubRepo?: string | null
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
  }
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>
