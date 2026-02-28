export interface Task {
  id: string;
  projectId: string;
  prompt: string;
  status: string;
  result: string | null;
  error: string | null;
  prUrl: string | null;
  workspaceId: string | null;
  branch: string;
  model: string;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** A task returned from the team-level endpoint, enriched with project context. */
export interface TeamTask extends Task {
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  projectName: string;
  githubRepo: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
}

export interface CreateTaskInput {
  prompt: string;
  branch?: string;
}

/** Input for creating a task at the team level (auto-creates project). */
export interface CreateTeamTaskInput {
  prompt: string;
  githubRepo: string;
  vercelProjectId: string;
  vercelProjectName?: string;
  branch?: string;
  model?: string;
}

export interface UpdateTaskInput {
  status?: string;
  result?: string | null;
  error?: string | null;
  prUrl?: string | null;
  workspaceId?: string | null;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export interface MergeResult {
  task: Task;
  merge: { merged: boolean; message: string };
}

export interface CreateTeamTaskResult {
  task: TeamTask;
  projectId: string;
}

export interface TasksClient {
  /** List tasks for a project, optionally filtered by status. */
  list(projectId: string, status?: string): Promise<Task[]>;
  /** Get a single task by ID. */
  get(projectId: string, taskId: string): Promise<Task>;
  /** Create a new task. */
  create(projectId: string, input: CreateTaskInput): Promise<Task>;
  /** Update a task (status, result, error, prUrl, workspaceId). */
  update(
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<Task>;
  /** Merge the PR for a task and mark it completed. */
  merge(projectId: string, taskId: string): Promise<MergeResult>;
  /** List all tasks across the team/org, optionally filtered by status. */
  listTeam(options?: { status?: string; limit?: number }): Promise<TeamTask[]>;
  /** Create a task at the team level. Auto-creates a project for the repo+vercel combo. */
  createTeam(input: CreateTeamTaskInput): Promise<CreateTeamTaskResult>;
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createTasksClient(
  _baseUrl: string,
  request: RequestFn,
): TasksClient {
  return {
    async list(projectId, status) {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const data = await request<{ tasks: Task[] }>(
        `/api/projects/${projectId}/tasks${qs}`,
      );
      return data.tasks;
    },

    async get(projectId, taskId) {
      const data = await request<{ task: Task }>(
        `/api/projects/${projectId}/tasks/${taskId}`,
      );
      return data.task;
    },

    async create(projectId, input) {
      const data = await request<{ task: Task }>(
        `/api/projects/${projectId}/tasks`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      return data.task;
    },

    async update(projectId, taskId, input) {
      const data = await request<{ task: Task }>(
        `/api/projects/${projectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      );
      return data.task;
    },

    async merge(projectId, taskId) {
      return request<MergeResult>(
        `/api/projects/${projectId}/tasks/${taskId}/merge`,
        {
          method: "POST",
        },
      );
    },

    async listTeam(options) {
      const params = new URLSearchParams();
      if (options?.status) params.set("status", options.status);
      if (options?.limit) params.set("limit", String(options.limit));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await request<{ tasks: TeamTask[] }>(`/api/tasks${qs}`);
      return data.tasks;
    },

    async createTeam(input) {
      return request<CreateTeamTaskResult>(`/api/tasks`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  };
}
