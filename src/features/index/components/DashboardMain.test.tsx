import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardMain } from './DashboardMain';

const mockStore = {
  repos: [] as Array<Record<string, unknown>>,
  quickFilterMetadata: { tags: [], groups: [] },
  groupDirectory: [] as Array<{ group_name: string }>,
  hydrateFromBackend: vi.fn(),
  hydrateQuickFilterMetadata: vi.fn(),
  refreshRepositoryGitStatus: vi.fn(),
  cleanupDanglingTags: vi.fn(),
};

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: () => mockStore,
}));

vi.mock('./RepositoryCard', () => ({
  RepositoryCard: () => <div>repo</div>,
}));

vi.mock('./WorkspaceQuickFilters', () => ({
  WorkspaceQuickFilters: () => null,
}));

vi.mock('./BulkActionToolbar', () => ({
  BulkActionToolbar: () => null,
}));

describe('DashboardMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.repos = [];
    mockStore.quickFilterMetadata = { tags: [], groups: [] };
    mockStore.groupDirectory = [];
    mockStore.hydrateFromBackend.mockResolvedValue(undefined);
    mockStore.hydrateQuickFilterMetadata.mockResolvedValue(undefined);
    mockStore.refreshRepositoryGitStatus.mockResolvedValue(undefined);
    mockStore.cleanupDanglingTags.mockResolvedValue(0);
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
});
