import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface SessionStoreState {
  /** Persisted collapse state for the My Sessions table.
   *  Keys are "project:{id|none}" or "status:{projectId|none}:{group}" */
  collapsed: Record<string, boolean>;

  toggleCollapsed: (key: string) => void;
  seedCollapsed: (defaults: Record<string, boolean>) => void;
}

export const useSessionStore = create<SessionStoreState>()(
  devtools(
    persist(
      (set) => ({
        collapsed: {},

        toggleCollapsed: (key) =>
          set((s) => ({
            collapsed: { ...s.collapsed, [key]: !s.collapsed[key] },
          })),

        seedCollapsed: (defaults) =>
          set((s) => {
            const next = { ...s.collapsed };
            let changed = false;
            for (const [key, value] of Object.entries(defaults)) {
              if (!(key in next)) {
                next[key] = value;
                changed = true;
              }
            }
            return changed ? { collapsed: next } : s;
          }),
      }),
      {
        name: "viagen-session-collapsed",
        partialize: (state) => ({ collapsed: state.collapsed }),
      },
    ),
    { name: "session-store" },
  ),
);
