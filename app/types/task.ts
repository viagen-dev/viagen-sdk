import type { Attachment } from "~/components/task-attachments";

export interface Project {
  id: string;
  name: string;
  taskPrefix: string | null;
  githubRepo: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  isDefault: boolean;
  defaultEnvironmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Environment {
  id: string;
  name: string;
  templateId: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
  kind: string;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | "ready"
  | "running"
  | "validating"
  | "completed"
  | "timed_out";

export interface FeedTask {
  id: string;
  environmentId: string;
  title: string | null;
  prompt: string;
  model: string;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  prUrl: string | null;
  workspaceId: string | null;
  branch: string;
  taskNumber: number | null;
  createdBy: string;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  environmentName: string;
  taskPrefix: string | null;
  githubRepo: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  projectId: string | null;
  projectName: string | null;
  prReviewStatus: string | null;
  attachments?: Attachment[];
}

export interface Workspace {
  id: string;
  sandboxId: string;
  url: string;
  expiresAt: string;
  branch: string;
  taskId: string | null;
  taskType: string | null;
  status: string;
  createdAt: string;
}
