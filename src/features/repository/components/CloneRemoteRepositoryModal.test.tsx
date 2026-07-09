import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloneRemoteRepositoryModal } from './CloneRemoteRepositoryModal';

const invokeMock = vi.fn();
const addToastMock = vi.fn();
const mockUseGithubRepositories = vi.fn();

const sampleRepository = {
  id: 'repo-1',
  name: 'alpha',
  full_name: 'octocat/alpha',
  owner: { login: 'octocat' },
  description: 'Sample repository',
  private: false,
  default_branch: 'main',
  updated_at: '2026-07-09T12:00:00Z',
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

const mockUseProfileContext = vi.fn();
vi.mock('../../auth-profile/hooks/useProfileContext', () => ({
  useProfileContext: () => mockUseProfileContext(),
}));

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: () => ({
    hydrateFromBackend: vi.fn(async () => undefined),
    hydrateQuickFilterMetadata: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock('../../github-auth/hooks/useGithubRepositories', () => ({
  useGithubRepositories: () => mockUseGithubRepositories(),
}));

describe('CloneRemoteRepositoryModal', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    addToastMock.mockReset();
    mockUseGithubRepositories.mockReset();
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [],
      lastUpdatedAt: null,
      isUsingCache: false,
      page: 0,
      hasMore: false,
      hasLoadedOnce: true,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      reload: vi.fn(async () => undefined),
      loadMore: vi.fn(async () => undefined),
    });
    invokeMock.mockResolvedValue({
      items: [],
      page: 1,
      per_page: 30,
      has_more: false,
    });
  });

  it('shows enterprise locked state and opens profile management when api base URL is missing', async () => {
    const onOpenProfileManagement = vi.fn();

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: '',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={onOpenProfileManagement}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Enterprise Clone' }));

    expect(
      await screen.findByText(/Enterprise cloning requires an active full OAuth profile with an enterprise API base URL/i)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open Profile Management' }));
    expect(onOpenProfileManagement).toHaveBeenCalled();
  });

  it('shows a descriptive message when repository loading fails', async () => {
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [],
      lastUpdatedAt: null,
      isUsingCache: false,
      page: 0,
      hasMore: false,
      hasLoadedOnce: true,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: 'The connected OAuth token is missing the repo scope required to list private repositories. Reconnect the profile and grant repository access.',
      reload: vi.fn(async () => undefined),
      loadMore: vi.fn(async () => undefined),
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    expect(
      await screen.findByText(/missing the repo scope required to list private repositories/i)
    ).toBeInTheDocument();
  });

  it('shows a descriptive message when invoke rejects with a plain string error', async () => {
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [],
      lastUpdatedAt: null,
      isUsingCache: false,
      page: 0,
      hasMore: false,
      hasLoadedOnce: true,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: 'The connected OAuth token is missing the repo scope required to list private repositories. Reconnect the profile and grant repository access.',
      reload: vi.fn(async () => undefined),
      loadMore: vi.fn(async () => undefined),
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    expect(
      await screen.findByText(/missing the repo scope required to list private repositories/i)
    ).toBeInTheDocument();
  });

  it('shows a descriptive message when the selected profile is not a full OAuth profile', async () => {
    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'basic',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    expect(
      await screen.findByText(/The active profile must be full OAuth with a healthy token before remote cloning is available/i)
    ).toBeInTheDocument();
  });

  it('validates URL clone input before invoking clone command', async () => {
    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clone from URL' }));

    const priorInvokeCalls = invokeMock.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));

    expect(
      await screen.findByText('Enter a valid repository URL that starts with https://, http://, or git@.')
    ).toBeInTheDocument();
    expect(invokeMock.mock.calls.length).toBe(priorInvokeCalls);
  });

  it('renders last updated status in the basic tab', async () => {
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [],
      lastUpdatedAt: Date.parse('2026-07-09T12:00:00Z'),
      isUsingCache: true,
      page: 0,
      hasMore: false,
      hasLoadedOnce: true,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      reload: vi.fn(async () => undefined),
      loadMore: vi.fn(async () => undefined),
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    expect(await screen.findByText(/Last updated:/i)).toBeInTheDocument();
    expect(screen.getByText(/\(cached\)/i)).toBeInTheDocument();
  });

  it('refresh button forces basic reload when clicked', async () => {
    const reloadSpy = vi.fn(async () => undefined);
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [],
      lastUpdatedAt: null,
      isUsingCache: false,
      page: 0,
      hasMore: false,
      hasLoadedOnce: true,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      reload: reloadSpy,
      loadMore: vi.fn(async () => undefined),
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Refresh repositories' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('renders loading status before repository groups when loading with existing items', async () => {
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [sampleRepository],
      lastUpdatedAt: null,
      isUsingCache: false,
      page: 1,
      hasMore: true,
      hasLoadedOnce: true,
      isLoading: true,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      reload: vi.fn(async () => undefined),
      loadMore: vi.fn(async () => undefined),
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    const loadingStatus = await screen.findByText('Loading repositories…');
    const ownerHeading = await screen.findByText('octocat');

    expect(
      loadingStatus.compareDocumentPosition(ownerHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
  });

  it('shows loading state and suppresses empty state during initial loading', async () => {
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [],
      lastUpdatedAt: null,
      isUsingCache: false,
      page: 0,
      hasMore: true,
      hasLoadedOnce: false,
      isLoading: true,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      reload: vi.fn(async () => undefined),
      loadMore: vi.fn(async () => undefined),
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    expect(await screen.findByText('Loading repositories…')).toBeInTheDocument();
    expect(screen.queryByText('No repositories loaded yet.')).not.toBeInTheDocument();
  });

  it('renders grouped repositories when not loading', async () => {
    mockUseGithubRepositories.mockReturnValue({
      installations: [],
      selectedInstallationId: null,
      selectedInstallation: null,
      repositories: [sampleRepository],
      lastUpdatedAt: null,
      isUsingCache: false,
      page: 1,
      hasMore: true,
      hasLoadedOnce: true,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      reload: vi.fn(async () => undefined),
      loadMore: vi.fn(async () => undefined),
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://api.github.com',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    expect(await screen.findByText('octocat')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('shows enterprise last updated status and force refreshes while loading', async () => {
    let resolveFirstRequest: ((value: unknown) => void) | null = null;
    const firstRequest = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });

    invokeMock.mockImplementation((command: string) => {
      if (command === 'list_enterprise_repositories') {
        if (invokeMock.mock.calls.filter(([cmd]) => cmd === 'list_enterprise_repositories').length === 1) {
          return firstRequest;
        }

        return Promise.resolve({
          items: [],
          page: 1,
          per_page: 30,
          has_more: false,
        });
      }

      return Promise.resolve({
        items: [],
        page: 1,
        per_page: 30,
        has_more: false,
      });
    });

    mockUseProfileContext.mockReturnValue({
      activeProfile: {
        id: 'profile-1',
        display_name: 'Test Profile',
        auth_level: 'full_oauth',
        api_base_url: 'https://ghe.example.com/api/v3',
      },
      tokenHealthMap: { 'profile-1': 'healthy' },
    });

    render(
      <CloneRemoteRepositoryModal
        isOpen
        onClose={() => undefined}
        onOpenProfileManagement={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Enterprise Clone' }));

    expect(await screen.findByText(/Last updated:/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh repositories' }));

    const enterpriseCalls = invokeMock.mock.calls.filter(([command]) => command === 'list_enterprise_repositories');
    expect(enterpriseCalls.length).toBeGreaterThanOrEqual(2);

    resolveFirstRequest?.({
      items: [],
      page: 1,
      per_page: 30,
      has_more: false,
    });
  });
});
