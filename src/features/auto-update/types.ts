export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'deferred'
  | 'downloading'
  | 'installing'
  | 'ready-to-restart'
  | 'restarting'
  | 'offline'
  | 'failed';

export type UpdateRuntime = 'desktop' | 'unsupported';

export interface UpdateMetadata {
  currentVersion: string | null;
  availableVersion: string;
  releaseDate: string | null;
  releaseNotes: string | null;
  releaseUrl: string | null;
}

export interface UpdateProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number;
}

export interface UpdateSnapshot {
  runtime: UpdateRuntime;
  status: UpdateStatus;
  metadata: UpdateMetadata | null;
  progress: UpdateProgress;
  isDownloaded: boolean;
  deferredVersion: string | null;
  lastCheckedAt: string | null;
  error: string | null;
}

export interface NativeUpdate {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  rawJson?: Record<string, unknown>;
  download: (onEvent?: (event: NativeDownloadEvent) => void) => Promise<void>;
  install: (options?: { restartAfterInstall?: boolean }) => Promise<void>;
  close?: () => Promise<void>;
}

export type NativeDownloadEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' };

export interface UpdateApi {
  isSupported: () => boolean;
  getCurrentVersion: () => Promise<string | null>;
  check: () => Promise<NativeUpdate | null>;
  relaunch: () => Promise<void>;
}

export interface CheckOptions {
  startup?: boolean;
}
