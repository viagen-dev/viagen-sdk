export interface Project {
  id: string
  organizationId: string
  name: string
  taskPrefix: string | null
  githubRepo: string | null
  vercelProjectId: string | null
  vercelProjectName: string | null
  vercelOrgId: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  taskPrefix?: string
  githubRepo?: string
  vercelProjectId?: string
  vercelProjectName?: string
  vercelOrgId?: string
}

export interface ProjectsClient {
  /** List all projects for the current org. */
  list(): Promise<Project[]>
  /** Create a new project. Admin only. */
  create(input: CreateProjectInput): Promise<Project>
  /** Delete a project by ID. Admin only. Cannot delete the default Unassigned project. */
  delete(id: string): Promise<void>
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>

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

    async delete(id) {
      await request<{ success: boolean }>('/api/projects', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
    },
  }
}
