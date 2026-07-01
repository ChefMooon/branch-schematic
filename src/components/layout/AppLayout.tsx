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
import { WindowControls } from '../titlebar/WindowControls';
import { AppSidebar } from './AppSidebar';
import { RepositoryDropdown } from '../../features/repository/components/RepositoryDropdown';
import { AddLocalRepositoryModal } from '../../features/repository/components/AddLocalRepositoryModal';
import { BulkImportLocalRepositoryModal } from '../../features/repository/components/BulkImportLocalRepositryModal';
import { CreateRepositoryModal } from '../../features/repository/components/CreateRepositoryModal';
import { CreateViewModal } from '../../features/canvas-views/components/CreateViewModal';
import { SettingsManagementModal } from '../../features/management/components/SettingsManagementModal';
import { useCanvasStore } from '../../stores/canvas-store';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useNotifications } from '../notifications/NotificationProvider';
import type { RepositoryModalAction } from '../../features/repository/types';

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

  const HEADER_H = 48;

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
    ? cloneElement(children as ReactElement<{ onOpenManagementModal?: () => void }>, {
        onOpenManagementModal: () => setIsManagementModalOpen(true),
      })
    : children;

  return (
    <div style={{ ...styles.root, '--header-h': `${HEADER_H}px` } as React.CSSProperties}>

      {/* ── SIDEBAR OVERLAY PANEL ── */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenManagementModal={() => setIsManagementModalOpen(true)}
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
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={styles.menuBtn}
          title={isSidebarOpen ? "Close navigation" : "Open navigation"}
        >
          {isSidebarOpen ? (
            <XIcon size={18} weight="bold" color="var(--app-text)" style={{ display: 'block' }} />
          ) : (
            <ListIcon size={18} weight="bold" color="var(--app-text)" style={{ display: 'block' }} />
          )}
        </button>

        {/* Page breadcrumb */}
        <span style={styles.headerTitle}>{currentTitle}</span>

        {/* Dedicated drag surface so buttons remain clickable */}
        <div data-tauri-drag-region style={styles.dragRegion} />

        {/* Right: actions */}
        <div style={styles.headerRight}>
          <div style={{ position: 'relative' }}>
            <button
              style={styles.iconBtn}
              title="Notifications"
              onClick={() => setIsNotificationDropdownOpen((value) => !value)}
            >
              <BellIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
              {unreadCount > 0 && (
                <span style={styles.badge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
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
            <button
              ref={(node) => setRepositoryDropdownAnchor(node)}
              data-repository-dropdown-trigger
              style={styles.iconBtn}
              title="New"
              onClick={() => setIsRepositoryDropdownOpen((value) => !value)}
            >
              <PlusIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
            </button>
            <RepositoryDropdown
              isOpen={isRepositoryDropdownOpen}
              onClose={() => setIsRepositoryDropdownOpen(false)}
              anchorElement={repositoryDropdownAnchor}
              onSelect={(action) => {
                setIsRepositoryDropdownOpen(false);
                if (action === 'create-view') {
                  setActiveRepositoryModal('create-view');
                  return;
                }
                setActiveRepositoryModal(action);
              }}
            />
          </div>

          <button
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
          </button>

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

      <CreateViewModal
        isOpen={activeRepositoryModal === 'create-view'}
        onClose={() => setActiveRepositoryModal(null)}
        onCreate={handleCreateView}
      />

      <SettingsManagementModal
        isOpen={isManagementModalOpen}
        groups={groupDirectory}
        tags={tagDirectory}
        danglingTagNames={quickFilterMetadata?.dangling_tags.map((tag) => tag.tag_name) ?? []}
        onClose={() => setIsManagementModalOpen(false)}
        onCreateGroup={createCustomGroup}
        onCreateTag={createGlobalTag}
        onUpdateGroup={updateCustomGroup}
        onDeleteGroup={deleteCustomGroup}
        onUpdateTag={updateGlobalTag}
        onDeleteTag={deleteGlobalTag}
        onCleanupDanglingTags={cleanupDanglingTags}
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
    borderRadius: '6px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'transparent',
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
    borderRadius: '6px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'transparent',
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
    backgroundColor: 'var(--app-bg)',
    boxSizing: 'border-box',
  },
};