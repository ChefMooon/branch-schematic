import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { RepositoryCard } from './RepositoryCard';
import type { TrackedPath } from '../../../types/git';

const addToast = vi.fn();
const refreshRepositoryGitStatus = vi.fn();
const markRepositoryResolved = vi.fn();
const setRepositoriesStatus = vi.fn();

const mockStore = {
  setRepositoryFavorite: vi.fn(),
  setRepositoryGroup: vi.fn(),
  updateRepositoryTheme: vi.fn(),
  refreshRepositoryGitStatus,
  markRepositoryResolved,
  setRepositoriesStatus,
  addTag: vi.fn(),
  removeTag: vi.fn(),
  createGlobalTag: vi.fn(),
  deleteGlobalTag: vi.fn(),
  getCustomGroups: vi.fn(() => []),
  createCustomGroup: vi.fn(),
  tagDirectory: [],
  groupDirectory: [],
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation(async (command: string) => {
    if (command === 'add_new_tracked_path') {
      return true;
    }

    return '';
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('C:/repos/located-repo'),
}));

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast }),
}));

vi.mock('../hooks/useResolveRepoOrigin', () => ({
  useResolveRepoOrigin: () => 'LOCAL_ONLY',
  useRepoOriginBadgeState: () => ({ isInactiveByProfile: false, title: '' }),
}));

vi.mock('./RepositoryCard/RepoCardHeader', () => ({
  RepoCardHeader: () => <div data-testid="repo-card-header" />,
}));

vi.mock('./RepositoryCard/RepoGroupMenu', () => ({
  RepoGroupMenu: () => <div data-testid="repo-group-menu" />,
}));

vi.mock('./RepositoryCard/RepoCardTags', () => ({
  RepoCardTags: () => <div data-testid="repo-card-tags" />,
}));

vi.mock('./RepositoryCard/RepoTagSelectionMenu', () => ({
  TagSelectionModal: () => null,
}));

vi.mock('./RepositoryCard/RepoThemeModal', () => ({
  RepoThemeModal: () => null,
}));

vi.mock('./RepositoryCard/RepoBranchDropdown', () => ({
  RepoBranchDropdown: () => <div data-testid="repo-branch-dropdown" />,
}));

vi.mock('../../repository-detail/components/RepositoryDetail', () => ({
  RepositoryDetail: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="repository-view" /> : null),
}));

