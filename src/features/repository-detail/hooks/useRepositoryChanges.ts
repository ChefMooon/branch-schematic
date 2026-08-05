import { useEffect, useRef, useState } from 'react';
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
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const activeRequest = useRef<Promise<void> | null>(null);

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
    if (activeRequest.current) return activeRequest.current;

    const generation = requestGeneration.current;

    setIsLoading(true);
    setError(null);
    const request = (async () => {
      try {
        const nextSnapshot = await invoke<RepositoryChangesSnapshot>('get_repository_changes', {
          absolutePath: repo.absolute_path,
        });
        if (generation !== requestGeneration.current) return;
        applySnapshot(nextSnapshot);
        setLastVerifiedAt(new Date().toISOString());
      } catch (loadError) {
        if (generation === requestGeneration.current) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load repository changes.');
        }
      } finally {
        if (generation === requestGeneration.current) setIsLoading(false);
        activeRequest.current = null;
      }
    })();
    activeRequest.current = request;
    return request;
  };

  useEffect(() => {
    requestGeneration.current += 1;
    activeRequest.current = null;
    setSelectedPath(null);
    setError(null);
    setStatusMessage(null);
    setLastVerifiedAt(null);
    if (!repo?.id) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let intervalBootstrapId: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    void Promise.resolve(loadChanges()).finally(() => {
      if (disposed) return;
      intervalBootstrapId = setTimeout(() => {
        void Promise.resolve(invoke<number>('get_detail_status_refresh_interval'))
          .then((interval) => {
            if (disposed) return;
            const seconds = Math.min(5, Math.max(2, Number(interval) || 5));
            intervalId = setInterval(() => void loadChanges(), seconds * 1000);
          })
          .catch(() => {
            if (!disposed) intervalId = setInterval(() => void loadChanges(), 5000);
          });
      }, 100);
    });

    return () => {
      disposed = true;
      requestGeneration.current += 1;
      if (intervalBootstrapId) clearTimeout(intervalBootstrapId);
      if (intervalId) clearInterval(intervalId);
    };
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
    lastVerifiedAt,
    loadChanges,
    runAction,
  };
}
