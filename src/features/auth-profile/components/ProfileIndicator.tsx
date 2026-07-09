import type { CSSProperties } from 'react';
import { GithubLogo, UserCircle } from '@phosphor-icons/react';
import type { TokenHealthStatus, UserProfile } from '../types';
import { getProfileAvatarUrl } from '../utils/profileAvatar';
import '../../../components/layout/titlebar.css';

interface ProfileIndicatorProps {
  profile: UserProfile | null;
  status: TokenHealthStatus;
  isOpen: boolean;
  onToggle: () => void;
  onAnchorRef: (node: HTMLButtonElement | null) => void;
  className?: string;
}

const statusColor: Record<TokenHealthStatus, string> = {
  healthy: '#22c55e',
  expired: '#f59e0b',
  unreachable: '#ef4444',
  none: '#64748b',
};

export function ProfileIndicator({ profile, status, isOpen, onToggle, onAnchorRef, className }: ProfileIndicatorProps) {
  const avatarUrl = getProfileAvatarUrl(profile);
  const isFullOauth = profile?.auth_level === 'full_oauth';

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={onAnchorRef}
        type="button"
        className={className}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onToggle}
        title={profile ? `Active profile: ${profile.display_name}` : 'Select profile'}
        style={{
          ...styles.button,
          borderColor: isOpen ? 'var(--accent, #3b82f6)' : 'var(--app-border)',
        }}
      >
        <div style={styles.avatarFrame}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={profile?.display_name ?? 'Profile'} style={styles.avatarImage} />
          ) : isFullOauth ? (
            <GithubLogo size={18} color="var(--app-text)" />
          ) : (
            <UserCircle size={18} color="var(--app-text)" />
          )}
        </div>
      </button>
      <span style={{ ...styles.statusDot, backgroundColor: statusColor[status] }} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  button: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'var(--app-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarFrame: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -3,
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    border: '2px solid var(--app-surface)',
  },
};
