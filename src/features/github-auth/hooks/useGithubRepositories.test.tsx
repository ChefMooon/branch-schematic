import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGithubRepositories } from './useGithubRepositories';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

function HookHarness({ profileId = 'profile-123' }: { profileId?: string | null }) {
  const state = useGithubRepositories({ profileId, enabled: true, pageSize: 2 });

  return (
    <div>
      <span data-testid="loading">{String(state.isLoading)}</span>
      <span data-testid="repo-count">{state.repositories.length}</span>
      <span data-testid="has-more">{String(state.hasMore)}</span>
      <button type="button" onClick={() => void state.loadMore()}>Load more</button>
    </div>
  );
}

describe('useGithubRepositories', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('loads repositories through the profile-id Tauri command', async () => {
    invokeMock.mockResolvedValue({
      items: [{ id: 1, name: 'branch-schematic', full_name: 'owner/branch-schematic' }],
      has_more: true,
      page: 1,
    });

    render(<HookHarness />);

    await waitFor(() => expect(screen.getByTestId('repo-count')).toHaveTextContent('1'));
    expect(invokeMock).toHaveBeenCalledWith('list_remote_repositories', {
      profileId: 'profile-123',
      page: 1,
      perPage: 2,
    });
  });

  it('loads the next page through the same backend boundary', async () => {
    invokeMock
      .mockResolvedValueOnce({
        items: [{ id: 1, name: 'first', full_name: 'owner/first' }],
        has_more: true,
        page: 1,
      })
      .mockResolvedValueOnce({
        items: [{ id: 2, name: 'second', full_name: 'owner/second' }],
        has_more: false,
        page: 2,
      });

    render(<HookHarness />);
    await waitFor(() => expect(screen.getByTestId('repo-count')).toHaveTextContent('1'));
    screen.getByRole('button', { name: 'Load more' }).click();

    await waitFor(() => expect(screen.getByTestId('repo-count')).toHaveTextContent('2'));
    expect(invokeMock).toHaveBeenLastCalledWith('list_remote_repositories', {
      profileId: 'profile-123',
      page: 2,
      perPage: 2,
    });
  });

  it('does not invoke the backend without a profile id', async () => {
    render(<HookHarness profileId={null} />);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
