import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RepositoryChangeItem, RepositoryFileDiff } from '../../../types/git';

export function useRepositoryFileDiff(absolutePath: string | undefined, selectedEntry: RepositoryChangeItem | null) {
  const [fileDiff, setFileDiff] = useState<RepositoryFileDiff | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    if (!absolutePath || !selectedEntry) {
      setFileDiff(null);
      setDiffError(null);
      setIsDiffLoading(false);
      return;
    }

    let isCurrent = true;
    setFileDiff(null);
    setDiffError(null);
    setIsDiffLoading(true);

    void invoke<RepositoryFileDiff>('get_repository_file_diff', {
      absolutePath,
      path: selectedEntry.path,
      staged: selectedEntry.staged,
    })
      .then((nextDiff) => {
        if (isCurrent) setFileDiff(nextDiff);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setDiffError(loadError instanceof Error ? loadError.message : 'Unable to load the selected file diff.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsDiffLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [absolutePath, selectedEntry?.path, selectedEntry?.staged]);

  return { fileDiff, isDiffLoading, diffError, clearFileDiff: () => setFileDiff(null) };
}
