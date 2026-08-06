import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { RepositoryChangesSnapshot, TrackedPath } from '../../../types/git';
import { groupChanges } from '../types/repositoryChanges';

type RepositoryChangesAction = 'stage' | 'unstage' | 'commit';

interface CommitValues {
  title: string;
  body: string;
}

interface RepositoryChangesRead {
  revision: number;
  unchanged: boolean;
  snapshot: RepositoryChangesSnapshot | null;
}

interface RepositoryChangesInvalidatedEvent {
  version: number;
  repositoryId: string;
  revision: number;
  triggerReason: string;
}

function snapshotsEqual(left: RepositoryChangesSnapshot | null, right: RepositoryChangesSnapshot) {
  if (!left || left.isInProgressOperation !== right.isInProgressOperation || left.operationMessage !== right.operationMessage) {
    return false;
  }
  if (left.entries.length !== right.entries.length) return false;

  return left.entries.every((entry, index) => {
    const other = right.entries[index];
    return other
      && entry.path === other.path
      && entry.oldPath === other.oldPath
      && entry.status === other.status
      && entry.staged === other.staged
      && entry.isConflicted === other.isConflicted
      && entry.isBinary === other.isBinary
      && entry.diffAvailable === other.diffAvailable
      && entry.diffSummary === other.diffSummary
      && entry.canStage === other.canStage
      && entry.canUnstage === other.canUnstage;
  });
}

export function useRepositoryChanges(repo: TrackedPath | null) {
  const [snapshot, setSnapshot] = useState<RepositoryChangesSnapshot | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const activeRequest = useRef<Promise<void> | null>(null);
  const revision = useRef<number | null>(null);
  const snapshotRef = useRef<RepositoryChangesSnapshot | null>(null);

  const applySnapshot = (nextSnapshot: RepositoryChangesSnapshot) => {
    snapshotRef.current = nextSnapshot;
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

    const hasSnapshot = snapshotRef.current !== null;
    if (hasSnapshot) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    const request = (async () => {
      try {
        const result = await invoke<RepositoryChangesRead>('get_repository_changes_if_changed', {
          pathId: repo.id,
          absolutePath: repo.absolute_path,
          knownRevision: revision.current,
        });
        if (generation !== requestGeneration.current) return;
        revision.current = result.revision;
        if (!result.unchanged && result.snapshot && !snapshotsEqual(snapshotRef.current, result.snapshot)) {
          applySnapshot(result.snapshot);
        }
        setLastVerifiedAt(new Date().toISOString());
      } catch (loadError) {
        if (generation === requestGeneration.current) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load repository changes.');
        }
      } finally {
        if (generation === requestGeneration.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
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
    revision.current = null;
    snapshotRef.current = null;
    setError(null);
    setStatusMessage(null);
    setLastVerifiedAt(null);
    if (!repo?.id) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<RepositoryChangesInvalidatedEvent>('repository-changes-invalidated', (event) => {
      if (disposed || event.payload.version !== 1 || event.payload.repositoryId !== repo.id) return;
      void loadChanges();
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
      } else {
        unlisten = cleanup;
      }
    }).catch(() => undefined);

    void Promise.resolve(loadChanges()).finally(() => {
      if (disposed) return;
      intervalId = setInterval(() => void loadChanges(), 30000);
    });

    return () => {
      disposed = true;
      requestGeneration.current += 1;
      if (intervalId) clearInterval(intervalId);
      if (unlisten) unlisten();
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
    isRefreshing,
    isBusy,
    error,
    statusMessage,
    lastVerifiedAt,
    loadChanges,
    runAction,
  };
}
