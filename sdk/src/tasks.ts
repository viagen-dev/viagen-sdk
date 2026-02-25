export interface Task {
  id: string
  projectId: string
  prompt: string
  status: string
  result: string | null
  error: string | null
  prUrl: string | null
  workspaceId: string | null
  branch: string
  model: string
  createdBy: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export interface CreateTaskInput {
  prompt: string
  branch?: string
}

export interface UpdateTaskInput {
  status?: string
  result?: string | null
  error?: string | null
  prUrl?: string | null
  workspaceId?: string | null
  durationMs?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
}

export interface MergeResult {
  task: Task
  merge: { merged: boolean; message: string }
}

export interface TasksClient {
  /** List tasks for a project, optionally filtered by status. */
  list(projectId: string, status?: string): Promise<Task[]>
  /** Get a single task by ID. */
  get(projectId: string, taskId: string): Promise<Task>
  /** Create a new task. */
  create(projectId: string, input: CreateTaskInput): Promise<Task>
  /** Update a task (status, result, error, prUrl, workspaceId). */
  update(projectId: string, taskId: string, input: UpdateTaskInput): Promise<Task>
  /** Merge the PR for a task and mark it completed. */
  merge(projectId: string, taskId: string): Promise<MergeResult>
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>

export function createTasksClient(_baseUrl: string, request: RequestFn): TasksClient {
  return {
    async list(projectId, status) {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      const data = await request<{ tasks: Task[] }>(`/api/projects/${projectId}/tasks${qs}`)
      return data.tasks
    },

    async get(projectId, taskId) {
      const data = await request<{ task: Task }>(`/api/projects/${projectId}/tasks/${taskId}`)
      return data.task
    },

    async create(projectId, input) {
      const data = await request<{ task: Task }>(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.task
    },

    async update(projectId, taskId, input) {
      const data = await request<{ task: Task }>(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      return data.task
    },

    async merge(projectId, taskId) {
      return request<MergeResult>(`/api/projects/${projectId}/tasks/${taskId}/merge`, {
        method: 'POST',
      })
    },
  }
}
