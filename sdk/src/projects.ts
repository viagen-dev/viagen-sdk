export interface Project {
  id: string
  organizationId: string
  name: string
  vercelProjectId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  vercelProjectId?: string
}

export interface ProjectsClient {
  /** List all projects in the current user's organization. */
  list(): Promise<Project[]>
  /** Create a new project. Admin only. */
  create(input: CreateProjectInput): Promise<Project>
  /** Get a single project by ID. */
  get(id: string): Promise<Project>
  /** Delete a project by ID. Admin only. */
  delete(id: string): Promise<void>
}

export function createProjectsClient(baseUrl: string, request: RequestFn): ProjectsClient {
  return {
    async list() {
      const data = await request<{ projects: Project[] }>('/projects')
      return data.projects
    },

    async create(input) {
      const data = await request<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.project
    },

    async get(id) {
      const data = await request<{ project: Project }>(`/projects/${id}`)
      return data.project
    },

    async delete(id) {
      await request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' })
    },
  }
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>
