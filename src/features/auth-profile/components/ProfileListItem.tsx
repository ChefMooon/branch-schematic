import { useState } from 'react';
import { GithubLogo, Star, Trash, UserCircle } from '@phosphor-icons/react';
import type { TokenHealthStatus, UserProfile } from '../types';
import { getProfileAvatarUrl } from '../utils/profileAvatar';

interface ProfileListItemProps {
  profile: UserProfile;
  isSelected: boolean;
  isFavorite: boolean;
  status: TokenHealthStatus;
  onSelectProfile: (profileId: string) => void;
  onToggleFavorite: (profileId: string, favorite: boolean) => void | Promise<void>;
  onDeleteProfile: (profileId: string) => void | Promise<void>;
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

export function ProfileListItem({
  profile,
  isSelected,
  isFavorite,
  status,
  onSelectProfile,
  onToggleFavorite,
  onDeleteProfile,
}: ProfileListItemProps) {
  const [isMainHovered, setIsMainHovered] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<'favorite' | 'delete' | null>(null);
  const avatarUrl = getProfileAvatarUrl(profile);
  const isFullOauth = profile.auth_level === 'full_oauth';
  const statusInfo = getStatusInfo(status);

  const renderAvatar = () => {
    if (avatarUrl) {
      return <img src={avatarUrl} alt={profile.display_name} style={styles.avatarImage} />;
    }

    if (isFullOauth) {
      return <GithubLogo size={16} color="var(--app-text)" />;
    }

    return <UserCircle size={16} color="var(--app-text)" />;
  };

  return (
    <div
      style={{
        ...styles.row,
        borderColor: isSelected ? 'var(--accent, #3b82f6)' : (isMainHovered ? 'var(--app-border-strong, rgba(255,255,255,0.16))' : 'var(--app-border)'),
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : (isMainHovered ? 'rgba(255,255,255,0.04)' : 'var(--app-surface)'),
      }}
    >
      <button
        type="button"
        onClick={() => onSelectProfile(profile.id)}
        onMouseEnter={() => setIsMainHovered(true)}
        onMouseLeave={() => setIsMainHovered(false)}
        style={{
          ...styles.mainButton,
          backgroundColor: isMainHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        }}
        aria-label={`Select profile ${profile.display_name}`}
      >
        <div style={styles.avatarWrap}>{renderAvatar()}</div>
        <div style={styles.textBlock}>
          <div style={styles.nameRow}>
            <div style={styles.name}>{profile.display_name}</div>
          </div>
          <div style={styles.meta}>
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
      <div style={styles.actions}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void onToggleFavorite(profile.id, !isFavorite);
          }}
          onMouseEnter={() => setHoveredAction('favorite')}
          onMouseLeave={() => setHoveredAction(null)}
          style={{
            ...styles.iconButton,
            color: isFavorite ? '#f59e0b' : (hoveredAction === 'favorite' ? 'var(--app-text)' : 'var(--app-text-muted, #64748b)'),
            backgroundColor: hoveredAction === 'favorite' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
            borderColor: hoveredAction === 'favorite' ? 'rgba(245, 158, 11, 0.28)' : 'var(--app-border)',
          }}
          title={isFavorite ? `Unfavorite profile ${profile.display_name}` : `Favorite profile ${profile.display_name}`}
          aria-label={isFavorite ? `Unfavorite profile ${profile.display_name}` : `Favorite profile ${profile.display_name}`}
        >
          <Star size={14} weight={isFavorite ? 'fill' : 'regular'} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void onDeleteProfile(profile.id);
          }}
          onMouseEnter={() => setHoveredAction('delete')}
          onMouseLeave={() => setHoveredAction(null)}
          style={{
            ...styles.iconButton,
            color: hoveredAction === 'delete' ? '#f43f5e' : '#ef4444',
            backgroundColor: hoveredAction === 'delete' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
            borderColor: hoveredAction === 'delete' ? 'rgba(239, 68, 68, 0.28)' : 'var(--app-border)',
          }}
          title={`Delete profile ${profile.display_name}`}
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    border: '1px solid var(--app-border)',
    borderRadius: '8px',
    padding: '8px 10px',
    backgroundColor: 'var(--app-surface)',
    minWidth: 0,
    transition: 'border-color 120ms ease, background-color 120ms ease',
  },
  mainButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
    border: 'none',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    padding: '2px 0',
    textAlign: 'left',
    overflow: 'hidden',
  },
  avatarWrap: {
    width: '28px',
    height: '28px',
    marginLeft: '2px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  textBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '6px',
    minWidth: 0,
    width: '100%',
  },
  name: {
    fontWeight: 600,
    fontSize: '13px',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12px',
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
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  iconButton: {
    border: '1px solid var(--app-border)',
    borderRadius: '999px',
    width: '30px',
    height: '30px',
    backgroundColor: 'transparent',
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
    flexShrink: 0,
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
  },
};
