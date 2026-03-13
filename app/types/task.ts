import type { Attachment } from "~/components/task-attachments";

export interface Project {
  id: string;
  name: string;
  templateId: string | null;
  taskPrefix: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
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
  projectId: string;
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
  projectName: string;
  taskPrefix: string | null;
  githubRepo: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
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
