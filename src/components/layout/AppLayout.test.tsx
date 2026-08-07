import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

const { createNewViewMock, navigateMock } = vi.hoisted(() => ({
  createNewViewMock: vi.fn(),
  navigateMock: vi.fn(),
}));

const mockStore = {
  hydrateFromBackend: vi.fn(),
  subscribeToWorkspaceUpdates: vi.fn(),
  quickFilterMetadata: null,
  hydrateQuickFilterMetadata: vi.fn(),
  groupDirectory: [],
  tagDirectory: [],
  createCustomGroup: vi.fn(),
  createGlobalTag: vi.fn(),
  updateCustomGroup: vi.fn(),
  deleteCustomGroup: vi.fn(),
  updateGlobalTag: vi.fn(),
  deleteGlobalTag: vi.fn(),
  cleanupDanglingTags: vi.fn(),
};

const mockNotifications = {
  inbox: [],
  unreadCount: 0,
  markNotificationAsRead: vi.fn(),
  togglePinnedNotification: vi.fn(),
  archiveNotification: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  archiveAllNotifications: vi.fn(),
};

const mockProfileContext = {
  profiles: [],
  activeProfile: null,
  tokenHealthMap: {},
  selectProfile: vi.fn(),
  addProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
};

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => navigateMock,
}));

vi.mock('../../hooks/useOS', () => ({
  useOS: () => ({ isMac: false }),
}));

vi.mock('../../stores/workspace-store', () => ({
  useWorkspaceStore: () => mockStore,
}));

vi.mock('../../stores/canvas-store', () => ({
  useCanvasStore: {
    getState: () => ({ createNewView: createNewViewMock }),
  },
}));

vi.mock('../notifications/NotificationProvider', () => ({
  useNotifications: () => mockNotifications,
}));

vi.mock('../../features/auth-profile/hooks/useProfileContext', () => ({
  useProfileContext: () => mockProfileContext,
}));

vi.mock('../titlebar/WindowControls', () => ({ WindowControls: () => null }));
vi.mock('./AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('../../features/repository/components/RepositoryDropdown', () => ({
  RepositoryDropdown: ({
    isOpen,
    onSelect,
  }: {
    isOpen: boolean;
    onSelect: (action: 'create-view') => void;
  }) => (isOpen ? (
    <div data-testid="repository-dropdown">
      <button type="button" onClick={() => onSelect('create-view')}>Create view action</button>
    </div>
  ) : null),
}));
vi.mock('../../features/repository/components/AddLocalRepositoryModal', () => ({ AddLocalRepositoryModal: () => null }));
vi.mock('../../features/repository/components/BulkImportLocalRepositryModal', () => ({ BulkImportLocalRepositoryModal: () => null }));
vi.mock('../../features/repository/components/CreateRepositoryModal', () => ({ CreateRepositoryModal: () => null }));
vi.mock('../../features/canvas-views/components/CreateViewModal', () => ({
  CreateViewModal: ({
    isOpen,
    onCreate,
  }: {
    isOpen: boolean;
    onCreate: (options: { name: string; isFavorite: boolean; viewportDefaults: { zoomLevel: number; panX: number; panY: number } }) => Promise<void>;
  }) => (isOpen ? (
    <button
      type="button"
      onClick={() => onCreate({
        name: 'Dashboard view',
        isFavorite: false,
        viewportDefaults: { zoomLevel: 1, panX: 0, panY: 0 },
      })}
    >
      Submit create view
    </button>
  ) : null),
}));
vi.mock('../../features/management/components/SettingsManagementModal', () => ({ SettingsManagementModal: () => null }));
vi.mock('../../features/auth-profile/components/ProfileIndicator', () => ({
  ProfileIndicator: ({
    isOpen,
    onToggle,
    className,
  }: {
    isOpen: boolean;
    onToggle: () => void;
    className?: string;
  }) => (
    <button type="button" title="Profile" className={className} onClick={onToggle}>
      {isOpen ? 'profile-open' : 'profile-closed'}
    </button>
  ),
}));
vi.mock('../../features/auth-profile/components/ProfileDropdown', () => ({
  ProfileDropdown: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="profile-dropdown">Profile menu</div> : null),
}));
vi.mock('../../features/auth-profile/components/ProfileManagementModal', () => ({ ProfileManagementModal: () => null }));
vi.mock('../../features/repository-update-diagnostics/components/RepositoryUpdateDiagnosticsModal', () => ({
  RepositoryUpdateDiagnosticsModal: () => null,
}));

