import { useEffect, useState } from 'react';
import { CheckCircle, GearSix, Star, UserCircle } from '@phosphor-icons/react';
import type { TokenHealthStatus, UserProfile } from '../types';
import { getProfileAvatarUrl } from '../utils/profileAvatar';

interface ProfileDropdownProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  tokenHealthMap: Record<string, TokenHealthStatus>;
  onClose: () => void;
  onSelectProfile: (profileId: string) => void;
  onToggleFavorite: (profileId: string, favorite: boolean) => void | Promise<void>;
  onOpenManagement: () => void;
}

const statusLabel: Record<TokenHealthStatus, string> = {
  healthy: 'Healthy',
  expired: 'Expired',
  unreachable: 'Unreachable',
  none: 'No token',
};

export function ProfileDropdown({
  isOpen,
  anchorElement,
  profiles,
  activeProfile,
  tokenHealthMap,
  onClose,
  onSelectProfile,
  onToggleFavorite,
  onOpenManagement,
}: ProfileDropdownProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !anchorElement) {
      return;
    }

    const updatePosition = () => {
      const rect = anchorElement.getBoundingClientRect();
      const dropdownWidth = 260;
      const margin = 16;
      const rightAlignedLeft = rect.right - dropdownWidth;
      const maxLeft = window.innerWidth - dropdownWidth - margin;
      const left = Math.min(Math.max(margin, rightAlignedLeft), maxLeft);
      setPosition({ top: rect.bottom + 8, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorElement, isOpen]);

  if (!isOpen || !anchorElement) {
    return null;
  }

  const handleSelectProfile = (profileId: string) => {
    onSelectProfile(profileId);
    onClose();
  };

  const renderAvatar = (profile: UserProfile | null, size: number) => {
    const avatarUrl = getProfileAvatarUrl(profile);

    if (avatarUrl) {
      return <img src={avatarUrl} alt={profile?.display_name ?? 'Profile'} style={size === 18 ? styles.avatarImage : styles.rowAvatarImage} />;
    }

    return <UserCircle size={size} />;
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.dropdown, top: position.top, left: position.left }} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>Active profile</div>
          <div style={styles.activeCard}>
            <div style={styles.avatarBadge}>
              {renderAvatar(activeProfile, 18)}
            </div>
            <div>
              <div style={styles.activeName}>{activeProfile?.display_name ?? 'No profile selected'}</div>
              <div style={styles.activeMeta}>{activeProfile?.auth_level?.replace('_', ' ') ?? 'basic'}</div>
            </div>
          </div>
        </div>

        <div style={styles.list}>
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfile?.id;
            const isFavorite = Number(profile.is_favorite ?? 0) === 1;
            const status = tokenHealthMap[profile.id] ?? 'none';
            return (
              <div key={profile.id} style={{ ...styles.row, borderColor: isActive ? 'var(--accent, #3b82f6)' : 'transparent' }}>
                <button
                  type="button"
                  onClick={() => handleSelectProfile(profile.id)}
                  style={styles.rowButton}
                >
                  <div style={styles.rowAvatarWrap}>
                    {renderAvatar(profile, 16)}
                  </div>
                  <div style={styles.rowText}>
                    <div style={styles.rowTitle}>{profile.display_name}</div>
                    <div style={styles.rowMeta}>{profile.auth_level.replace('_', ' ')} • {statusLabel[status]}</div>
                  </div>
                  {isActive ? <CheckCircle size={16} color="var(--accent, #3b82f6)" /> : null}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onToggleFavorite(profile.id, !isFavorite);
                  }}
                  style={{ ...styles.iconButton, color: isFavorite ? '#f59e0b' : 'inherit' }}
                  title={isFavorite ? 'Unfavorite profile' : 'Favorite profile'}
                >
                  <Star size={14} weight={isFavorite ? 'fill' : 'regular'} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenManagement();
            onClose();
          }}
          style={styles.manageButton}
        >
          <GearSix size={16} />
          <span>Manage profiles</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
  },
  dropdown: {
    position: 'fixed',
    width: '260px',
    backgroundColor: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: '12px',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.24)',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  headerTitle: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--app-text-muted, #64748b)',
  },
  activeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px',
    borderRadius: '10px',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
  },
  avatarBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  activeName: {
    fontWeight: 600,
    fontSize: '13px',
  },
  activeMeta: {
    fontSize: '11px',
    color: 'var(--app-text-muted, #64748b)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '220px',
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    border: '1px solid transparent',
    borderRadius: '10px',
    padding: '8px',
    backgroundColor: 'transparent',
    color: 'inherit',
  },
  rowButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    gap: '8px',
    border: 'none',
    padding: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  },
  rowAvatarWrap: {
    width: '24px',
    height: '24px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  rowAvatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  rowText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rowTitle: {
    fontSize: '13px',
    fontWeight: 600,
  },
  rowMeta: {
    fontSize: '11px',
    color: 'var(--app-text-muted, #64748b)',
  },
  iconButton: {
    border: '1px solid var(--app-border)',
    borderRadius: '999px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
  },
  manageButton: {
    border: 'none',
    borderRadius: '10px',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
    color: 'inherit',
    cursor: 'pointer',
  },
};
