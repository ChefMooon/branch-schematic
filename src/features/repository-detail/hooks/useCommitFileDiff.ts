import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RepositoryFileDiff } from '../../../types/git';

export function useCommitFileDiff(
  absolutePath: string | undefined,
  commitHash: string | null,
  path: string | null,
) {
  const [fileDiff, setFileDiff] = useState<RepositoryFileDiff | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    if (!absolutePath || !commitHash || !path) {
      setFileDiff(null);
      setDiffError(null);
      setIsDiffLoading(false);
      return;
    }

    let isCurrent = true;
    setFileDiff(null);
    setDiffError(null);
    setIsDiffLoading(true);

    void Promise.resolve(invoke<RepositoryFileDiff>('get_commit_file_diff', {
      absolutePath,
      commitHash,
      path,
    }))
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
  }, [absolutePath, commitHash, path]);

  return { fileDiff, isDiffLoading, diffError, clearFileDiff: () => setFileDiff(null) };
}
