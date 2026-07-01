import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNotificationListener, type NotificationPayload } from '../../hooks/useNotificationListener';
import { Toast } from './toast';

export type NotificationVariant = 'info' | 'success' | 'warning' | 'error';

export interface NotificationToast extends NotificationPayload {
  id: number;
  variant: NotificationVariant;
  duration: number;
}

export interface NotificationEntry {
  id: string;
  title: string;
  message: string;
  variant: NotificationVariant;
  isRead: boolean;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  route?: string;
  routeParams?: Record<string, string>;
}

interface NotificationContextValue {
  toasts: NotificationToast[];
  inbox: NotificationEntry[];
  unreadCount: number;
  addToast: (payload: NotificationPayload) => void;
  dismissToast: (id: number) => void;
  markNotificationAsRead: (id: string) => void;
  togglePinnedNotification: (id: string) => void;
  archiveNotification: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  archiveAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

function useAppThemeMode() {
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

function NotificationBridge() {
  useNotificationListener();
  return null;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [inbox, setInbox] = useState<NotificationEntry[]>([]);
  const themeMode = useAppThemeMode();
  const isDark = themeMode === 'dark';

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const persisted = await invoke<NotificationEntry[]>('get_notifications');
        setInbox(persisted.filter((item) => !item.isArchived));
      } catch {
        setInbox([]);
      }
    };

    void loadNotifications();
  }, []);

  const addToast = useCallback((payload: NotificationPayload) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const nextToast: NotificationToast = {
      id,
      title: payload.title ?? 'Update',
      message: payload.message ?? 'A background task completed.',
      variant: payload.variant ?? 'info',
      duration: payload.duration ?? 6000,
    };

    setToasts((current) => [...current, nextToast]);

    if (payload.target === 'inbox' || payload.target === 'both') {
      const createdAt = new Date().toISOString();
      const entry: NotificationEntry = {
        id: `notif-${id}`,
        title: payload.title ?? 'Update',
        message: payload.message ?? 'A background task completed.',
        variant: payload.variant ?? 'info',
        isRead: false,
        isPinned: false,
        isArchived: false,
        createdAt,
        route: payload.route,
        routeParams: payload.routeParams,
      };
      setInbox((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
      void invoke('save_notification', { notification: entry });
    }

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, nextToast.duration);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const markNotificationAsRead = useCallback(async (id: string) => {
    setInbox((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
    await invoke('mark_notification_read', { id });
  }, []);

  const togglePinnedNotification = useCallback(async (id: string) => {
    setInbox((current) => current.map((item) => item.id === id ? { ...item, isPinned: !item.isPinned } : item));
    await invoke('toggle_notification_pin', { id });
  }, []);

  const archiveNotification = useCallback(async (id: string) => {
    setInbox((current) => current.filter((item) => item.id !== id));
    await invoke('archive_notification', { id });
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setInbox((current) => current.map((item) => ({ ...item, isRead: true })));
    await invoke('mark_all_notifications_read');
  }, []);

  const archiveAllNotifications = useCallback(async () => {
    setInbox([]);
    await invoke('archive_all_notifications');
  }, []);

  const unreadCount = useMemo(() => inbox.filter((item) => !item.isRead).length, [inbox]);

  const value = useMemo<NotificationContextValue>(() => ({
    toasts,
    inbox,
    unreadCount,
    addToast,
    dismissToast,
    markNotificationAsRead,
    togglePinnedNotification,
    archiveNotification,
    markAllNotificationsAsRead,
    archiveAllNotifications,
  }), [addToast, archiveAllNotifications, archiveNotification, dismissToast, inbox, markAllNotificationsAsRead, markNotificationAsRead, toasts, togglePinnedNotification, unreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      <NotificationBridge />
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: 'min(360px, calc(100vw - 32px))',
          zIndex: 99999,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            isDark={isDark}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return context;
}
