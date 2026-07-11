import { useState, useEffect, isValidElement, cloneElement, type ReactElement } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  BellIcon,
  PlusIcon,
  CircleHalfIcon,
  ListIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useOS } from '../../hooks/useOS';
import { WindowControls } from './WindowControls';
import './titlebar.css';
import { AppSidebar } from './AppSidebar';
import { RepositoryDropdown } from '../../features/repository/components/RepositoryDropdown';
import { AddLocalRepositoryModal } from '../../features/repository/components/AddLocalRepositoryModal';
import { BulkImportLocalRepositoryModal } from '../../features/repository/components/BulkImportLocalRepositryModal';
import { CreateRepositoryModal } from '../../features/repository/components/CreateRepositoryModal';
import { CloneRemoteRepositoryModal } from '../../features/repository/components/CloneRemoteRepositoryModal';
import { CreateViewModal } from '../../features/canvas-views/components/CreateViewModal';
import { SettingsManagementModal } from '../../features/management/components/SettingsManagementModal';
import { useCanvasStore } from '../../stores/canvas-store';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useNotifications } from '../notifications/NotificationProvider';
import { ProfileIndicator } from '../../features/auth-profile/components/ProfileIndicator';
import { ProfileDropdown } from '../../features/auth-profile/components/ProfileDropdown';
import { ProfileManagementModal } from '../../features/auth-profile/components/ProfileManagementModal';
import { useProfileContext } from '../../features/auth-profile/hooks/useProfileContext';
import { Button } from '../button/Button';
import type { RepositoryModalAction } from '../../features/repository/types';
import type { UserProfile } from '../../features/auth-profile/types';

interface AppLayoutProps {
  children: React.ReactNode;
}

type AppStyle = React.CSSProperties;

