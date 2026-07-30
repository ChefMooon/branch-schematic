import { describe, expect, it } from 'vitest';
import { useWorkspaceStore } from './workspace-store';

describe('workspace store missing repo handling', () => {
  it('marks repositories missing for matching absolute paths', () => {
    useWorkspaceStore.setState({
      repos: [
        { id: 'repo-1', display_name: 'Repo One', absolute_path: '/tmp/repo-1' },
        { id: 'repo-2', display_name: 'Repo Two', absolute_path: '/tmp/repo-2' },
      ],
    });

    useWorkspaceStore.getState().markRepositoriesMissing(['/tmp/repo-2']);

    const missingRepo = useWorkspaceStore.getState().repos.find((repo) => repo.id === 'repo-2');
    const activeRepo = useWorkspaceStore.getState().repos.find((repo) => repo.id === 'repo-1');

    expect(missingRepo?.status).toBe('missing');
    expect(activeRepo?.status).toBeUndefined();
  });

  it('clears stale missing status for repositories that still exist', () => {
    useWorkspaceStore.setState({
      repos: [
        { id: 'repo-1', display_name: 'Repo One', absolute_path: '/tmp/repo-1', status: 'missing' },
        { id: 'repo-2', display_name: 'Repo Two', absolute_path: '/tmp/repo-2', status: 'missing' },
      ],
    });

    useWorkspaceStore.getState().markRepositoriesMissing(['/tmp/repo-2']);

    const firstRepo = useWorkspaceStore.getState().repos.find((repo) => repo.id === 'repo-1');
    const secondRepo = useWorkspaceStore.getState().repos.find((repo) => repo.id === 'repo-2');

    expect(firstRepo?.status).toBe('active');
    expect(secondRepo?.status).toBe('missing');
  });

  it('does not emit a new state when a repository is already marked resolved', () => {
    useWorkspaceStore.setState({
      repos: [
        { id: 'repo-1', display_name: 'Repo One', absolute_path: '/tmp/repo-1', status: 'active' },
      ],
    });

    const before = useWorkspaceStore.getState().repos;
    useWorkspaceStore.getState().markRepositoryResolved('repo-1');
    const after = useWorkspaceStore.getState().repos;

    expect(after).toEqual(before);
  });
});
