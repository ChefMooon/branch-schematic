import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

const mockStore = {
  hydrateFromBackend: vi.fn(),
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
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/useOS', () => ({
  useOS: () => ({ isMac: false }),
}));

vi.mock('../../stores/workspace-store', () => ({
  useWorkspaceStore: () => mockStore,
}));

vi.mock('../../stores/canvas-store', () => ({
  useCanvasStore: (selector: (state: { createNewView: () => void }) => unknown) =>
    selector({ createNewView: vi.fn() }),
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
  RepositoryDropdown: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="repository-dropdown">Repository menu</div> : null),
}));
vi.mock('../../features/repository/components/AddLocalRepositoryModal', () => ({ AddLocalRepositoryModal: () => null }));
vi.mock('../../features/repository/components/BulkImportLocalRepositryModal', () => ({ BulkImportLocalRepositoryModal: () => null }));
vi.mock('../../features/repository/components/CreateRepositoryModal', () => ({ CreateRepositoryModal: () => null }));
vi.mock('../../features/canvas-views/components/CreateViewModal', () => ({ CreateViewModal: () => null }));
vi.mock('../../features/management/components/SettingsManagementModal', () => ({ SettingsManagementModal: () => null }));
vi.mock('../../features/auth-profile/components/ProfileIndicator', () => ({ ProfileIndicator: () => null }));
vi.mock('../../features/auth-profile/components/ProfileDropdown', () => ({ ProfileDropdown: () => null }));
vi.mock('../../features/auth-profile/components/ProfileManagementModal', () => ({ ProfileManagementModal: () => null }));

vi.mock('../notifications/NotificationDropdown', () => ({
  NotificationDropdown: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="notification-panel">Notification panel</div> : null),
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.hydrateFromBackend.mockResolvedValue(undefined);
    mockStore.hydrateQuickFilterMetadata.mockResolvedValue(undefined);
    mockStore.cleanupDanglingTags.mockResolvedValue(0);
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
});
