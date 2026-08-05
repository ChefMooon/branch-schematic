import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { WatcherDebugSnapshot } from '../types/repositoryUpdateDiagnostics';

const SNAPSHOT_INTERVAL_MS = 1000;

export function useRepositoryUpdateDiagnostics(isOpen: boolean) {
  const [snapshot, setSnapshot] = useState<WatcherDebugSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActiveRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isActiveRef.current) return;
    setIsLoading(true);
    try {
      const nextSnapshot = await invoke<WatcherDebugSnapshot>(
        'get_watcher_manager_debug_snapshot_command',
      );
      if (!isActiveRef.current) return;
      setSnapshot(nextSnapshot);
      setError(null);
    } catch (refreshError) {
      if (!isActiveRef.current) return;
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      if (isActiveRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isActiveRef.current = isOpen;
    if (!isOpen) {
      setIsLoading(false);
      return;
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), SNAPSHOT_INTERVAL_MS);
    return () => {
      isActiveRef.current = false;
      window.clearInterval(interval);
    };
  }, [isOpen, refresh]);

  return { snapshot, isLoading, error, refresh };
}