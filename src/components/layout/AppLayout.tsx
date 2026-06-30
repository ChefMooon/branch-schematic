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
  const [isProjectHubOpen, setIsProjectHubOpen] = useState(false);
  const [isRepositoryDropdownOpen, setIsRepositoryDropdownOpen] = useState(false);
  const [activeRepositoryModal, setActiveRepositoryModal] = useState<RepositoryModalAction | null>(null);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const themeMode = useLayoutThemeMode();
  const { isMac } = useOS();
  const {
    repos,
    activeRepoId,
    hydrateFromBackend,
    quickFilterMetadata,
    hydrateQuickFilterMetadata,
    groupDirectory,
    tagDirectory,
    updateCustomGroup,
    deleteCustomGroup,
    updateGlobalTag,
    deleteGlobalTag,
    cleanupDanglingTags,
  } = useWorkspaceStore();
  const createNewView = useCanvasStore((state) => state.createNewView);
  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? null;

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
        isProjectHubOpen={isProjectHubOpen}
        onToggleProjectHub={() => setIsProjectHubOpen((v) => !v)}
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

        {/* Right: actions + repo badge */}
        <div style={styles.headerRight}>
          {activeRepo && (
            <span style={styles.repoBadge} title={activeRepo.absolute_path}>
              📁 {activeRepo.display_name}
            </span>
          )}

          <button
            style={styles.iconBtn}
            title="Notifications"
            onClick={() => {/* TODO */}}
          >
            <BellIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              style={styles.iconBtn}
              title="New"
              onClick={() => setIsRepositoryDropdownOpen((value) => !value)}
            >
              <PlusIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
            </button>
            <RepositoryDropdown
              isOpen={isRepositoryDropdownOpen}
              onClose={() => setIsRepositoryDropdownOpen(false)}
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

  repoBadge: {
    fontSize: '12px',
    color: 'var(--app-muted)',
    backgroundColor: 'var(--app-surface-muted)',
    border: '1px solid var(--app-border)',
    borderRadius: '20px',
    padding: '3px 10px',
    whiteSpace: 'nowrap',
    maxWidth: '160px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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