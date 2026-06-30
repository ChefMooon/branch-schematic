import { useNavigate, useLocation } from '@tanstack/react-router';
import {
  HouseIcon,
  GitBranchIcon,
  DatabaseIcon,
  GearSixIcon,
  FolderOpenIcon,
  CaretRightIcon,
} from '@phosphor-icons/react';
import { useWorkspaceStore } from '../../stores/workspace-store';
import './AppSidebar.css';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to: string;
}

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isProjectHubOpen: boolean;
  onToggleProjectHub: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',           icon: <HouseIcon size={16} color="currentColor" style={{ display: 'block' }} />,      to: '/' },
  { label: 'Branch Map',     icon: <GitBranchIcon size={16} color="currentColor" style={{ display: 'block' }} />,  to: '/branch-map' },
  { label: 'DatabaseIcon',       icon: <DatabaseIcon size={16} color="currentColor" style={{ display: 'block' }} />,   to: '/database' },
];

export function AppSidebar({ isOpen, onClose, isProjectHubOpen, onToggleProjectHub }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { repos, activeRepoId, selectRepo } = useWorkspaceStore();
  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? null;

  return (
    <>
      <aside 
        style={{
          ...styles.sidebar,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Logo */}
        <div style={styles.logoRow} onClick={() => { navigate({ to: '/' }); onClose(); }}>
          <span style={styles.logoMark}>🌿</span>
          <span style={styles.logoText}>Verdant</span>
        </div>

        <hr style={styles.divider} />

        {/* Project Hub toggle */}
        <button
          onClick={onToggleProjectHub}
          className={`sidebar-nav-item ${isProjectHubOpen ? 'is-active' : ''}`}
          title="Project Hub"
        >
          <FolderOpenIcon size={16} weight={isProjectHubOpen ? 'fill' : 'regular'} color="currentColor" style={{ display: 'block' }} />
          <span style={styles.navLabel}>Project Hub</span>
          <CaretRightIcon
            size={12}
            color="currentColor"
            style={{
              marginLeft: 'auto',
              opacity: 0.4,
              transform: isProjectHubOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s ease',
              display: 'block',
            }}
          />
        </button>

        {/* Repo list */}
        {isProjectHubOpen && repos.length > 0 && (
          <div style={styles.repoList}>
            {repos.map((repo) => {
              const selected = activeRepo?.id === repo.id;
              return (
                <button
                  key={repo.id}
                  onClick={() => {
                    selectRepo(repo);
                    onClose();
                  }}
                  className={`sidebar-repo-item ${selected ? 'is-selected' : ''}`}
                  title={repo.absolute_path}
                >
                  <span style={styles.repoIcon}>📁</span>
                  <span style={styles.repoName}>{repo.display_name}</span>
                </button>
              );
            })}
          </div>
        )}

        <hr style={styles.divider} />

        {/* Main nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV_ITEMS.map(({ label, icon, to }) => {
            const active = location.pathname === to || (to === '/' && location.pathname === '/');
            return (
              <button
                key={to}
                onClick={() => {
                  navigate({ to });
                  onClose();
                }}
                className={`sidebar-nav-item ${active ? 'is-active' : ''}`}
                title={label}
              >
                {icon}
                <span style={styles.navLabel}>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom: Settings */}
        <div style={styles.bottomArea}>
          <hr style={styles.divider} />
          <button
            onClick={() => {
              navigate({ to: '/settings' });
              onClose();
            }}
            className={`sidebar-nav-item ${location.pathname === '/settings' ? 'is-active' : ''}`}
            title="Settings"
          >
            <GearSixIcon size={16} color="currentColor" style={{ display: 'block' }} />
            <span style={styles.navLabel}>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const SIDEBAR_W = 200;

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'fixed',
    top: '48px',
    left: 0,
    width: SIDEBAR_W,
    height: 'calc(100vh - 48px)',
    boxSizing: 'border-box',
    backgroundColor: 'var(--app-surface)',
    borderRight: '1px solid var(--app-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 12px 12px',
    zIndex: 20,
    overflowY: 'auto',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '4px 8px 12px',
    cursor: 'pointer',
  },
  logoMark: {
    fontSize: '22px',
    lineHeight: 1,
  },
  logoText: {
    fontWeight: 700,
    fontSize: '15px',
    color: 'var(--app-text)',
    letterSpacing: '-0.01em',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid var(--app-border)',
    margin: '8px 0',
  },
  navLabel: {
    fontSize: '13px',
    fontWeight: 500,
  },
  repoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    paddingLeft: '24px',
    marginBottom: '4px',
  },
  repoIcon: {
    fontSize: '13px',
    lineHeight: 1,
  },
  repoName: {
    fontSize: '12px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bottomArea: {
    marginTop: 'auto',
  },
};