import { useEffect, useState } from 'react';
import { GearSix, Star, UserCircle } from '@phosphor-icons/react';
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

const getStatusInfo = (status: TokenHealthStatus) => {
  switch (status) {
    case 'healthy':
      return {
        label: 'Healthy',
        textColor: 'rgba(34, 197, 84, 0.96)',
        badgeBackground: 'rgba(34, 197, 84, 0.12)',
        borderColor: 'rgba(34, 197, 84, 0.24)',
      };
    case 'expired':
      return {
        label: 'Expired',
        textColor: 'rgba(245, 158, 11, 0.96)',
        badgeBackground: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.24)',
      };
    case 'unreachable':
      return {
        label: 'Unreachable',
        textColor: 'rgba(239, 68, 68, 0.96)',
        badgeBackground: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.24)',
      };
    default:
      return {
        label: 'No token',
        textColor: 'var(--app-text-muted, #64748b)',
        badgeBackground: 'rgba(148, 163, 184, 0.12)',
        borderColor: 'rgba(148, 163, 184, 0.22)',
      };
  }
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
  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);
  const [hoveredFavoriteId, setHoveredFavoriteId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-profile-dropdown-root]')) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

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
    <div data-testid="profile-dropdown-overlay" style={{ ...styles.overlay, pointerEvents: 'none' }} onClick={onClose}>
      <div
        data-testid="profile-dropdown-backdrop"
        data-profile-dropdown-root
        style={{ ...styles.dropdown, top: position.top, left: position.left, pointerEvents: 'auto' }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.list}>
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfile?.id;
            const isFavorite = Number(profile.is_favorite ?? 0) === 1;
            const status = tokenHealthMap[profile.id] ?? 'none';
            const statusInfo = getStatusInfo(status);
            const isRowHovered = hoveredProfileId === profile.id;
            const isFavoriteHovered = hoveredFavoriteId === profile.id;

            return (
              <div
                key={profile.id}
                style={{
                  ...styles.row,
                  borderColor: isActive ? 'var(--accent, #3b82f6)' : (isRowHovered ? 'var(--app-border-strong, rgba(255,255,255,0.16))' : 'var(--app-border)'),
                  backgroundColor: isActive ? 'rgba(59, 130, 246, 0.12)' : (isRowHovered ? 'rgba(255,255,255,0.04)' : 'transparent'),
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectProfile(profile.id)}
                  onMouseEnter={() => setHoveredProfileId(profile.id)}
                  onMouseLeave={() => setHoveredProfileId(null)}
                  style={{
                    ...styles.rowButton,
                    backgroundColor: isRowHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                  }}
                  aria-label={`Select profile ${profile.display_name}`}
                >
                  <div style={styles.rowAvatarWrap}>
                    {renderAvatar(profile, 16)}
                  </div>
                  <div style={styles.rowText}>
                    <div style={styles.rowTitleRow}>
                      <div style={styles.rowTitle}>{profile.display_name}</div>
                    </div>
                    <div style={styles.rowMeta}>
                      <span style={styles.metaLabel}>{profile.auth_level.replace('_', ' ')}</span>
                      <span style={styles.metaSeparator}>•</span>
                      <span
                        style={{
                          ...styles.statusText,
                          color: statusInfo.textColor,
                          backgroundColor: statusInfo.badgeBackground,
                          borderColor: statusInfo.borderColor,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onToggleFavorite(profile.id, !isFavorite);
                  }}
                  onMouseEnter={() => setHoveredFavoriteId(profile.id)}
                  onMouseLeave={() => setHoveredFavoriteId(null)}
                  style={{
                    ...styles.iconButton,
                    color: isFavorite ? '#f59e0b' : (isFavoriteHovered ? 'var(--app-text)' : 'var(--app-text-muted, #64748b)'),
                    backgroundColor: isFavoriteHovered ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                    borderColor: isFavoriteHovered ? 'rgba(245, 158, 11, 0.28)' : 'var(--app-border)',
                  }}
                  title={isFavorite ? `Unfavorite profile ${profile.display_name}` : `Favorite profile ${profile.display_name}`}
                  aria-label={isFavorite ? `Unfavorite profile ${profile.display_name}` : `Favorite profile ${profile.display_name}`}
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
    borderRadius: '10px',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.24)',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
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
    border: '1px solid var(--app-border)',
    borderRadius: '8px',
    padding: '8px',
    backgroundColor: 'transparent',
    color: 'inherit',
    minWidth: 0,
    transition: 'border-color 120ms ease, background-color 120ms ease',
  },
  rowButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    minWidth: 0,
    gap: '8px',
    border: 'none',
    borderRadius: '6px',
    padding: '2px 0',
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    overflow: 'hidden',
  },
  rowAvatarWrap: {
    width: '24px',
    height: '24px',
    marginLeft: '2px',
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
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
  },
  rowTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '6px',
    minWidth: 0,
    width: '100%',
    overflow: 'hidden',
  },
  rowTitle: {
    fontSize: '13px',
    fontWeight: 600,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  activePill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '18px',
    padding: '1px 6px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 700,
    lineHeight: 1,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--accent, #3b82f6)',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    flexShrink: 0,
    alignSelf: 'center',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '11px',
    color: 'var(--app-text-muted, #64748b)',
  },
  metaLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metaSeparator: {
    flexShrink: 0,
  },
  statusText: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 6px',
    borderRadius: '999px',
    border: '1px solid',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 600,
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
    flexShrink: 0,
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
  },
  manageButton: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
    color: 'inherit',
    cursor: 'pointer',
  },
};
