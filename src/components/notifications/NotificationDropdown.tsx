import { useEffect } from 'react';
import { ArchiveIcon, BellSimpleRingingIcon, EyeIcon, PushPinIcon, PushPinSlashIcon } from '@phosphor-icons/react';
import type { NotificationEntry } from './NotificationProvider';
import { Button } from '../button/Button';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationEntry[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onTogglePin: (id: string) => void;
  onArchive: (id: string) => void;
  onMarkAllAsRead: () => void;
  onArchiveAll: () => void;
  onNavigate: (notification: NotificationEntry) => void;
}

export function NotificationDropdown({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onTogglePin,
  onArchive,
  onMarkAllAsRead,
  onArchiveAll,
  onNavigate,
}: NotificationDropdownProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-notification-dropdown-root]')) return;
      onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-notification-dropdown-root
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        width: 320,
        maxHeight: 'min(480px, calc(100vh - 120px))',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        border: '1px solid var(--app-border)',
        background: 'var(--app-surface)',
        boxShadow: '0 20px 50px -24px rgba(15, 23, 42, 0.65)',
        zIndex: 45,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 12px 8px', borderBottom: '1px solid var(--app-border)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Notifications</div>
          <div style={{ fontSize: 12, color: 'var(--app-text-muted, #64748b)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="basic" onClick={onMarkAllAsRead} title="Mark all as read">
            <EyeIcon size={14} />
          </Button>
          <Button type="button" variant="basic" onClick={onArchiveAll} title="Archive all">
            <ArchiveIcon size={14} />
          </Button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--app-text-muted, #64748b)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <BellSimpleRingingIcon size={20} />
            </div>
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                onMarkAsRead(notification.id);
                if (notification.route) {
                  onNavigate(notification);
                }
              }}
              style={{
                borderRadius: 10,
                border: notification.isPinned ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--app-border)',
                background: notification.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
                padding: 10,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{notification.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--app-text-muted, #64748b)' }}>{notification.message}</div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePin(notification.id);
                  }}
                  style={iconButtonStyle}
                  title={notification.isPinned ? 'Unpin notification' : 'Pin notification'}
                >
                  {notification.isPinned ? <PushPinSlashIcon size={13} /> : <PushPinIcon size={13} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted, #64748b)' }}>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Just now'}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!notification.isRead && (
                    <span style={{ fontSize: 11, padding: '3px 6px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.16)', color: 'var(--app-text)' }}>Unread</span>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onArchive(notification.id);
                    }}
                    style={iconButtonStyle}
                    title="Archive notification"
                  >
                    <ArchiveIcon size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--app-text)',
  cursor: 'pointer',
  padding: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
