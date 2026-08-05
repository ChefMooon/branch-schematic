export type RepositoryPriority = 'background' | 'visible' | 'foreground';
export type RepositoryMonitorMode = 'watcher' | 'polling' | 'pending';

export interface ManagerDiagnostics {
  activeEntries: number;
  runningRefreshes: number;
  coalescedRequests: number;
  shuttingDown: boolean;
  watcherCount: number;
  pollingCount: number;
  degradedEntries: number;
}

export interface RepositoryDebugEntry {
  repositoryId: string;
  priority: RepositoryPriority;
  detailActive: boolean;
  running: boolean;
  followUp: boolean;
  failureCount: number;
  triggerReason: string;
  monitorMode: RepositoryMonitorMode;
  generation: number;
}

export interface WatcherDebugSnapshot {
  capturedAt: string;
  diagnostics: ManagerDiagnostics;
  repositories: RepositoryDebugEntry[];
}