describe('RepositoryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshRepositoryGitStatus.mockReset();
    markRepositoryResolved.mockReset();
    setRepositoriesStatus.mockReset();
  });

  it('resets the locate button label when the repository changes', async () => {
    const baseRepo = {
      id: 'repo-1',
      display_name: 'Repo 1',
      absolute_path: 'C:/repos/repo-1',
      status: 'missing',
      is_favorite: 0,
      tags: [],
      available_branches: ['main'],
      current_branch: 'main',
      default_branch_name: 'main',
      uncommitted_changes_count: 0,
      has_upstream: false,
      ahead_count: 0,
      behind_count: 0,
      ahead_of_default_count: 0,
      behind_default_count: 0,
      alias_name: '',
      theme_color_hex: null,
      icon_name: null,
      group_id: null,
      favorite: 0,
      group_name: null,
      origin_type: 'LOCAL_ONLY',
    } as unknown as TrackedPath;

    const nextRepo = {
      ...baseRepo,
      id: 'repo-2',
      display_name: 'Repo 2',
      absolute_path: 'C:/repos/repo-2',
    } as unknown as TrackedPath;

    const { rerender } = render(<RepositoryCard repo={baseRepo} onRefresh={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Locate' }));

    expect(await screen.findByRole('button', { name: 'Locate' })).toBeInTheDocument();

    rerender(<RepositoryCard repo={nextRepo} onRefresh={() => {}} />);

    expect(screen.getByRole('button', { name: 'Locate' })).toBeInTheDocument();
  });

  it('reattaches the existing tracked repository when locating a missing repository', async () => {
    const repo = {
      id: 'repo-4',
      display_name: 'Reattach Repo',
      absolute_path: 'C:/repos/reattach-repo',
      status: 'missing',
      is_favorite: 0,
      tags: [],
      available_branches: ['main'],
      current_branch: 'main',
      default_branch_name: 'main',
      uncommitted_changes_count: 0,
      has_upstream: false,
      ahead_count: 0,
      behind_count: 0,
      ahead_of_default_count: 0,
      behind_default_count: 0,
      alias_name: '',
      theme_color_hex: null,
      icon_name: null,
      group_id: null,
      favorite: 0,
      group_name: null,
      origin_type: 'LOCAL_ONLY',
    } as unknown as TrackedPath;

    render(<RepositoryCard repo={repo} onRefresh={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Locate' }));

    expect(await screen.findByRole('button', { name: 'Locate' })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('relink_repository_path', {
      pathId: repo.id,
      absolutePath: 'C:/repos/located-repo',
    });
  });

  it('does not render clone again for Local Only repositories in the missing state', () => {
    const repo = {
      id: 'repo-3',
      display_name: 'Local Repo',
      absolute_path: 'C:/repos/local-repo',
      status: 'missing',
      is_favorite: 0,
      tags: [],
      available_branches: ['main'],
      current_branch: 'main',
      default_branch_name: 'main',
      uncommitted_changes_count: 0,
      has_upstream: false,
      ahead_count: 0,
      behind_count: 0,
      ahead_of_default_count: 0,
      behind_default_count: 0,
      alias_name: '',
      theme_color_hex: null,
      icon_name: null,
      group_id: null,
      favorite: 0,
      group_name: null,
      origin_type: 'LOCAL_ONLY',
    } as unknown as TrackedPath;

    render(<RepositoryCard repo={repo} onRefresh={() => {}} />);

    expect(screen.getByRole('button', { name: 'Locate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clone Again' })).not.toBeInTheDocument();
  });

  it('opens the details view when double-clicking empty card space', () => {
    const repo = {
      id: 'repo-5',
      display_name: 'Double Click Repo',
      absolute_path: 'C:/repos/double-click-repo',
      status: 'ready',
      is_favorite: 0,
      tags: [],
      available_branches: ['main'],
      current_branch: 'main',
      default_branch_name: 'main',
      uncommitted_changes_count: 0,
      has_upstream: false,
      ahead_count: 0,
      behind_count: 0,
      ahead_of_default_count: 0,
      behind_default_count: 0,
      alias_name: '',
      theme_color_hex: null,
      icon_name: null,
      group_id: null,
      favorite: 0,
      group_name: null,
      origin_type: 'LOCAL_ONLY',
    } as unknown as TrackedPath;

    const { container } = render(<RepositoryCard repo={repo} onRefresh={() => {}} />);
    const card = container.querySelector('.repo-card');

    expect(card).not.toBeNull();

    fireEvent.doubleClick(card!);

    expect(screen.getByTestId('repository-view')).toBeInTheDocument();
  });

  it('does not open the details view when double-clicking the interactive icon area', () => {
    const repo = {
      id: 'repo-6',
      display_name: 'Interactive Icon Repo',
      absolute_path: 'C:/repos/interactive-icon-repo',
      status: 'ready',
      is_favorite: 0,
      tags: [],
      available_branches: ['main'],
      current_branch: 'main',
      default_branch_name: 'main',
      uncommitted_changes_count: 0,
      has_upstream: false,
      ahead_count: 0,
      behind_count: 0,
      ahead_of_default_count: 0,
      behind_default_count: 0,
      alias_name: '',
      theme_color_hex: null,
      icon_name: null,
      group_id: null,
      favorite: 0,
      group_name: null,
      origin_type: 'LOCAL_ONLY',
    } as unknown as TrackedPath;

    const { container } = render(<RepositoryCard repo={repo} onRefresh={() => {}} />);
    const icon = container.querySelector('.repo-icon-wrapper');

    expect(icon).not.toBeNull();

    fireEvent.doubleClick(icon!);

    expect(screen.queryByTestId('repository-view')).not.toBeInTheDocument();
  });
});
