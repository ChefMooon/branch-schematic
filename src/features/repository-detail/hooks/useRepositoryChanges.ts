import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RepositoryChangesSnapshot, TrackedPath } from '../../../types/git';
import { groupChanges } from '../types/repositoryChanges';

type RepositoryChangesAction = 'stage' | 'unstage' | 'commit';

interface CommitValues {
  title: string;
  body: string;
}

export function useRepositoryChanges(repo: TrackedPath | null) {
  const [snapshot, setSnapshot] = useState<RepositoryChangesSnapshot | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const applySnapshot = (nextSnapshot: RepositoryChangesSnapshot) => {
    setSnapshot(nextSnapshot);
    setStatusMessage(nextSnapshot.operationMessage ?? null);
    setSelectedPath((currentPath) => (
      !currentPath || !nextSnapshot.entries.some((entry) => entry.path === currentPath)
        ? nextSnapshot.entries[0]?.path ?? null
        : currentPath
    ));
  };

  const loadChanges = async () => {
    if (!repo?.absolute_path) return;

    setIsLoading(true);
    setError(null);
    try {
      const nextSnapshot = await invoke<RepositoryChangesSnapshot>('get_repository_changes', {
        absolutePath: repo.absolute_path,
      });

      applySnapshot(nextSnapshot);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load repository changes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedPath(null);
    setError(null);
    setStatusMessage(null);
    void loadChanges();
  }, [repo?.id, repo?.absolute_path]);

  const runAction = async (action: RepositoryChangesAction, paths?: string[], commitValues?: CommitValues) => {
    if (!repo?.absolute_path) return false;

    setIsBusy(true);
    setError(null);
    setStatusMessage(null);

    try {
      let nextSnapshot: RepositoryChangesSnapshot;
      if (action === 'stage') {
        nextSnapshot = await invoke<RepositoryChangesSnapshot>('stage_repository_paths', {
          absolutePath: repo.absolute_path,
          paths: paths ?? [selectedPath!],
        });
      } else if (action === 'unstage') {
        nextSnapshot = await invoke<RepositoryChangesSnapshot>('unstage_repository_paths', {
          absolutePath: repo.absolute_path,
          paths: paths ?? [selectedPath!],
        });
      } else {
        const trimmedTitle = commitValues?.title.trim() ?? '';
        const trimmedBody = commitValues?.body.trim() ?? '';
        const stagedCount = groupChanges(snapshot?.entries).staged.length;

        if (!trimmedTitle) {
          setError('Add a commit title before creating a commit.');
          return false;
        }
        if (stagedCount === 0) {
          setError('Stage at least one file before creating a commit.');
          return false;
        }

        nextSnapshot = await invoke<RepositoryChangesSnapshot>('create_commit', {
          absolutePath: repo.absolute_path,
          title: trimmedTitle,
          body: trimmedBody || null,
        });
      }

      applySnapshot(nextSnapshot);
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Unable to ${action} changes.`);
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  return {
    snapshot,
    selectedPath,
    setSelectedPath,
    isLoading,
    isBusy,
    error,
    statusMessage,
    loadChanges,
    runAction,
  };
}
