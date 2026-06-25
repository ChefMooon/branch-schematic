import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TrackedPath } from '../types/git';

interface WorkspaceState {
  repos: TrackedPath[];
  activeRepoId: string | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrateFromBackend: () => Promise<void>;
  selectRepo: (repo: TrackedPath | null) => void;
  setRepos: (repos: TrackedPath[]) => void;
  addRepo: (repo: TrackedPath) => void;
  removeRepo: (repoId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  repos: [],
  activeRepoId: null,
  isHydrated: false,
  isLoading: false,
  error: null,

  hydrateFromBackend: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const rows = await invoke<TrackedPath[]>('get_active_tracked_paths');
      const nextRepos = rows.filter((repo) => repo.is_active === 1);
      const currentActiveRepo = get().activeRepoId
        ? nextRepos.find((repo) => repo.id === get().activeRepoId) ?? null
        : null;
      const nextActiveRepoId = currentActiveRepo?.id ?? nextRepos[0]?.id ?? null;

      set({
        repos: nextRepos,
        activeRepoId: nextActiveRepoId,
        isHydrated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to hydrate workspace state',
        isHydrated: true,
        isLoading: false,
      });
    }
  },

  selectRepo: (repo) => {
    set({ activeRepoId: repo?.id ?? null });
  },

  setRepos: (repos) => set({ repos, activeRepoId: repos[0]?.id ?? null }),

  addRepo: (repo) => {
    const currentRepos = get().repos;
    const nextRepos = currentRepos.some((existing) => existing.id === repo.id)
      ? currentRepos.map((existing) => (existing.id === repo.id ? repo : existing))
      : [...currentRepos, repo];

    set({ repos: nextRepos, activeRepoId: get().activeRepoId ?? repo.id });
  },

  removeRepo: (repoId) => {
    const nextRepos = get().repos.filter((repo) => repo.id !== repoId);
    set({
      repos: nextRepos,
      activeRepoId: get().activeRepoId === repoId ? nextRepos[0]?.id ?? null : get().activeRepoId,
    });
  },
}));