vi.mock('../notifications/NotificationDropdown', () => ({
  NotificationDropdown: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="notification-panel">Notification panel</div> : null),
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.hydrateFromBackend.mockResolvedValue(undefined);
    mockStore.subscribeToWorkspaceUpdates.mockResolvedValue(vi.fn());
    mockStore.hydrateQuickFilterMetadata.mockResolvedValue(undefined);
    mockStore.cleanupDanglingTags.mockResolvedValue(0);
    createNewViewMock.mockResolvedValue(undefined);
    navigateMock.mockResolvedValue(undefined);
  });

  it('places the repository diagnostics action beside the notification action', () => {
    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>,
    );

    expect(screen.getByRole('button', { name: /open repository update diagnostics/i })).toBeInTheDocument();
    expect(screen.getByTitle(/notifications/i)).toBeInTheDocument();
  });

  it('closes the notification dropdown when the bell button is clicked while it is open', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>
    );

    const bellButton = screen.getByTitle(/notifications/i);

    await user.click(bellButton);
    expect(screen.getByTestId('notification-panel')).toBeInTheDocument();

    await user.click(bellButton);
    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
  });

  it('closes the notification dropdown when the repository menu is opened', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>
    );

    const bellButton = screen.getByTitle(/notifications/i);
    const repositoryButton = screen.getByTitle(/new/i);

    await user.click(bellButton);
    expect(screen.getByTestId('notification-panel')).toBeInTheDocument();

    await user.click(repositoryButton);
    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('repository-dropdown')).toBeInTheDocument();
  });

  it('closes the other dropdowns when the profile dropdown is opened', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>
    );

    const bellButton = screen.getByTitle(/notifications/i);
    const repositoryButton = screen.getByTitle(/new/i);
    const profileButton = screen.getByRole('button', { name: /profile/i });

    await user.click(bellButton);
    await user.click(repositoryButton);
    expect(screen.getByTestId('repository-dropdown')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();

    await user.click(profileButton);
    expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument();
    expect(screen.queryByTestId('repository-dropdown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
  });

  it('closes the profile dropdown when its trigger is clicked again', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>
    );

    const profileButton = screen.getByRole('button', { name: /profile/i });

    await user.click(profileButton);
    expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument();

    await user.click(profileButton);
    expect(screen.queryByTestId('profile-dropdown')).not.toBeInTheDocument();
  });

  it('applies shared title bar button classes and active state styling to the header actions', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>
    );

    const profileButton = screen.getByRole('button', { name: /profile/i });

    expect(profileButton).toHaveClass('titlebar-profile-button');

    await user.click(profileButton);
    expect(profileButton).toHaveClass('is-active');
  });

  it('creates a view from the global repository menu before navigating to the branch map', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>,
    );

    await user.click(screen.getByTitle(/new/i));
    await user.click(screen.getByRole('button', { name: 'Create view action' }));
    await user.click(await screen.findByRole('button', { name: 'Submit create view' }));

    expect(createNewViewMock).toHaveBeenCalledWith({
      name: 'Dashboard view',
      isFavorite: false,
      viewportDefaults: { zoomLevel: 1, panX: 0, panY: 0 },
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: '/branch-map' });
  });

  it('does not navigate when the global create-view action fails', async () => {
    const user = userEvent.setup();
    createNewViewMock.mockRejectedValue(new Error('create failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>,
    );

    await user.click(screen.getByTitle(/new/i));
    await user.click(screen.getByRole('button', { name: 'Create view action' }));
    await user.click(screen.getByRole('button', { name: 'Submit create view' }));

    await vi.waitFor(() => expect(createNewViewMock).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
