import { create } from "zustand";

export interface ProjectRecord {
  id: string;
  name: string;
  taskPrefix: string | null;
}

interface ProjectState {
  projects: ProjectRecord[];
  loaded: boolean;
  setProjects: (projects: ProjectRecord[]) => void;
  fetchProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  projects: [],
  loaded: false,

  setProjects: (projects) => set({ projects, loaded: true }),

  fetchProjects: async () => {
    try {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      set({ projects: data.projects ?? [], loaded: true });
    } catch {
      // ignore
    }
  },
}));
