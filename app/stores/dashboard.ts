import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type StatusFilter = "backlog" | "review" | "completed" | null;

interface DashboardState {
  // Task detail panel
  panelTaskId: string | null;
  panelProjectId: string | null;

  // Task feed filter
  statusFilter: StatusFilter;

  // Actions
  openTaskPanel: (taskId: string, projectId: string) => void;
  closeTaskPanel: () => void;
  setStatusFilter: (filter: StatusFilter) => void;
}

/**
 * Dashboard store — devtools are intentionally always enabled.
 * Do NOT add `enabled: process.env.NODE_ENV !== "production"` or any
 * VIAGEN_PREVIEW check here; we want devtools available in all environments.
 */
export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set) => ({
      panelTaskId: null,
      panelProjectId: null,
      statusFilter: "backlog",

      openTaskPanel: (taskId, projectId) =>
        set(
          { panelTaskId: taskId, panelProjectId: projectId },
          false,
          "openTaskPanel",
        ),

      closeTaskPanel: () =>
        set({ panelTaskId: null, panelProjectId: null }, false, "closeTaskPanel"),

      setStatusFilter: (filter) =>
        set({ statusFilter: filter }, false, "setStatusFilter"),
    }),
    { name: "DashboardStore" },
  ),
);
