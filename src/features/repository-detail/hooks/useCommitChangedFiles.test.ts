import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommitChangedFiles } from './useCommitChangedFiles';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const sampleFiles = [
  { path: 'src/App.tsx', oldPath: null, status: 'modified', isBinary: false },
  { path: 'src/new.ts', oldPath: 'src/old.ts', status: 'renamed', isBinary: false },
];

describe('useCommitChangedFiles', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('fetches changed files for a commit and exposes them', async () => {
    invokeMock.mockResolvedValue(sampleFiles);

    const { result } = renderHook(() =>
      useCommitChangedFiles('/tmp/repo', 'a'.repeat(40)),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.files).toEqual(sampleFiles);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith('get_commit_changed_files', {
      absolutePath: '/tmp/repo',
      commitHash: 'a'.repeat(40),
    });
  });

  it('surfaces errors from the command', async () => {
    invokeMock.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() =>
      useCommitChangedFiles('/tmp/repo', 'b'.repeat(40)),
    );

    await waitFor(() => {
      expect(result.current.error).toBe('boom');
    });
    expect(result.current.files).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('suppresses stale responses after the commit changes', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    invokeMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([{ path: 'second.txt', status: 'added' }]);

    const { result, rerender } = renderHook(
      ({ hash }: { hash: string }) => useCommitChangedFiles('/tmp/repo', hash),
      { initialProps: { hash: 'first-hash' } },
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    rerender({ hash: 'second-hash' });
    await waitFor(() => {
      expect(result.current.files).toEqual([{ path: 'second.txt', status: 'added' }]);
    });

    await act(async () => {
      resolveFirst?.([{ path: 'stale.txt', status: 'modified' }]);
    });

    expect(result.current.files).toEqual([{ path: 'second.txt', status: 'added' }]);
  });

  it('clears state without fetching when inputs are missing', () => {
    const { result } = renderHook(() => useCommitChangedFiles(undefined, null));

    expect(result.current.files).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('supports clearing files on demand via clearFiles', async () => {
    invokeMock.mockResolvedValue(sampleFiles);

    const { result } = renderHook(() =>
      useCommitChangedFiles('/tmp/repo', 'c'.repeat(40)),
    );
    await waitFor(() => {
      expect(result.current.files).toEqual(sampleFiles);
    });

    act(() => {
      result.current.clearFiles();
    });

    expect(result.current.files).toBeNull();
  });
});
