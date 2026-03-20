export interface Session {
  id: string;
  environmentId: string;
  environmentName: string | null;
  projectId: string | null;
  projectName: string | null;
  sandboxId: string;
  url: string;
  status: string; // "provisioning" | "running" | "stopped"
  name: string | null;
  branch: string;
  expiresAt: string;
  createdAt: string;
  taskId: string | null;
  taskType: string | null;
}

export interface StartSessionInput {
  environmentId: string;
  projectId?: string;
  name?: string;
  branch?: string;
}

export interface UpdateSessionInput {
  name?: string;
  projectId?: string | null;
}

export interface SessionsClient {
  /** List all sessions for the org. Optionally filter by projectId or environmentId. */
  list(filters?: { projectId?: string; environmentId?: string }): Promise<Session[]>;
  /** Get a single session by ID. */
  get(id: string): Promise<Session>;
  /** Start a new session (sandbox) on an environment. */
  start(input: StartSessionInput): Promise<Session>;
  /** Update a session's name or projectId. */
  update(id: string, input: UpdateSessionInput): Promise<Session>;
  /** Stop a session and delete its workspace. */
  stop(id: string): Promise<void>;
  /** Trigger async name backfill for a session. */
  generateName(workspaceId: string): Promise<Session>;
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createSessionsClient(_baseUrl: string, request: RequestFn): SessionsClient {
  return {
    async list(filters) {
      const params = new URLSearchParams();
      if (filters?.projectId) params.set("projectId", filters.projectId);
      if (filters?.environmentId) params.set("environmentId", filters.environmentId);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await request<{ sessions: Session[] }>(`/api/sessions${qs}`);
      return data.sessions;
    },

    async get(id) {
      const data = await request<{ session: Session }>(`/api/sessions/${id}`);
      return data.session;
    },

    async start(input) {
      const branch = input.branch ?? `sandbox-${Math.random().toString(36).slice(2, 8)}`;
      const data = await request<{ workspace: Session }>(
        `/api/environments/${input.environmentId}/sandbox`,
        {
          method: "POST",
          body: JSON.stringify({
            branch,
            name: input.name ?? null,
            projectId: input.projectId ?? null,
          }),
        },
      );
      return data.workspace;
    },

    async update(id, input) {
      const data = await request<{ session: Session }>(`/api/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      return data.session;
    },

    async stop(id) {
      await request<{ success: boolean }>(`/api/sessions/${id}`, {
        method: "DELETE",
      });
    },

    async generateName(workspaceId) {
      const data = await request<{ workspace: Session }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      return data.workspace;
    },
  };
}
