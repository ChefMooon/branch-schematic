import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommitFileDiff } from './useCommitFileDiff';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const sampleDiff = {
  path: 'src/App.tsx',
  oldPath: null,
  patch: '@@ -1 +1 @@\n-old\n+new',
  isBinary: false,
  isTruncated: false,
  unavailableReason: null,
};

describe('useCommitFileDiff', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('fetches the commit file diff and exposes it', async () => {
    invokeMock.mockResolvedValue(sampleDiff);

    const { result } = renderHook(() =>
      useCommitFileDiff('/tmp/repo', 'd'.repeat(40), 'src/App.tsx'),
    );

    expect(result.current.isDiffLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.fileDiff).toEqual(sampleDiff);
    });
    expect(result.current.isDiffLoading).toBe(false);
    expect(result.current.diffError).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith('get_commit_file_diff', {
      absolutePath: '/tmp/repo',
      commitHash: 'd'.repeat(40),
      path: 'src/App.tsx',
    });
  });

  it('surfaces errors from the command', async () => {
    invokeMock.mockRejectedValue(new Error('kaput'));

    const { result } = renderHook(() =>
      useCommitFileDiff('/tmp/repo', 'e'.repeat(40), 'src/App.tsx'),
    );

    await waitFor(() => {
      expect(result.current.diffError).toBe('kaput');
    });
    expect(result.current.fileDiff).toBeNull();
  });

  it('suppresses stale responses when the selection changes quickly', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    invokeMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...sampleDiff, path: 'src/next.ts' });

    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useCommitFileDiff('/tmp/repo', 'f'.repeat(40), path),
      { initialProps: { path: 'src/App.tsx' } },
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    rerender({ path: 'src/next.ts' });
    await waitFor(() => {
      expect(result.current.fileDiff?.path).toBe('src/next.ts');
    });

    await act(async () => {
      resolveFirst?.(sampleDiff);
    });

    expect(result.current.fileDiff?.path).toBe('src/next.ts');
  });

  it('does not fetch when any input is missing', () => {
    const { result } = renderHook(() => useCommitFileDiff('/tmp/repo', null, null));

    expect(result.current.fileDiff).toBeNull();
    expect(result.current.isDiffLoading).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('supports clearing the cached diff via clearFileDiff', async () => {
    invokeMock.mockResolvedValue(sampleDiff);

    const { result } = renderHook(() =>
      useCommitFileDiff('/tmp/repo', '0'.repeat(40), 'src/App.tsx'),
    );
    await waitFor(() => {
      expect(result.current.fileDiff).toEqual(sampleDiff);
    });

    act(() => {
      result.current.clearFileDiff();
    });

    expect(result.current.fileDiff).toBeNull();
  });
});
