import { useNavigate, useLocation } from '@tanstack/react-router';
import {
  HouseIcon,
  GitBranchIcon,
  DatabaseIcon,
  GearSixIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import { AppLogo } from '../app-logo/AppLogo';
import './layout.css';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to: string;
}

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenManagementModal?: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',           icon: <HouseIcon size={16} color="currentColor" style={{ display: 'block' }} />,      to: '/' },
  { label: 'Branch Map',     icon: <GitBranchIcon size={16} color="currentColor" style={{ display: 'block' }} />,  to: '/branch-map' },
  { label: 'DatabaseIcon',       icon: <DatabaseIcon size={16} color="currentColor" style={{ display: 'block' }} />,   to: '/database' },
];

export function AppSidebar({ isOpen, onClose, onOpenManagementModal }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

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
          <AppLogo size={48} className="ml-4" style={{ marginTop: '0.5rem' }} />
          <span style={styles.logoText}>Branch Schematic</span>
        </div>

        <hr style={styles.divider} />

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

        <div style={styles.bottomArea}>
          <hr style={styles.divider} />
          <button
            onClick={() => {
              onOpenManagementModal?.();
              window.dispatchEvent(new Event('open-management-modal'));
              onClose();
            }}
            className="sidebar-nav-item"
            title="Manage Tags/Groups"
          >
            <WrenchIcon size={16} color="currentColor" style={{ display: 'block' }} />
            <span style={styles.navLabel}>Manage Tags/Groups</span>
          </button>
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
  bottomArea: {
    marginTop: 'auto',
  },
};