import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryDetailBody } from './RepositoryDetailBody';
import type { TrackedPath } from '../../../types/git';
import type { CommitRecord } from './RepositoryDetail';
import './RepositoryDetail.css';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('RepositoryDetailBody', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });
  it('renders repository summary details and commit history state', () => {
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

    const commits: CommitRecord[] = [
      {
        commit_hash: 'abc123',
        author_name: 'Ada Lovelace',
        commit_message: 'Initial commit',
        committed_at: '2024-01-01 10:00:00',
        signature_status: 'verified',
      },
    ];

    render(
      <RepositoryDetailBody
        repo={repo}
        commits={commits}
        selectedCommit={commits[0]}
        isLoadingCommits={false}
        currentBranch="main"
        onSelectCommit={vi.fn()}
        activeTab="commits"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /commit history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /initial commit/i })).toBeInTheDocument();
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getAllByText('abc123').length).toBeGreaterThan(0);
  });

  it('prevents text selection while resizing the changes layout', async () => {
    invokeMock.mockResolvedValue({
      entries: [
        {
          path: 'src/App.tsx',
          status: 'modified',
          staged: false,
          diffAvailable: true,
          diffSummary: '@@ -1 +1 @@\n-old\n+new',
        },
      ],
      isInProgressOperation: false,
      operationMessage: null,
    });

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

    render(
      <RepositoryDetailBody
        repo={repo}
        commits={[]}
        selectedCommit={null}
        isLoadingCommits={false}
        currentBranch="main"
        onSelectCommit={vi.fn()}
        activeTab="changes"
        onTabChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_repository_changes', {
        absolutePath: '/tmp/branch-schematic',
      });
    });

    const divider = screen.getByRole('separator', { name: /resize changes panels/i });
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    act(() => {
      divider.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it('renders grouped changes and commit composer for the changes tab', async () => {
    invokeMock.mockResolvedValue({
      entries: [
        {
          path: 'src/App.tsx',
          status: 'modified',
          staged: false,
          diffAvailable: true,
          diffSummary: '@@ -1 +1 @@\n-old\n+new',
        },
      ],
      isInProgressOperation: false,
      operationMessage: null,
    });

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

    render(
      <RepositoryDetailBody
        repo={repo}
        commits={[]}
        selectedCommit={null}
        isLoadingCommits={false}
        currentBranch="main"
        onSelectCommit={vi.fn()}
        activeTab="changes"
        onTabChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_repository_changes', {
        absolutePath: '/tmp/branch-schematic',
      });
    });

    const pathMatches = await screen.findAllByText('src/App.tsx');
    expect(pathMatches.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /stage all unstaged/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create commit/i })).toBeInTheDocument();
  });

  it('loads the selected file diff and renders both preview modes', async () => {
    invokeMock
      .mockResolvedValueOnce({
        entries: [{ path: 'src/App.tsx', status: 'modified', staged: false }],
        isInProgressOperation: false,
        operationMessage: null,
      })
      .mockResolvedValueOnce({
        path: 'src/App.tsx',
        oldPath: 'src/App.tsx',
        patch: '@@ -1,2 +1,2 @@\n-old\n unchanged\n+new',
        isBinary: false,
        isTruncated: false,
        unavailableReason: null,
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

    render(
      <RepositoryDetailBody
        repo={repo}
        commits={[]}
        selectedCommit={null}
        isLoadingCommits={false}
        currentBranch="main"
        onSelectCommit={vi.fn()}
        activeTab="changes"
        onTabChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_repository_file_diff', {
        absolutePath: '/tmp/branch-schematic',
        path: 'src/App.tsx',
        staged: false,
      });
    });

    expect(await screen.findByLabelText('unified diff')).toHaveTextContent('old');
    fireEvent.click(screen.getByRole('button', { name: /split view/i }));
    expect(screen.getByLabelText('split diff')).toHaveTextContent('new');
  });

  it('collapses and expands a changes group without affecting its stage action', async () => {
    invokeMock.mockResolvedValue({
      entries: [
        {
          path: 'src/App.tsx',
          status: 'modified',
          staged: false,
          diffAvailable: true,
          diffSummary: '@@ -1 +1 @@\n-old\n+new',
        },
      ],
      isInProgressOperation: false,
      operationMessage: null,
    });

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
      uncommitted_changes_count: 1,
      remote_url: 'https://github.com/example/branch-schematic',
      github_owner_login: 'example',
      repo_origin_type: 'OWNED',
      tags: [],
    };

    render(
      <RepositoryDetailBody
        repo={repo}
        commits={[]}
        selectedCommit={null}
        isLoadingCommits={false}
        currentBranch="main"
        onSelectCommit={vi.fn()}
        activeTab="changes"
        onTabChange={vi.fn()}
      />
    );

    const toggle = await screen.findByRole('button', { name: /changes 1/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('src/App.tsx', { selector: '.repository-view-change-path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stage all unstaged/i })).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('src/App.tsx', { selector: '.repository-view-change-path' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stage all unstaged/i })).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('src/App.tsx', { selector: '.repository-view-change-path' })).toBeInTheDocument();
  });

  it('keeps the changes list as the vertical scroll container', async () => {
    invokeMock.mockResolvedValue({
      entries: Array.from({ length: 30 }, (_, index) => ({
        path: `src/file-${index}.tsx`,
        status: 'modified',
        staged: false,
        diffAvailable: true,
        diffSummary: '@@ -1 +1 @@\n-old\n+new',
      })),
      isInProgressOperation: false,
      operationMessage: null,
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
      uncommitted_changes_count: 30,
      remote_url: null,
      github_owner_login: null,
      repo_origin_type: 'LOCAL_ONLY',
      tags: [],
    };

    render(
      <RepositoryDetailBody
        repo={repo}
        commits={[]}
        selectedCommit={null}
        isLoadingCommits={false}
        currentBranch="main"
        onSelectCommit={vi.fn()}
        activeTab="changes"
        onTabChange={vi.fn()}
      />
    );

    await screen.findByText('src/file-0.tsx', { selector: '.repository-view-change-path' });
    const groups = document.querySelector('.repository-view-changes-groups');
    const scrollRegion = document.querySelector('.repository-view-changes-scroll-region');
    if (!groups) throw new Error('Changes groups container was not rendered.');
    if (!scrollRegion) throw new Error('Changes scroll region was not rendered.');

    const tab = groups?.closest('.repository-view-changes-tab');
    const panel = groups?.closest('.repository-view-changes-panel');
    const composer = document.querySelector('.repository-view-commit-composer');

    expect(groups).toBeInTheDocument();
    expect(groups).toHaveClass('repository-view-changes-groups');
    expect(getComputedStyle(groups).flexGrow).toBe('0');
    expect(getComputedStyle(scrollRegion).overflowY).toBe('auto');
    expect(getComputedStyle(scrollRegion).minHeight).toBe('0');
    expect(tab).toBeInTheDocument();
    expect(getComputedStyle(tab as Element).minHeight).toBe('0');
    expect(panel).toBeInTheDocument();
    expect(getComputedStyle(panel as Element).overflow).toBe('hidden');
    expect(composer).toBeInTheDocument();
    expect(scrollRegion.nextElementSibling).toBe(composer);
  });
});
