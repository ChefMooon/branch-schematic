import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardMain } from './DashboardMain';

const mockStore = {
  repos: [] as Array<Record<string, unknown>>,
  isHydrated: true,
  quickFilterMetadata: { tags: [], groups: [] },
  groupDirectory: [] as Array<{ group_name: string }>,
  hydrateFromBackend: vi.fn(),
  hydrateQuickFilterMetadata: vi.fn(),
  refreshRepositoryGitStatus: vi.fn(),
  cleanupDanglingTags: vi.fn(),
};
const verifyRepositoriesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: () => mockStore,
}));

vi.mock('../hooks/useVerifyRepositories', () => ({
  useVerifyRepositories: () => ({ verifyRepositories: verifyRepositoriesMock }),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast: vi.fn() }),
}));

vi.mock('./RepositoryCard', () => ({
  RepositoryCard: () => <div>repo</div>,
}));

vi.mock('./WorkspaceQuickFilters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./WorkspaceQuickFilters')>();
  return {
    ...actual,
    WorkspaceQuickFilters: () => null,
  };
});

vi.mock('./BulkActionToolbar', () => ({
  BulkActionToolbar: () => null,
}));

describe('DashboardMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.repos = [];
    mockStore.isHydrated = true;
    mockStore.quickFilterMetadata = { tags: [], groups: [] };
    mockStore.groupDirectory = [];
    mockStore.hydrateFromBackend.mockResolvedValue(undefined);
    mockStore.hydrateQuickFilterMetadata.mockResolvedValue(undefined);
    mockStore.refreshRepositoryGitStatus.mockResolvedValue(undefined);
    mockStore.cleanupDanglingTags.mockResolvedValue(0);
    verifyRepositoriesMock.mockReset();
  });

  it('defaults the sort dropdown to Last Accessed', () => {
    render(<DashboardMain />);

    expect(screen.getByRole('button', { name: /sort repositories/i })).toHaveTextContent('Last Accessed');
  });

  it('shows a clear button when the search input has text and clears it on click', async () => {
    const user = userEvent.setup();
    render(<DashboardMain />);

    const input = screen.getByPlaceholderText(/search workspaces/i);
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    await user.type(input, 'branch');

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);

    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('clears the search input when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<DashboardMain />);

    const input = screen.getByPlaceholderText(/search workspaces/i);
    await user.type(input, 'repo');

    expect(input).toHaveValue('repo');

    await user.keyboard('{Escape}');

    expect(input).toHaveValue('');
  });

  it('does not reverify when repository status changes', () => {
    const repository = {
      id: 'repo-1',
      absolute_path: 'C:/repos/repo-1',
      display_name: 'Repo 1',
      status: 'unknown',
      tags: [],
    };
    mockStore.repos = [repository];

    const { rerender } = render(<DashboardMain />);
    expect(verifyRepositoriesMock).toHaveBeenCalledTimes(1);

    mockStore.repos = [{ ...repository, status: 'resolved' }];
    rerender(<DashboardMain />);

    expect(verifyRepositoriesMock).toHaveBeenCalledTimes(1);
  });

  it('shows repository card skeletons before the initial workspace hydration completes', () => {
    mockStore.isHydrated = false;

    render(<DashboardMain />);

    expect(screen.getAllByTestId('repository-card-skeleton')).toHaveLength(6);
    expect(screen.queryByText('No workspace references matching criteria found.')).not.toBeInTheDocument();
  });

  it('shows repository cards as soon as the workspace rows are hydrated', () => {
    mockStore.isHydrated = false;
    const { rerender } = render(<DashboardMain />);

    mockStore.isHydrated = true;
    mockStore.repos = [{
      id: 'repo-1',
      display_name: 'Repo 1',
      absolute_path: 'C:/repos/repo-1',
      tags: [],
    }];
    rerender(<DashboardMain />);

    expect(screen.getByText('repo')).toBeInTheDocument();
    expect(screen.queryByTestId('repository-card-skeleton')).not.toBeInTheDocument();
  });

  it('shows the empty state after hydration when no repositories match', () => {
    render(<DashboardMain />);

    expect(screen.getByText('No workspace references matching criteria found.')).toBeInTheDocument();
  });
});
