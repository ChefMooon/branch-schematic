import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { CustomGroup, GroupSummary, QuickFilterMetadata, RepoTag, TagFilterSummary, TrackedPath } from '../types/git';

function parseRepoTags(tagsJson: unknown): RepoTag[] {
  if (typeof tagsJson !== 'string' || tagsJson.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RepoTag => {
        return Boolean(
          entry &&
            typeof entry.id === 'string' &&
            typeof entry.tag_name === 'string' &&
            typeof entry.color_hex === 'string'
        );
      })
      .map((entry) => ({
        id: entry.id,
        tag_name: entry.tag_name,
        color_hex: entry.color_hex,
      }));
  } catch {
    return [];
  }
}

interface WorkspaceState {
  repos: TrackedPath[];
  activeRepoId: string | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  quickFilterMetadata: QuickFilterMetadata | null;
  groupDirectory: GroupSummary[];
  tagDirectory: TagFilterSummary[];
  hydrateFromBackend: () => Promise<void>;
  hydrateQuickFilterMetadata: () => Promise<void>;
  hydrateManagementDirectory: () => Promise<void>;
  selectRepo: (repo: TrackedPath | null) => void;
  setRepos: (repos: TrackedPath[]) => void;
  addRepo: (repo: TrackedPath) => void;
  removeRepo: (repoId: string) => void;
  setRepositoryFavorite: (repoId: string, favorite: boolean) => Promise<void>;
  setRepositoryGroup: (repoId: string, groupId: string | null) => Promise<void>;
  addTag: (repoId: string, tagName: string, colorHex?: string) => Promise<void>;
  removeTag: (repoId: string, tagName: string) => Promise<void>;
  touchLastAccessed: (repoId: string) => Promise<void>;
  createCustomGroup: (groupName: string, colorHex?: string) => Promise<string | null>;
  updateCustomGroup: (id: string, groupName: string, colorHex: string) => Promise<void>;
  deleteCustomGroup: (id: string) => Promise<void>;
  updateGlobalTag: (id: string, tagName: string, colorHex: string) => Promise<void>;
  deleteGlobalTag: (id: string) => Promise<void>;
  cleanupDanglingTags: () => Promise<number>;
  getUniqueTags: () => RepoTag[];
  getCustomGroups: () => GroupSummary[];
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  repos: [],
  activeRepoId: null,
  isHydrated: false,
  isLoading: false,
  error: null,
  quickFilterMetadata: null,
  groupDirectory: [],
  tagDirectory: [],

