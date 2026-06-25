import { useState, useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import {
  MagnifyingGlassIcon,
  BellIcon,
  PlusIcon,
  CircleHalfIcon,
  ListIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { AppSidebar } from './app-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

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
  const [searchValue, setSearchValue] = useState('');

  const location = useLocation();
  const themeMode = useLayoutThemeMode();
  const { repos, activeRepoId, hydrateFromBackend } = useWorkspaceStore();
  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? null;

  const HEADER_H = 48;

  useEffect(() => {
    void hydrateFromBackend();
  }, [hydrateFromBackend]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const pageTitle: Record<string, string> = {
    '/': 'Home',
    '/branch-map': 'Branch Map',
    '/database': 'Database',
    '/settings': 'Settings',
  };
  const currentTitle = pageTitle[location.pathname] ?? 'Branch Schematic Canvas';

  return (
    <div style={{ ...styles.root, '--header-h': `${HEADER_H}px` } as React.CSSProperties}>

      {/* ── SIDEBAR OVERLAY PANEL ── */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isProjectHubOpen={isProjectHubOpen}
        onToggleProjectHub={() => setIsProjectHubOpen((v) => !v)}
      />

      {/* ── TOPBAR (FULL WIDTH) ── */}
      <header style={{ ...styles.header, height: HEADER_H }}>
        
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

        {/* Center: search */}
        <div style={styles.searchWrapper}>
          <MagnifyingGlassIcon size={14} color="var(--app-muted)" style={{ flexShrink: 0, display: 'block' }} />
          <input
            type="text"
            placeholder="Search or jump to…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={styles.searchInput}
          />
          <kbd style={styles.searchKbd}>/</kbd>
        </div>

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

          <button
            style={styles.iconBtn}
            title="New"
            onClick={() => {/* TODO */}}
          >
            <PlusIcon size={18} color="var(--app-text)" style={{ display: 'block' }} />
          </button>

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
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ ...styles.main, top: HEADER_H }}>
        {children}
      </main>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
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

  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: '1 1 0',
    maxWidth: '320px',
    margin: '0 auto',
    backgroundColor: 'var(--app-bg)',
    border: '1px solid var(--app-border)',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '13px',
  },

  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '13px',
    color: 'var(--app-text)',
    fontFamily: 'inherit',
  },

  searchKbd: {
    fontSize: '11px',
    color: 'var(--app-muted)',
    border: '1px solid var(--app-border)',
    borderRadius: '4px',
    padding: '1px 5px',
    lineHeight: '1.4',
    backgroundColor: 'var(--app-surface)',
    fontFamily: 'inherit',
  },

  headerRight: {
    marginLeft: 'auto',
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