function useLayoutThemeMode() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const update = () =>
      setThemeMode(
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
      );
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return themeMode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRepositoryDropdownOpen, setIsRepositoryDropdownOpen] = useState(false);
  const [repositoryDropdownAnchor, setRepositoryDropdownAnchor] = useState<HTMLElement | null>(null);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const [activeRepositoryModal, setActiveRepositoryModal] = useState<RepositoryModalAction | null>(null);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [managementInitialTab, setManagementInitialTab] = useState<'tags' | 'groups'>('tags');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [profileDropdownAnchor, setProfileDropdownAnchor] = useState<HTMLButtonElement | null>(null);
  const [isProfileManagementModalOpen, setIsProfileManagementModalOpen] = useState(false);
  const [managedProfile, setManagedProfile] = useState<UserProfile | null>(null);

  const handleProfileManagementSelection = (profileId: string | null) => {
    const nextProfile = profileId ? profiles.find((profile) => profile.id === profileId) ?? null : null;
    setManagedProfile(nextProfile);
  };

  const handleOpenProfileManagement = (profileId?: string | null) => {
    handleProfileManagementSelection(profileId ?? activeProfile?.id ?? null);
    setIsProfileManagementModalOpen(true);
  };

  const location = useLocation();
  const navigate = useNavigate();
  const themeMode = useLayoutThemeMode();
  const { isMac } = useOS();
  const {
    hydrateFromBackend,
    quickFilterMetadata,
    hydrateQuickFilterMetadata,
    groupDirectory,
    tagDirectory,
    createCustomGroup,
    createGlobalTag,
    updateCustomGroup,
    deleteCustomGroup,
    updateGlobalTag,
    deleteGlobalTag,
    cleanupDanglingTags,
  } = useWorkspaceStore();
  const createNewView = useCanvasStore((state) => state.createNewView);
  const {
    inbox,
    unreadCount,
    markNotificationAsRead,
    togglePinnedNotification,
    archiveNotification,
    markAllNotificationsAsRead,
    archiveAllNotifications,
  } = useNotifications();
  const {
    profiles,
    activeProfile,
    tokenHealthMap,
    selectProfile,
    addProfile,
    updateProfile,
    deleteProfile,
  } = useProfileContext();

  const canCloneRemote =
    Boolean(activeProfile) &&
    activeProfile?.auth_level === 'full_oauth' &&
    (activeProfile ? tokenHealthMap[activeProfile.id] ?? 'none' : 'none') === 'healthy';

  const HEADER_H = 48;
  const openManagementModal = (initialTab: 'tags' | 'groups' = 'tags') => {
    setManagementInitialTab(initialTab);
    setIsManagementModalOpen(true);
  };

  const handleToggleNotificationDropdown = () => {
    if (isNotificationDropdownOpen) {
      setIsNotificationDropdownOpen(false);
      return;
    }

    setIsNotificationDropdownOpen(true);
    setIsRepositoryDropdownOpen(false);
    setIsProfileDropdownOpen(false);
  };

  const handleToggleRepositoryDropdown = () => {
    if (isRepositoryDropdownOpen) {
      setIsRepositoryDropdownOpen(false);
      return;
    }

    setIsRepositoryDropdownOpen(true);
    setIsNotificationDropdownOpen(false);
    setIsProfileDropdownOpen(false);
  };

  const handleToggleProfileDropdown = () => {
    if (isProfileDropdownOpen) {
      setIsProfileDropdownOpen(false);
      return;
    }

    setIsProfileDropdownOpen(true);
    setIsNotificationDropdownOpen(false);
    setIsRepositoryDropdownOpen(false);
  };

  useEffect(() => {
    const handleOpenManagementModal = (event: Event) => {
      const initialTab = (event as CustomEvent<{ initialTab?: 'tags' | 'groups' }>).detail?.initialTab ?? 'tags';
      setManagementInitialTab(initialTab);
      setIsManagementModalOpen(true);
    };

    window.addEventListener('open-management-modal', handleOpenManagementModal);
    return () => window.removeEventListener('open-management-modal', handleOpenManagementModal);
  }, []);

  useEffect(() => {
    void hydrateFromBackend();
  }, [hydrateFromBackend]);

  useEffect(() => {
    void hydrateQuickFilterMetadata();
  }, [hydrateQuickFilterMetadata]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOpenBulkImportModal = () => {
      setActiveRepositoryModal('bulk-import');
    };

    window.addEventListener('open-bulk-import-modal', handleOpenBulkImportModal);
    return () => {
      window.removeEventListener('open-bulk-import-modal', handleOpenBulkImportModal);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isNotificationShortcut = event.altKey && event.key.toLowerCase() === 'n';
      if (isNotificationShortcut) {
        event.preventDefault();
        setIsNotificationDropdownOpen((value) => !value);
        return;
      }

      if (event.key === 'Escape' && isNotificationDropdownOpen) {
        event.preventDefault();
        setIsNotificationDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNotificationDropdownOpen]);

  useEffect(() => {
    setIsNotificationDropdownOpen(false);
    setIsProfileDropdownOpen(false);
  }, [location.pathname]);

  const pageTitle: Record<string, string> = {
    '/': 'Home',
    '/branch-map': 'Branch Map',
    '/database': 'Database',
    '/settings': 'Settings',
  };
  const currentTitle = pageTitle[location.pathname] ?? 'Branch Schematic Canvas';

  const handleCreateView = async (options: {
    name: string;
    isFavorite: boolean;
    viewportDefaults: {
      zoomLevel: number;
      panX: number;
      panY: number;
    };
    scope?: {
      visiblePathIds?: string[];
      branchVisibility?: Record<string, string[]>;
    };
  }) => {
    await createNewView(options);
    await navigate({ to: '/branch-map' });
  };

  const childrenWithProps = isValidElement(children)
    ? cloneElement(children as ReactElement<{ onOpenManagementModal?: () => void; onCleanupDanglingTags?: () => Promise<number> }>, {
        onOpenManagementModal: openManagementModal,
        onCleanupDanglingTags: cleanupDanglingTags,
      })
    : children;

  return (
    <div style={{ ...styles.root, '--header-h': `${HEADER_H}px` } as React.CSSProperties}>

      {/* ── SIDEBAR OVERLAY PANEL ── */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenManagementModal={openManagementModal}
      />

      {/* ── TOPBAR (FULL WIDTH) ── */}
      <header
        style={{
          ...styles.header,
          height: HEADER_H,
          paddingLeft: isMac ? '80px' : '16px',
        }}
      >
        
        {/* Hamburger/Close Button */}
        <Button
          type="button"
          variant="basic"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`${isSidebarOpen ? 'is-active' : ''}`}
          style={styles.menuBtn}
          title={isSidebarOpen ? "Close navigation" : "Open navigation"}
        >
          {isSidebarOpen ? (
            <XIcon size={18} weight="bold" color="var(--app-text)" style={{ display: 'block' }} />
          ) : (
            <ListIcon size={18} weight="bold" color="var(--app-text)" style={{ display: 'block' }} />
          )}
        </Button>

        {/* Page breadcrumb */}
        <span style={styles.headerTitle}>{currentTitle}</span>

        {/* Dedicated drag surface so buttons remain clickable */}
        <div data-tauri-drag-region style={styles.dragRegion} />

        {/* Right: actions */}
        <div style={styles.headerRight}>
          <div style={{ position: 'relative' }}>
            <Button
              type="button"
              variant="basic"
              className={`titlebar-action-button ${isNotificationDropdownOpen ? 'is-active' : ''}`}
              style={styles.iconBtn}
              title="Notifications"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={handleToggleNotificationDropdown}
            >
              <BellIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
              {unreadCount > 0 && (
                <span style={styles.badge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            <NotificationDropdown
              isOpen={isNotificationDropdownOpen}
              onClose={() => setIsNotificationDropdownOpen(false)}
              notifications={inbox}
              unreadCount={unreadCount}
              onMarkAsRead={markNotificationAsRead}
              onTogglePin={togglePinnedNotification}
              onArchive={archiveNotification}
              onMarkAllAsRead={markAllNotificationsAsRead}
              onArchiveAll={archiveAllNotifications}
              onNavigate={(notification) => {
                setIsNotificationDropdownOpen(false);
                if (notification.route) {
                  void navigate({ to: notification.route as never });
                }
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Button
              type="button"
              variant="basic"
              ref={(node) => setRepositoryDropdownAnchor(node)}
              data-repository-dropdown-trigger
              className={`titlebar-action-button ${isRepositoryDropdownOpen ? 'is-active' : ''}`}
              style={styles.iconBtn}
              title="New"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={handleToggleRepositoryDropdown}
            >
              <PlusIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
            </Button>
            <RepositoryDropdown
              isOpen={isRepositoryDropdownOpen}
              onClose={() => setIsRepositoryDropdownOpen(false)}
              anchorElement={repositoryDropdownAnchor}
              canCloneRemote={canCloneRemote}
              onSelect={(action) => {
                setIsRepositoryDropdownOpen(false);
                setIsNotificationDropdownOpen(false);
                if (action === 'create-view') {
                  setActiveRepositoryModal('create-view');
                  return;
                }
                setActiveRepositoryModal(action);
              }}
            />
          </div>

          <Button
            type="button"
            variant="basic"
            style={styles.iconBtn}
            title={`Switch theme (current: ${themeMode})`}
            onClick={() => {
              document.documentElement.setAttribute(
                'data-theme',
                themeMode === 'dark' ? 'light' : 'dark'
              );
            }}
          >
            <CircleHalfIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
          </Button>

          <div style={{ position: 'relative' }}>
            <ProfileIndicator
              profile={activeProfile}
              status={activeProfile ? tokenHealthMap[activeProfile.id] ?? 'none' : 'none'}
              isOpen={isProfileDropdownOpen}
              onToggle={handleToggleProfileDropdown}
              onAnchorRef={setProfileDropdownAnchor}
              className={`titlebar-profile-button ${isProfileDropdownOpen ? 'is-active' : ''}`}
            />
            <ProfileDropdown
              isOpen={isProfileDropdownOpen}
              anchorElement={profileDropdownAnchor}
              profiles={profiles}
              activeProfile={activeProfile}
              tokenHealthMap={tokenHealthMap}
              onClose={() => setIsProfileDropdownOpen(false)}
              onSelectProfile={(profileId) => {
                console.info('[AppLayout] selectProfile requested', { profileId });
                void selectProfile(profileId);
                setIsProfileDropdownOpen(false);
              }}
              onToggleFavorite={(profileId, favorite) => {
                void updateProfile(profileId, { is_favorite: favorite });
              }}
              onOpenManagement={() => handleOpenProfileManagement(activeProfile?.id ?? null)}
            />
          </div>

          {!isMac && <WindowControls />}
        </div>
      </header>

      <AddLocalRepositoryModal
        isOpen={activeRepositoryModal === 'add-local'}
        onClose={() => setActiveRepositoryModal(null)}
      />

      <BulkImportLocalRepositoryModal
        isOpen={activeRepositoryModal === 'bulk-import'}
        onClose={() => setActiveRepositoryModal(null)}
      />

      <CreateRepositoryModal
        isOpen={activeRepositoryModal === 'create'}
        onClose={() => setActiveRepositoryModal(null)}
      />

      <CloneRemoteRepositoryModal
        isOpen={activeRepositoryModal === 'clone'}
        onClose={() => setActiveRepositoryModal(null)}
        onOpenProfileManagement={() => handleOpenProfileManagement(activeProfile?.id ?? null)}
      />

      <CreateViewModal
        isOpen={activeRepositoryModal === 'create-view'}
        onClose={() => setActiveRepositoryModal(null)}
        onCreate={handleCreateView}
      />

      <SettingsManagementModal
        isOpen={isManagementModalOpen}
        initialTab={managementInitialTab}
        groups={groupDirectory}
        tags={tagDirectory}
        danglingTagNames={quickFilterMetadata?.dangling_tags.map((tag) => tag.tag_name) ?? []}
        onClose={() => {
          setIsManagementModalOpen(false);
          setManagementInitialTab('tags');
        }}
        onCreateGroup={createCustomGroup}
        onCreateTag={createGlobalTag}
        onUpdateGroup={updateCustomGroup}
        onDeleteGroup={deleteCustomGroup}
        onUpdateTag={updateGlobalTag}
        onDeleteTag={deleteGlobalTag}
        onCleanupDanglingTags={cleanupDanglingTags}
      />

      <ProfileManagementModal
        isOpen={isProfileManagementModalOpen}
        onClose={() => {
          setIsProfileManagementModalOpen(false);
          setManagedProfile(null);
        }}
        profile={managedProfile}
        profiles={profiles}
        tokenHealthMap={tokenHealthMap}
        onCreateProfile={addProfile}
        onSaveProfile={updateProfile}
        onDeleteProfile={deleteProfile}
        onSelectProfile={handleProfileManagementSelection}
      />

      {/* ── MAIN CONTENT ── */}
      <main style={{ ...styles.main, top: HEADER_H }}>
        {childrenWithProps}
      </main>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, AppStyle> = {
  root: {
    width: '100vw',
    height: '100vh',
    backgroundColor: 'var(--app-bg)',
    color: 'var(--app-text)',
    fontFamily: 'Inter, system-ui, sans-serif',
    overflow: 'hidden',
    position: 'relative',
  },

  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--app-surface)',
    borderBottom: '1px solid var(--app-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 16px',
    userSelect: 'none',
    zIndex: 30,
  },

  menuBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },

  headerTitle: {
    fontWeight: 600,
    fontSize: '13px',
    color: 'var(--app-text)',
    whiteSpace: 'nowrap',
    minWidth: '80px',
  },

  dragRegion: {
    flex: 1,
    minWidth: 24,
    height: '100%',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  iconBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 999,
    backgroundColor: 'var(--accent, #3b82f6)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },

  main: {
    position: 'absolute',
    left: 0,
    width: '100vw',
    height: 'calc(100vh - var(--header-h))',
    overflowY: 'auto',
    scrollbarGutter: 'stable both-edges',
    backgroundColor: 'var(--app-bg)',
    boxSizing: 'border-box',
  },
};