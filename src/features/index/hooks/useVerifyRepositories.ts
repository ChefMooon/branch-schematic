import { useCallback, useTransition } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import type { TrackedPath } from '../../../types/git';

export function useVerifyRepositories() {
  const [isPending, startTransition] = useTransition();
  const markRepositoriesMissing = useWorkspaceStore((state) => state.markRepositoriesMissing);
  const markRepositoryResolved = useWorkspaceStore((state) => state.markRepositoryResolved);

  const verifyRepositories = useCallback(async (repos: TrackedPath[]) => {
    const paths = repos.map((repo) => repo.absolute_path).filter(Boolean);
    if (paths.length === 0) return;

    try {
      const missingPaths = await invoke<string[]>('verify_repo_paths', { paths });
      startTransition(() => {
        if (missingPaths.length > 0) {
          markRepositoriesMissing(missingPaths);
        } else {
          repos.forEach((repo) => markRepositoryResolved(repo.id));
        }
      });
    } catch (error) {
      console.error('Failed to verify repository paths:', error);
    }
  }, [markRepositoriesMissing, markRepositoryResolved, startTransition]);

  return { verifyRepositories, isPending };
}