  hydrateFromBackend: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });

    try {
      // 1. Fetch active data paths from Rust database
      const rows = await invoke<any[]>('get_tracked_workspaces');
      
      // 2. Map structural database fields safely to match runtime requirements
      const nextRepos: TrackedPath[] = rows.map((repo) => ({
        id: repo.id,
        display_name: repo.display_name,
        alias_name: repo.alias_name,
        absolute_path: repo.absolute_path,
        remote_url: repo.remote_url,
        repo_origin_type: (repo.repo_origin_type || "LOCAL_ONLY"),
        uncommitted_changes_count: repo.uncommitted_changes_count || 0,
        current_branch: repo.current_branch || "main",
        available_branches: repo.available_branches || ["main"],
        ahead_count: repo.ahead_count || 0,
        behind_count: repo.behind_count || 0,
        is_favorite: Number(repo.is_favorite || 0),
        group_id: repo.group_id ?? null,
        custom_group: repo.custom_group ?? null,
        last_accessed_at: repo.last_accessed_at ?? null,
        tags: parseRepoTags(repo.tags_json),
      }));

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
      await get().hydrateQuickFilterMetadata();
      await get().hydrateManagementDirectory();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to hydrate workspace state',
        isHydrated: true,
        isLoading: false,
      });
    }
  },

  hydrateQuickFilterMetadata: async () => {
    try {
      const metadata = await invoke<QuickFilterMetadata>('get_quick_filter_metadata');
      set({ quickFilterMetadata: metadata });
    } catch (error) {
      console.error('Failed to hydrate quick filter metadata:', error);
    }
  },

  hydrateManagementDirectory: async () => {
    try {
      const [groups, tags] = await Promise.all([
        invoke<GroupSummary[]>('get_custom_groups_with_usage'),
        invoke<TagFilterSummary[]>('get_global_tags_with_usage'),
      ]);
      set({ groupDirectory: groups, tagDirectory: tags });
    } catch (error) {
      console.error('Failed to hydrate management directory:', error);
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

  setRepositoryFavorite: async (repoId, favorite) => {
    try {
      await invoke('set_repository_favorite', { pathId: repoId, isFavorite: favorite });
      set({
        repos: get().repos.map((repo) =>
          repo.id === repoId ? { ...repo, is_favorite: favorite ? 1 : 0 } : repo
        ),
      });
      await get().hydrateQuickFilterMetadata();
    } catch (error) {
      console.error('Failed to set favorite state:', error);
    }
  },

  setRepositoryGroup: async (repoId, groupId) => {
    try {
      await invoke('set_repository_group', { pathId: repoId, groupId });
      const groupName = get().groupDirectory.find((group) => group.id === groupId)?.group_name ?? null;
      set({
        repos: get().repos.map((repo) =>
          repo.id === repoId
            ? { ...repo, group_id: groupId, custom_group: groupName }
            : repo
        ),
      });
      await get().hydrateQuickFilterMetadata();
      await get().hydrateManagementDirectory();
    } catch (error) {
      console.error('Failed to set custom group:', error);
    }
  },

  addTag: async (repoId, tagName, colorHex) => {
    const cleanTag = tagName.trim();
    if (!cleanTag) return;

    try {
      const nextTags = await invoke<RepoTag[]>('add_repository_tag', {
        pathId: repoId,
        tagName: cleanTag,
        colorHex,
      });

      set({
        repos: get().repos.map((repo) =>
          repo.id === repoId ? { ...repo, tags: nextTags } : repo
        ),
      });
      await get().hydrateQuickFilterMetadata();
      await get().hydrateManagementDirectory();
    } catch (error) {
      console.error('Failed to add repository tag:', error);
    }
  },

  removeTag: async (repoId, tagName) => {
    const cleanTag = tagName.trim();
    if (!cleanTag) return;

    try {
      const nextTags = await invoke<RepoTag[]>('remove_repository_tag', {
        pathId: repoId,
        tagName: cleanTag,
      });

      set({
        repos: get().repos.map((repo) =>
          repo.id === repoId ? { ...repo, tags: nextTags } : repo
        ),
      });
      await get().hydrateQuickFilterMetadata();
      await get().hydrateManagementDirectory();
    } catch (error) {
      console.error('Failed to remove repository tag:', error);
    }
  },

  touchLastAccessed: async (repoId) => {
    try {
      await invoke('touch_repository_last_accessed', { pathId: repoId });
      const nowIso = new Date().toISOString();
      set({
        repos: get().repos.map((repo) =>
          repo.id === repoId ? { ...repo, last_accessed_at: nowIso } : repo
        ),
      });
    } catch (error) {
      console.error('Failed to touch last accessed timestamp:', error);
    }
  },

  createCustomGroup: async (groupName, colorHex) => {
    try {
      const created = await invoke<CustomGroup>('create_custom_group', { groupName, colorHex });
      await get().hydrateManagementDirectory();
      await get().hydrateQuickFilterMetadata();
      return created.id;
    } catch (error) {
      console.error('Failed to create custom group:', error);
      return null;
    }
  },

  updateCustomGroup: async (id, groupName, colorHex) => {
    try {
      await invoke('update_custom_group', { id, groupName, colorHex });
      await get().hydrateFromBackend();
    } catch (error) {
      console.error('Failed to update custom group:', error);
    }
  },

  deleteCustomGroup: async (id) => {
    try {
      await invoke('delete_custom_group', { id });
      await get().hydrateFromBackend();
    } catch (error) {
      console.error('Failed to delete custom group:', error);
    }
  },

  updateGlobalTag: async (id, tagName, colorHex) => {
    try {
      await invoke('update_global_tag', { id, tagName, colorHex });
      await get().hydrateFromBackend();
    } catch (error) {
      console.error('Failed to update global tag:', error);
    }
  },

  deleteGlobalTag: async (id) => {
    try {
      await invoke('delete_global_tag', { id });
      await get().hydrateFromBackend();
    } catch (error) {
      console.error('Failed to delete global tag:', error);
    }
  },

  cleanupDanglingTags: async () => {
    try {
      const removed = await invoke<number>('cleanup_dangling_global_tags');
      await get().hydrateFromBackend();
      return removed;
    } catch (error) {
      console.error('Failed to cleanup dangling tags:', error);
      return 0;
    }
  },

  getUniqueTags: () => {
    const tagsById = new Map<string, RepoTag>();
    get().repos.forEach((repo) => {
      (repo.tags ?? []).forEach((tag) => {
        tagsById.set(tag.id, tag);
      });
    });

    return Array.from(tagsById.values()).sort((a, b) =>
      a.tag_name.localeCompare(b.tag_name)
    );
  },

  getCustomGroups: () => get().groupDirectory,
}));