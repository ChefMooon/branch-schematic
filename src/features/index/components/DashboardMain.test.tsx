import { render, screen } from '@testing-library/react';
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
});
