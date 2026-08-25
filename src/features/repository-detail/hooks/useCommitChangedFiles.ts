import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CommitChangedFile } from '../../../types/git';

export function useCommitChangedFiles(absolutePath: string | undefined, commitHash: string | null) {
  const [files, setFiles] = useState<CommitChangedFile[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!absolutePath || !commitHash) {
      setFiles(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setFiles(null);
    setError(null);
    setIsLoading(true);

    void Promise.resolve(invoke<CommitChangedFile[]>('get_commit_changed_files', {
      absolutePath,
      commitHash,
    }))
      .then((nextFiles) => {
        if (isCurrent) setFiles(nextFiles ?? []);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the changed files for this commit.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [absolutePath, commitHash]);

  return { files, isLoading, error, clearFiles: () => setFiles(null) };
}
