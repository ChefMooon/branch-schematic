import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import type { RepositoryTrackResult } from '../../../types/git';

export type ImportItemStatus = 'pending' | 'running' | 'added' | 'already-tracked' | 'failed' | 'cancelled';

export interface ImportItem {
  path: string;
  displayName: string;
  status: ImportItemStatus;
  message?: string;
}

export interface ImportJobCounts {
  total: number;
  completed: number;
  remaining: number;
  added: number;
  skipped: number;
  failed: number;
  cancelled: number;
}

export interface ImportJob {
  id: string;
  items: ImportItem[];
  status: 'running' | 'completed' | 'cancelled';
  cancelRequested: boolean;
  currentPath: string | null;
  counts: ImportJobCounts;
}

interface ImportStore {
  job: ImportJob | null;
  startImport: (items: Array<{ path: string; displayName: string }>) => Promise<ImportJob>;
  cancelImport: () => void;
  retryFailed: () => Promise<ImportJob | null>;
  clearJob: () => void;
}

function getCounts(items: ImportItem[]): ImportJobCounts {
  const completed = items.filter((item) => item.status !== 'pending' && item.status !== 'running').length;
  return {
    total: items.length,
    completed,
    remaining: items.length - completed,
    added: items.filter((item) => item.status === 'added').length,
    skipped: items.filter((item) => item.status === 'already-tracked').length,
    failed: items.filter((item) => item.status === 'failed').length,
    cancelled: items.filter((item) => item.status === 'cancelled').length,
  };
}

function makeJob(items: ImportItem[], existing?: ImportJob): ImportJob {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    items,
    status: 'running',
    cancelRequested: false,
    currentPath: null,
    counts: getCounts(items),
  };
}

function updateJob(set: (state: { job: ImportJob }) => void, job: ImportJob) {
  set({ job: { ...job, counts: getCounts(job.items) } });
}

async function runImport(
  set: (state: { job: ImportJob }) => void,
  get: () => { job: ImportJob | null },
  initialJob: ImportJob,
): Promise<ImportJob> {
  let job = initialJob;

  for (let index = 0; index < job.items.length; index += 1) {
    job = get().job ?? job;
    if (job.cancelRequested) {
      job = {
        ...job,
        items: job.items.map((item) => item.status === 'pending' ? { ...item, status: 'cancelled' } : item),
        status: 'cancelled',
        currentPath: null,
      };
      updateJob(set, job);
      return get().job ?? job;
    }

    const item = job.items[index];
    if (!item || item.status !== 'pending') continue;

    job = {
      ...job,
      currentPath: item.path,
      items: job.items.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, status: 'running', message: undefined } : candidate,
      ),
    };
    updateJob(set, job);

    try {
      const result = await invoke<RepositoryTrackResult>('add_new_tracked_path', {
        absolutePath: item.path,
      });
      useWorkspaceStore.getState().reconcileImportedRepository(result);
      job = {
        ...job,
        items: job.items.map((candidate, candidateIndex) =>
          candidateIndex === index
            ? { ...candidate, status: result.outcome === 'added' ? 'added' : 'already-tracked', message: result.message }
            : candidate,
        ),
      };
    } catch (error) {
      job = {
        ...job,
        items: job.items.map((candidate, candidateIndex) =>
          candidateIndex === index
            ? { ...candidate, status: 'failed', message: error instanceof Error ? error.message : 'The repository could not be imported.' }
            : candidate,
        ),
      };
    }
    job = { ...job, cancelRequested: get().job?.cancelRequested ?? job.cancelRequested };
    updateJob(set, job);
  }

  const latestJob = get().job ?? job;
  const wasCancelled = latestJob.cancelRequested;
  job = {
    ...job,
    cancelRequested: wasCancelled,
    items: wasCancelled
      ? job.items.map((item) => item.status === 'pending' ? { ...item, status: 'cancelled' } : item)
      : job.items,
    status: wasCancelled ? 'cancelled' : 'completed',
    currentPath: null,
  };
  updateJob(set, job);
  return get().job ?? job;
}

export const useImportStore = create<ImportStore>((set, get) => ({
  job: null,

  startImport: async (items) => {
    const job = makeJob(items.map((item) => ({ ...item, status: 'pending' })));
    updateJob(set, job);
    return runImport(set, get, job);
  },

  cancelImport: () => {
    const job = get().job;
    if (!job || job.status !== 'running') return;
    updateJob(set, { ...job, cancelRequested: true });
  },

  retryFailed: async () => {
    const currentJob = get().job;
    if (!currentJob || currentJob.status === 'running' || currentJob.counts.failed === 0) return null;
    const retryJob = makeJob(
      currentJob.items.map((item) => item.status === 'failed' ? { ...item, status: 'pending', message: undefined } : item),
      currentJob,
    );
    updateJob(set, retryJob);
    return runImport(set, get, retryJob);
  },

  clearJob: () => set({ job: null }),
}));
