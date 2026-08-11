import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useImportStore } from './import-store';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const items = [
  { path: 'C:/repos/one', displayName: 'One' },
  { path: 'C:/repos/two', displayName: 'Two' },
  { path: 'C:/repos/three', displayName: 'Three' },
];

describe('useImportStore', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useImportStore.setState({ job: null });
  });

  it('continues after failures and reports aggregate counts', async () => {
    invokeMock
      .mockResolvedValueOnce({ outcome: 'added', message: 'Added.' })
      .mockRejectedValueOnce(new Error('Failed.'))
      .mockResolvedValueOnce({ outcome: 'already_tracked', message: 'Already tracked.' });

    const job = await useImportStore.getState().startImport(items);

    expect(job.status).toBe('completed');
    expect(job.counts).toEqual({
      total: 3,
      completed: 3,
      remaining: 0,
      added: 1,
      skipped: 1,
      failed: 1,
      cancelled: 0,
    });
    expect(job.items.map((item) => item.status)).toEqual(['added', 'failed', 'already-tracked']);
    expect(invokeMock).toHaveBeenCalledTimes(3);
  });

  it('cancels pending items after the current invocation completes', async () => {
    let resolveCurrent: (value: { outcome: 'added'; message: string }) => void = () => undefined;
    const currentInvocation = new Promise<{ outcome: 'added'; message: string }>((resolve) => {
      resolveCurrent = resolve;
    });
    invokeMock.mockReturnValueOnce(currentInvocation);

    const importPromise = useImportStore.getState().startImport(items);
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    useImportStore.getState().cancelImport();
    resolveCurrent({ outcome: 'added', message: 'Added.' });

    const job = await importPromise;

    expect(job.status).toBe('cancelled');
    expect(job.counts).toMatchObject({ completed: 3, remaining: 0, added: 1, cancelled: 2 });
    expect(job.items.map((item) => item.status)).toEqual(['added', 'cancelled', 'cancelled']);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('retries only failed items from the completed job', async () => {
    invokeMock
      .mockResolvedValueOnce({ outcome: 'added', message: 'Added.' })
      .mockRejectedValueOnce(new Error('Failed.'))
      .mockResolvedValueOnce({ outcome: 'already_tracked', message: 'Already tracked.' });
    await useImportStore.getState().startImport(items);

    invokeMock.mockResolvedValueOnce({ outcome: 'added', message: 'Added on retry.' });
    const retriedJob = await useImportStore.getState().retryFailed();

    expect(retriedJob?.status).toBe('completed');
    expect(retriedJob?.counts).toMatchObject({ completed: 3, remaining: 0, added: 2, skipped: 1, failed: 0 });
    expect(invokeMock).toHaveBeenCalledTimes(4);
    expect(invokeMock).toHaveBeenLastCalledWith('add_new_tracked_path', { absolutePath: items[1].path });
  });
});
