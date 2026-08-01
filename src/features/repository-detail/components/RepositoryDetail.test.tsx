import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryDetail } from './RepositoryDetail';
import type { TrackedPath } from '../../../types/git';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('RepositoryDetail', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('loads branch commits and updates the detail panel when a commit is selected', async () => {
    invokeMock.mockResolvedValue([
      {
        commit_hash: 'abc123',
        author_name: 'Ada Lovelace',
        commit_message: 'Initial commit',
        committed_at: '2024-01-01 10:00:00',
        signature_status: 'verified',
      },
      {
        commit_hash: 'def456',
        author_name: 'Grace Hopper',
        commit_message: 'Add repository detail modal',
        committed_at: '2024-01-02 11:00:00',
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

    expect(await screen.findByRole('button', { name: /initial commit/i })).toBeInTheDocument();
    expect(screen.getByText('Branch Schematic')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /select preview branch/i }));
    await userEvent.click(screen.getByRole('option', { name: /feature\/ui/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_branch_commits', {
        branchId: 'repo-1-feature/ui',
        limit: 25,
      });
    });

    await userEvent.click(screen.getByRole('button', { name: /add repository detail modal/i }));

    expect(await screen.findByRole('heading', { name: /add repository detail modal/i })).toBeInTheDocument();
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
});
