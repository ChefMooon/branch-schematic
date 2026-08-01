import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryChangesSnapshot, TrackedPath } from '../../../types/git';
import { RepositoryDetailChangesTab } from './RepositoryDetailChangesTab';
import './RepositoryDetail.css';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

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

const modifiedSnapshot: RepositoryChangesSnapshot = {
  entries: [{ path: 'src/App.tsx', status: 'modified', staged: false }],
  isInProgressOperation: false,
  operationMessage: null,
};

const fileDiff = {
  path: 'src/App.tsx',
  oldPath: 'src/App.tsx',
  patch: '@@ -1,2 +1,2 @@\n-old\n unchanged\n+new',
  isBinary: false,
  isTruncated: false,
  unavailableReason: null,
};

function mockChanges(snapshot = modifiedSnapshot) {
  invokeMock.mockImplementation((command: string) => {
    if (command === 'get_repository_changes') return Promise.resolve(snapshot);
    if (command === 'get_repository_file_diff') return Promise.resolve(fileDiff);
    return Promise.resolve(snapshot);
  });
}

describe('RepositoryDetailChangesTab', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('prevents text selection while resizing the changes layout', async () => {
    mockChanges();
    render(<RepositoryDetailChangesTab repo={repo} />);

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

  it('renders grouped changes, commits, and preserves the stage action when a group is collapsed', async () => {
    mockChanges();
    render(<RepositoryDetailChangesTab repo={repo} />);

    const toggle = await screen.findByRole('button', { name: /changes 1/i });
    expect(screen.getByText('src/App.tsx', { selector: '.repository-view-change-path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stage all unstaged/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create commit/i })).toBeDisabled();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('src/App.tsx', { selector: '.repository-view-change-path' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stage all unstaged/i })).toBeInTheDocument();
  });

  it('loads the selected file diff and renders both preview modes', async () => {
    mockChanges();
    render(<RepositoryDetailChangesTab repo={repo} />);

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

  it('keeps the changes list as the vertical scroll container', async () => {
    mockChanges({
      entries: Array.from({ length: 30 }, (_, index) => ({ path: `src/file-${index}.tsx`, status: 'modified', staged: false })),
      isInProgressOperation: false,
      operationMessage: null,
    });
    render(<RepositoryDetailChangesTab repo={repo} />);

    await screen.findByText('src/file-0.tsx', { selector: '.repository-view-change-path' });
    const groups = document.querySelector('.repository-view-changes-groups');
    const scrollRegion = document.querySelector('.repository-view-changes-scroll-region');
    if (!groups || !scrollRegion) throw new Error('Changes list containers were not rendered.');

    const tab = groups.closest('.repository-view-changes-tab');
    const panel = groups.closest('.repository-view-changes-panel');
    const composer = document.querySelector('.repository-view-commit-composer');

    expect(getComputedStyle(groups).flexGrow).toBe('0');
    expect(getComputedStyle(scrollRegion).overflowY).toBe('auto');
    expect(getComputedStyle(scrollRegion).minHeight).toBe('0');
    expect(getComputedStyle(tab as Element).minHeight).toBe('0');
    expect(getComputedStyle(panel as Element).overflow).toBe('hidden');
    expect(scrollRegion.nextElementSibling).toBe(composer);
  });

  it('stages and unstages a selected file with refreshed snapshots', async () => {
    const stagedSnapshot: RepositoryChangesSnapshot = {
      ...modifiedSnapshot,
      entries: [{ path: 'src/App.tsx', status: 'modified', staged: true }],
    };
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_repository_changes') return Promise.resolve(modifiedSnapshot);
      if (command === 'get_repository_file_diff') return Promise.resolve(fileDiff);
      if (command === 'stage_repository_paths') return Promise.resolve(stagedSnapshot);
      if (command === 'unstage_repository_paths') return Promise.resolve(modifiedSnapshot);
      return Promise.resolve(null);
    });
    render(<RepositoryDetailChangesTab repo={repo} />);

    await screen.findByRole('button', { name: /stage all unstaged/i });
    fireEvent.click(screen.getByRole('button', { name: /stage all unstaged/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('stage_repository_paths', {
        absolutePath: '/tmp/branch-schematic',
        paths: ['src/App.tsx'],
      });
    });
    const unstageButton = await screen.findByLabelText('Unstage file');
    fireEvent.click(unstageButton);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('unstage_repository_paths', {
        absolutePath: '/tmp/branch-schematic',
        paths: ['src/App.tsx'],
      });
    });
    expect(await screen.findByLabelText('Stage file')).toBeInTheDocument();
  });

  it('creates a commit using a trimmed title and optional message', async () => {
    const stagedSnapshot: RepositoryChangesSnapshot = {
      ...modifiedSnapshot,
      entries: [{ path: 'src/App.tsx', status: 'modified', staged: true }],
    };
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_repository_changes') return Promise.resolve(stagedSnapshot);
      if (command === 'get_repository_file_diff') return Promise.resolve(fileDiff);
      if (command === 'create_commit') return Promise.resolve({ ...stagedSnapshot, entries: [] });
      return Promise.resolve(null);
    });
    render(<RepositoryDetailChangesTab repo={repo} />);

    const createCommit = await screen.findByRole('button', { name: /create commit/i });
    expect(createCommit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Describe the changes'), { target: { value: '  Add changes tab  ' } });
    fireEvent.change(screen.getByPlaceholderText('Optional details'), { target: { value: '  Details  ' } });
    fireEvent.click(createCommit);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('create_commit', {
        absolutePath: '/tmp/branch-schematic',
        title: 'Add changes tab',
        body: 'Details',
      });
    });
    expect(screen.getByPlaceholderText('Describe the changes')).toHaveValue('');
    expect(screen.getByPlaceholderText('Optional details')).toHaveValue('');
  });
});
