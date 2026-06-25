import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useWorkspaceStore } from '../../stores/workspace-store';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Reacts instantly to your app's light/dark mode changes
function useLayoutThemeMode() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const updateTheme = () => {
      setThemeMode(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  return themeMode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isProjectHubOpen, setIsProjectHubOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const themeMode = useLayoutThemeMode();
  const isDark = themeMode === 'dark';
  const { repos, activeRepoId, hydrateFromBackend, selectRepo } = useWorkspaceStore();
  const activeRepo = repos.find((repo) => repo.id === activeRepoId) ?? null;

  const sidebarWidth = 64;
  const headerHeight = 60;
  const hubDrawerWidth = 320;

  useEffect(() => {
    void hydrateFromBackend();
  }, [hydrateFromBackend]);

  // --- Layout Theme-Aware Styles ---
  const containerStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    backgroundColor: 'var(--app-bg)',
    color: 'var(--app-text)',
    fontFamily: 'Inter, system-ui, sans-serif',
    overflow: 'hidden',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: sidebarWidth,
    width: `calc(100% - ${sidebarWidth}px)`,
    boxSizing: 'border-box',
    height: headerHeight,
    backgroundColor: 'var(--app-surface)',
    borderBottom: '1px solid var(--app-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 10,
  };

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: sidebarWidth,
    height: '100vh',
    boxSizing: 'border-box',
    backgroundColor: 'var(--app-surface)',
    borderRight: '1px solid var(--app-border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 0',
    zIndex: 20,
    justifyContent: 'space-between',
  };

  const sidebarIconStyle = (active = false): React.CSSProperties => ({
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: active ? 'var(--app-accent)' : 'transparent',
    color: active ? '#ffffff' : 'var(--app-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid transparent',
    fontSize: '20px',
    transition: 'all 0.2s ease',
  });

  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    top: headerHeight,
    left: sidebarWidth,
    width: hubDrawerWidth,
    height: `calc(100vh - ${headerHeight}px)`,
    backgroundColor: 'var(--app-surface)',
    borderRight: '1px solid var(--app-border)',
    transform: isProjectHubOpen ? 'translateX(0)' : `translateX(-${hubDrawerWidth + 10}px)`,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 5,
    padding: '20px',
    boxShadow: isProjectHubOpen ? '0 10px 30px var(--app-shadow)' : 'none',
  };

  const viewportFrameStyle: React.CSSProperties = {
    position: 'absolute',
    top: headerHeight,
    left: sidebarWidth,
    width: `calc(100vw - ${sidebarWidth}px)`,
    height: `calc(100vh - ${headerHeight}px)`,
    transition: 'padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    paddingLeft: isProjectHubOpen ? hubDrawerWidth : 0,
    overflowY: 'auto',
    backgroundColor: 'var(--app-bg)',
  };

  return (
    <div style={containerStyle}>
      {/* SIDEBAR ZONE */}
      <aside style={sidebarStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <div 
            style={{ fontWeight: 800, fontSize: '24px', marginBottom: '12px', cursor: 'pointer' }} 
            onClick={() => navigate({ to: '/' })}
          >
            🌿
          </div>
          
          <button 
            onClick={() => setIsProjectHubOpen(!isProjectHubOpen)}
            style={sidebarIconStyle(isProjectHubOpen)}
            title="Project Workspace Hub"
          >
            📂
          </button>

          <button 
            onClick={() => navigate({ to: '/branch-map' })}
            style={sidebarIconStyle(location.pathname === '/branch-map')}
            title="Interactive Branch Schematic"
          >
            🗺️
          </button>

          <button 
            onClick={() => navigate({ to: '/database' })}
            style={sidebarIconStyle(location.pathname === '/database')}
            title="Database Cache Engine Control Panel"
          >
            🗄️
          </button>
        </div>

        {/* SETTINGS AREA MOUNTED SECURELY AT THE BOTTOM */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={() => navigate({ to: '/settings' })}
            style={sidebarIconStyle(location.pathname === '/settings')}
            title="System Preferences & Theme Settings"
          >
            ⚙️
          </button>
        </div>
      </aside>

      {/* HEADER BAR */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>Branch Schematic Canvas</span>
        </div>
        <div style={{ fontSize: '14px', color: isDark ? '#9ca3af' : '#64748b' }}>
          Connected Repo: <strong style={{ color: isDark ? '#f3f4f6' : '#0f172a' }}>{activeRepo ? activeRepo.display_name : "None Selected"}</strong>
        </div>
      </header>

      {/* DRAWER LAYER */}
      <div style={drawerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--app-text)' }}>Project Hub</h3>
          <button onClick={() => setIsProjectHubOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--app-muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {repos.map((repo) => {
            const isSelected = activeRepo?.id === repo.id;
            return (
              <div 
                key={repo.id}
                onClick={() => {
                  selectRepo(repo);
                  setIsProjectHubOpen(false);
                }}
                style={{ 
                  padding: '12px', borderRadius: '8px', 
                  background: isSelected ? 'var(--app-surface-muted)' : 'transparent', 
                  border: `1px solid ${isSelected ? 'var(--app-accent)' : 'transparent'}`, 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--app-text)' }}>📁 {repo.display_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--app-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.absolute_path}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DYNAMIC CONTENT CONTAINER */}
      <main style={viewportFrameStyle}>
        {children}
      </main>
    </div>
  );
}