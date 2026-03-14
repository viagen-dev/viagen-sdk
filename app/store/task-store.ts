import { useMemo } from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { FeedTask, Workspace } from "~/types/task";

interface TaskState {
  // ── Data ──────────────────────────────────────────────────────────────
  tasks: Record<string, FeedTask>;
  workspaces: Record<string, Workspace[]>;
  tasksLoaded: boolean;
  launchingTaskIds: Record<string, true>;

  // ── Actions ───────────────────────────────────────────────────────────
  /** Fetch all tasks for the org (GET /api/tasks). Merges into the map. */
  fetchAllTasks: () => Promise<void>;
  /** Fetch a single task by ID. Merges into the map. */
  fetchTask: (projectId: string, taskId: string) => Promise<void>;
  /** Fetch workspaces for a task. */
  fetchWorkspaces: (projectId: string, taskId: string) => Promise<void>;
  /** Optimistically set / update a task in the store. */
  setTask: (task: FeedTask) => void;
  /** Remove a task from the store. */
  removeTask: (taskId: string) => void;
  /** Mark a task as launching / not launching. */
  setLaunching: (taskId: string, v: boolean) => void;

  /**
   * Start polling all tasks. Returns a cleanup function.
   * Uses 8 s when active tasks exist, 30 s otherwise.
   */
  startPolling: () => () => void;

  /**
   * Start detail-level polling for a single task + its workspaces (5 s).
   * Returns a cleanup function.
   */
  startDetailPolling: (
    projectId: string,
    taskId: string,
  ) => () => void;
}

export const useTaskStore = create<TaskState>()(
  devtools(
    (set, get) => ({
      // ── Initial state ───────────────────────────────────────────────────
      tasks: {},
      workspaces: {},
      tasksLoaded: false,
      launchingTaskIds: {},

      // ── Actions ─────────────────────────────────────────────────────────

      fetchAllTasks: async () => {
        try {
          const res = await fetch("/api/tasks", { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          const incoming = (data.tasks ?? []) as FeedTask[];
          const current = get().tasks;
          // Build next map, skip update if nothing changed
          let changed = !get().tasksLoaded;
          const next = { ...current };
          for (const t of incoming) {
            // Preserve attachments loaded via fetchTask — the list endpoint doesn't include them
            const merged: FeedTask = current[t.id]?.attachments
              ? { ...t, attachments: current[t.id].attachments }
              : t;
            if (!changed && JSON.stringify(current[t.id]) !== JSON.stringify(merged)) {
              changed = true;
            }
            next[t.id] = merged;
          }
          if (changed) {
            set({ tasks: next, tasksLoaded: true });
          }
        } catch {
          // silently fail — tasks stay as-is
        }
      },

      fetchTask: async (projectId, taskId) => {
        try {
          const res = await fetch(
            `/api/projects/${projectId}/tasks/${taskId}`,
            { credentials: "include" },
          );
          if (!res.ok) return;
          const data = await res.json();
          if (data.task) {
            const existing = get().tasks[taskId];
            // Skip update if data is identical to avoid unnecessary re-renders
            const merged = { ...existing, ...data.task };
            if (existing && JSON.stringify(existing) === JSON.stringify(merged)) return;
            set((s) => ({
              tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], ...data.task } },
            }));
          }
        } catch {
          // silently fail
        }
      },

      fetchWorkspaces: async (projectId, taskId) => {
        try {
          const res = await fetch(`/api/projects/${projectId}/sandbox`, {
            credentials: "include",
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data.workspaces) {
            const linked = (data.workspaces as Workspace[]).filter(
              (w) => w.taskId === taskId,
            );
            set((s) => ({
              workspaces: { ...s.workspaces, [taskId]: linked },
            }));
          }
        } catch {
          // silently fail
        }
      },

      setTask: (task) =>
        set((s) => ({ tasks: { ...s.tasks, [task.id]: task } })),

      removeTask: (taskId) =>
        set((s) => {
          const { [taskId]: _, ...rest } = s.tasks;
          const { [taskId]: __, ...restWs } = s.workspaces;
          const { [taskId]: ___, ...restLaunching } = s.launchingTaskIds;
          return { tasks: rest, workspaces: restWs, launchingTaskIds: restLaunching };
        }),

      setLaunching: (taskId, v) =>
        set((s) => {
          if (v) {
            return { launchingTaskIds: { ...s.launchingTaskIds, [taskId]: true } };
          }
          const { [taskId]: _, ...rest } = s.launchingTaskIds;
          return { launchingTaskIds: rest };
        }),

      startPolling: () => {
        const { fetchAllTasks } = get();
        // Initial fetch
        fetchAllTasks();

        let timer: ReturnType<typeof setInterval> | null = null;

        const schedule = () => {
          if (timer) clearInterval(timer);
          const hasActive = Object.values(get().tasks).some(
            (t) => t.status === "running" || t.status === "validating",
          );
          const interval = hasActive ? 8_000 : 30_000;
          timer = setInterval(() => {
            fetchAllTasks().then(schedule);
          }, interval);
        };

        schedule();
        return () => {
          if (timer) clearInterval(timer);
        };
      },

      startDetailPolling: (projectId, taskId) => {
        const { fetchTask, fetchWorkspaces } = get();
        // Initial fetch
        fetchTask(projectId, taskId);
        fetchWorkspaces(projectId, taskId);

        const timer = setInterval(() => {
          const task = get().tasks[taskId];
          if (
            task &&
            task.status !== "running" &&
            task.status !== "validating"
          ) {
            return; // skip polling for inactive tasks but keep timer alive
          }
          fetchTask(projectId, taskId);
          fetchWorkspaces(projectId, taskId);
        }, 5_000);

        return () => clearInterval(timer);
      },
    }),
    { name: "task-store" },
  ),
);

// ── Selector hooks ────────────────────────────────────────────────────────

/** Sorted task list (newest first). */
export function useTaskList(): FeedTask[] {
  const tasks = useTaskStore((s) => s.tasks);
  return useMemo(
    () =>
      Object.values(tasks).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [tasks],
  );
}

/** Single task by ID (or undefined). */
export function useTask(taskId: string | null | undefined): FeedTask | undefined {
  return useTaskStore((s) => (taskId ? s.tasks[taskId] : undefined));
}

const EMPTY_WORKSPACES: Workspace[] = [];

/** Workspaces for a given task. */
export function useWorkspaces(taskId: string | null | undefined): Workspace[] {
  return useTaskStore((s) =>
    taskId ? s.workspaces[taskId] ?? EMPTY_WORKSPACES : EMPTY_WORKSPACES,
  );
}

/** Whether a task is currently being launched. */
export function useIsLaunching(taskId: string | null | undefined): boolean {
  return useTaskStore((s) => (taskId ? !!s.launchingTaskIds[taskId] : false));
}
