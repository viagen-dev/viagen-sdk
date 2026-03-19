export interface Task {
  id: string
  environmentId: string
  prompt: string
  /** One of: "ready", "running", "validating", "completed", "timed_out" */
  status: string
  result: string | null
  error: string | null
  prUrl: string | null
  workspaceId: string | null
  branch: string
  model: string
  type: string
  createdBy: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
  prReviewStatus: string | null
}

export interface CreateTaskInput {
  prompt: string
  branch?: string
  type?: string
}

export interface UpdateTaskInput {
  status?: string
  prompt?: string
  environmentId?: string
  result?: string | null
  error?: string | null
  prUrl?: string | null
  workspaceId?: string | null
  durationMs?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  costUsd?: number | null
  prReviewStatus?: string | null
}

export interface MergeResult {
  task: Task
  merge: { merged: boolean; message: string }
}

export interface TeamTask extends Task {
  environmentName: string
  githubRepo: string | null
  vercelProjectId: string | null
  vercelProjectName: string | null
  creatorName: string | null
  creatorAvatarUrl: string | null
}

export interface CreateTeamTaskInput {
  prompt: string
  githubRepo: string
  vercelProjectId: string
  vercelProjectName?: string
  branch?: string
  model?: string
}

export interface CreateTeamTaskResult {
  task: TeamTask
  environmentId: string
}

export interface ListTeamOptions {
  status?: string
  limit?: number
}

export interface CancelTaskInput {
  closePr?: boolean
  newBranch?: string
}

export interface TaskAttachment {
  id: string
  taskId: string
  filename: string
  blobUrl: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface TasksClient {
  /** List tasks for an environment, optionally filtered by status. */
  list(environmentId: string, status?: string): Promise<Task[]>
  /** Get a single task by ID. */
  get(environmentId: string, taskId: string): Promise<Task>
  /** Create a new task. */
  create(environmentId: string, input: CreateTaskInput): Promise<Task>
  /** Update a task (status, result, error, prUrl, workspaceId). */
  update(environmentId: string, taskId: string, input: UpdateTaskInput): Promise<Task>
  /** Merge the PR for a task and mark it completed. */
  merge(environmentId: string, taskId: string): Promise<MergeResult>
  /** Cancel a task: stop sandbox, optionally close PR, reset to ready. */
  cancel(environmentId: string, taskId: string, input?: CancelTaskInput): Promise<Task>
  /** Upload a file attachment to a task. Task must be in 'ready' status. */
  addAttachment(environmentId: string, taskId: string, file: File | Blob, filename: string): Promise<TaskAttachment>
  /** List tasks across all environments in the org. */
  listTeam(options?: ListTeamOptions): Promise<TeamTask[]>
  /** Create a task with auto environment creation (find-or-create by repo + Vercel project). */
  createTeam(input: CreateTeamTaskInput): Promise<CreateTeamTaskResult>
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>

export function createTasksClient(_baseUrl: string, request: RequestFn): TasksClient {
  return {
    async list(environmentId, status) {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      const data = await request<{ tasks: Task[] }>(`/api/environments/${environmentId}/tasks${qs}`)
      return data.tasks
    },

    async get(environmentId, taskId) {
      const data = await request<{ task: Task }>(`/api/environments/${environmentId}/tasks/${taskId}`)
      return data.task
    },

    async create(environmentId, input) {
      const data = await request<{ task: Task }>(`/api/environments/${environmentId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.task
    },

    async update(environmentId, taskId, input) {
      const data = await request<{ task: Task }>(`/api/environments/${environmentId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      return data.task
    },

    async merge(environmentId, taskId) {
      return request<MergeResult>(`/api/environments/${environmentId}/tasks/${taskId}/merge`, {
        method: 'POST',
      })
    },

    async addAttachment(environmentId, taskId, file, filename) {
      const form = new FormData()
      form.append('file', file, filename)
      const data = await request<{ attachment: TaskAttachment }>(
        `/api/environments/${environmentId}/tasks/${taskId}/attachments`,
        { method: 'POST', body: form },
      )
      return data.attachment
    },

    async cancel(environmentId, taskId, input = {}) {
      const data = await request<{ task: Task }>(`/api/environments/${environmentId}/tasks/${taskId}/cancel`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.task
    },

    async listTeam(options) {
      const params = new URLSearchParams()
      if (options?.status) params.set('status', options.status)
      if (options?.limit) params.set('limit', String(options.limit))
      const qs = params.toString() ? `?${params.toString()}` : ''
      const data = await request<{ tasks: TeamTask[] }>(`/api/tasks${qs}`)
      return data.tasks
    },

    async createTeam(input) {
      return request<CreateTeamTaskResult>(`/api/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}
