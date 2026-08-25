import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryDetail } from './RepositoryDetail';
import type { TrackedPath } from '../../../types/git';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast: vi.fn() }),
}));

function rect(width: number): DOMRect {
  return {
    width,
    left: 0,
    top: 0,
    right: width,
    bottom: 100,
    x: 0,
    y: 0,
    height: 100,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('RepositoryDetail', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  async function findHistoryItem(name: RegExp) {
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name })
          .some((button) => button.className.includes('repository-view-commit-item')),
      ).toBe(true);
    });
    return screen
      .getAllByRole('button', { name })
      .find((button) => button.className.includes('repository-view-commit-item'))!;
  }

  it('loads branch commits and updates the changed-files column when a commit is selected', async () => {
    invokeMock.mockResolvedValue([
      {
        commit_hash: 'abc123',
        author_name: 'Ada Lovelace',
        commit_message: 'Initial commit',
        committed_at: '2024-01-01T10:00:00Z',
        signature_status: 'verified',
      },
      {
        commit_hash: 'def456',
        author_name: 'Grace Hopper',
        commit_message: 'Add repository detail modal',
        committed_at: '2024-01-02T11:00:00Z',
        signature_status: null,
      },
    ]);

    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main', 'feature/ui'],
      ahead_count: 1,
      behind_count: 0,
      has_upstream: true,
      uncommitted_changes_count: 2,
      remote_url: 'https://github.com/example/branch-schematic',
      github_owner_login: 'example',
      repo_origin_type: 'OWNED',
      tags: [],
    };

    render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_branch_commits', {
        branchId: 'repo-1-main',
        limit: 25,
      });
    });

    expect((await screen.findAllByRole('button', { name: /initial commit/i })).length).toBeGreaterThan(0);
    expect(screen.getByText('Branch Schematic')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /select preview branch/i }));
    await userEvent.click(screen.getByRole('option', { name: /feature\/ui/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_branch_commits', {
        branchId: 'repo-1-feature/ui',
        limit: 25,
      });
    });

    await userEvent.click(await findHistoryItem(/add repository detail modal/i));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_commit_changed_files', {
        absolutePath: '/tmp/branch-schematic',
        commitHash: 'def456',
      });
    });
  });

  it('does not reload commits when workspace hydration replaces the repository object', async () => {
    const commits = [
      {
        commit_hash: 'abc123',
        author_name: 'Ada Lovelace',
        commit_message: 'Initial commit',
        committed_at: '2024-01-01T10:00:00Z',
        signature_status: 'verified',
      },
    ];
    invokeMock.mockResolvedValue(commits);

    const repo: TrackedPath = {
      id: 'repo-stable',
      display_name: 'Stable Repository',
      absolute_path: '/tmp/stable-repository',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 0,
      behind_count: 0,
      has_upstream: false,
      uncommitted_changes_count: 0,
      remote_url: null,
      github_owner_login: null,
      repo_origin_type: 'LOCAL_ONLY',
      tags: [],
    };

    const { rerender } = render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    expect((await screen.findAllByRole('button', { name: /initial commit/i })).length).toBeGreaterThan(0);
    const initialCommitLoadCount = invokeMock.mock.calls.filter(([command]) => command === 'get_branch_commits').length;

    rerender(<RepositoryDetail isOpen repo={{ ...repo }} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /initial commit/i }).length).toBeGreaterThan(0);
    });
    expect(invokeMock.mock.calls.filter(([command]) => command === 'get_branch_commits')).toHaveLength(initialCommitLoadCount);
    expect(screen.queryByText('Loading commits…')).not.toBeInTheDocument();
  });

  it('promotes only the open repository detail session and cleans it up on close', async () => {
    invokeMock.mockResolvedValue([]);

    const repo: TrackedPath = {
      id: 'repo-detail',
      display_name: 'Detail Repository',
      absolute_path: '/tmp/detail-repository',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 0,
      behind_count: 0,
      has_upstream: false,
      uncommitted_changes_count: 0,
      remote_url: null,
      github_owner_login: null,
      repo_origin_type: 'LOCAL_ONLY',
      tags: [],
    };

    const { rerender, unmount } = render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('begin_repository_detail_session_command', {
        pathId: repo.id,
        absolutePath: repo.absolute_path,
        sessionId: expect.any(String),
      });
    });

    expect(invokeMock).not.toHaveBeenCalledWith('request_repository_refresh_command', {
      pathId: repo.id,
    });
    expect(invokeMock).not.toHaveBeenCalledWith('set_branch_map_visible_repositories_command', expect.anything());

    const detailSessionStarts = () => invokeMock.mock.calls.filter(
      ([command]) => command === 'begin_repository_detail_session_command',
    );
    const detailDeactivationCalls = () => invokeMock.mock.calls.filter(
      ([command, payload]) => command === 'set_repository_detail_active_command' && payload?.active === false,
    );
    const firstSessionId = detailSessionStarts()[0][1].sessionId;

    rerender(<RepositoryDetail isOpen={false} repo={repo} onClose={() => undefined} />);
    await waitFor(() => expect(detailDeactivationCalls()).toHaveLength(1));

    rerender(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);
    await waitFor(() => expect(detailSessionStarts()).toHaveLength(2));

    expect(detailSessionStarts()[1][1].sessionId).not.toBe(firstSessionId);

    unmount();

    expect(detailDeactivationCalls()).toHaveLength(2);
  });

  it('renders the commits and changes tabs and opens the compact repository summary popover', async () => {
    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 1,
      behind_count: 0,
      has_upstream: true,
      uncommitted_changes_count: 2,
      remote_url: 'https://github.com/example/branch-schematic',
      github_owner_login: 'example',
      repo_origin_type: 'OWNED',
      tags: [],
    };

    render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    expect(await screen.findByRole('tab', { name: /commits/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /changes/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /show repository details/i }));

    expect(screen.getByText(/path/i)).toBeInTheDocument();
    expect(screen.getByText(/default branch/i)).toBeInTheDocument();
    expect(screen.getByText(/remote/i)).toBeInTheDocument();
  });

  it('renders the dialog in a portal outside the repository card container', async () => {
    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 0,
      behind_count: 0,
      has_upstream: false,
      uncommitted_changes_count: 0,
      remote_url: null,
      github_owner_login: null,
      repo_origin_type: 'LOCAL_ONLY',
      tags: [],
    };

    render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    const dialog = await screen.findByRole('dialog');
    const portalRoot = dialog.parentElement;

    expect(portalRoot?.className).not.toContain('repo-card');
    expect(dialog.closest('.repo-card')).toBeNull();
  });

  it('injects the repository view overlay styles when opened', async () => {
    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 0,
      behind_count: 0,
      has_upstream: false,
      uncommitted_changes_count: 0,
      remote_url: null,
      github_owner_login: null,
      repo_origin_type: 'LOCAL_ONLY',
      tags: [],
    };

    render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    await screen.findByRole('dialog');

    const styleText = Array.from(document.head.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n');

    expect(styleText).toContain('.repository-view-overlay');
  });

  it('reloads the commits list when a git operation completes from the actions menu', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_branch_commits') {
        return Promise.resolve([
          {
            commit_hash: 'abc123',
            author_name: 'Ada Lovelace',
            commit_message: 'Initial commit',
            committed_at: '2024-01-01T10:00:00Z',
            signature_status: null,
          },
        ]);
      }
      return Promise.resolve(undefined);
    });

    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 0,
      behind_count: 0,
      has_upstream: true,
      uncommitted_changes_count: 0,
      remote_url: 'https://github.com/example/branch-schematic',
      github_owner_login: 'example',
      repo_origin_type: 'OWNED',
      tags: [],
    };

    render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    await findHistoryItem(/initial commit/i);
    const countCommitLoads = () =>
      invokeMock.mock.calls.filter(([command]) => command === 'get_branch_commits').length;
    const initialLoads = countCommitLoads();

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /fetch origin/i }));

    await waitFor(() => {
      expect(countCommitLoads()).toBe(initialLoads + 1);
    });
    expect(
      await findHistoryItem(/initial commit/i),
    ).toBeInTheDocument();
  });

  it('keeps custom panel widths across tab switches and resets them when the dialog closes', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_branch_commits') {
        return Promise.resolve([
          {
            commit_hash: 'abc123',
            author_name: 'Ada Lovelace',
            commit_message: 'Initial commit',
            committed_at: '2024-01-01T10:00:00Z',
            signature_status: null,
          },
        ]);
      }
      if (command === 'get_commit_changed_files') {
        return Promise.resolve([{ path: 'src/App.tsx', oldPath: null, status: 'modified', isBinary: false }]);
      }
      if (command === 'get_commit_file_diff') {
        return Promise.resolve({
          path: 'src/App.tsx',
          oldPath: null,
          patch: '@@ -1 +1 @@\n+new',
          isBinary: false,
          isTruncated: false,
          unavailableReason: null,
        });
      }
      if (command === 'get_repository_changes_if_changed') {
        return Promise.resolve({
          revision: 1,
          unchanged: false,
          snapshot: {
            entries: [{ path: 'src/App.tsx', status: 'modified', staged: false }],
            isInProgressOperation: false,
            operationMessage: null,
          },
        });
      }
      return Promise.resolve(undefined);
    });

    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 0,
      behind_count: 0,
      has_upstream: false,
      uncommitted_changes_count: 1,
      remote_url: null,
      github_owner_login: null,
      repo_origin_type: 'LOCAL_ONLY',
      tags: [],
    };

    const view = render(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    await findHistoryItem(/initial commit/i);

    const shell = document.querySelector<HTMLElement>('.repository-view-history-shell')!;
    shell.getBoundingClientRect = () => rect(1000);

    const historyDivider = screen.getByRole('separator', { name: 'Resize commit history panels' });
    fireEvent.mouseDown(historyDivider, { button: 0 });
    fireEvent.mouseMove(window, { clientX: 400 });
    fireEvent.mouseUp(window);

    expect(document.querySelector<HTMLElement>('.repository-view-history-panel')!.style.flexBasis).toBe('40%');

    await userEvent.click(screen.getByRole('tab', { name: /changes/i }));
    expect(await screen.findByText('src/App.tsx', { selector: '.repository-view-change-path' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /commits/i }));
    await findHistoryItem(/initial commit/i);
    expect(document.querySelector<HTMLElement>('.repository-view-history-panel')!.style.flexBasis).toBe('40%');

    view.rerender(<RepositoryDetail isOpen={false} repo={repo} onClose={() => undefined} />);
    view.rerender(<RepositoryDetail isOpen repo={repo} onClose={() => undefined} />);

    await findHistoryItem(/initial commit/i);
    const reopenedShell = document.querySelector<HTMLElement>('.repository-view-history-shell')!;
    reopenedShell.getBoundingClientRect = () => rect(1000);
    expect(document.querySelector<HTMLElement>('.repository-view-history-panel')!.style.flexBasis).toBe('22%');
  });
});
