import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNotificationListener, type NotificationPayload } from '../../hooks/useNotificationListener';
import { Toast } from './toast';
import {
  DEFAULT_TOAST_DURATION,
  TOAST_EXIT_DURATION,
  initialToastLifecycleState,
  toastLifecycleReducer,
} from './toastLifecycle';

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

interface PersistedNotificationEntry {
  id: string;
  title: string;
  message: string;
  variant: NotificationVariant;
  isRead: number;
  isPinned: number;
  isArchived: number;
  createdAt: string;
  route?: string;
  routeParamsJson?: string;
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
  const [toastLifecycle, dispatchToast] = useReducer(toastLifecycleReducer, initialToastLifecycleState);
  const [inbox, setInbox] = useState<NotificationEntry[]>([]);
  const nextToastId = useRef(0);
  const toastTimers = useRef(new Map<number, number>());
  const exitTimers = useRef(new Map<number, number>());
  const themeMode = useAppThemeMode();
  const isDark = themeMode === 'dark';

  const toasts = useMemo<NotificationToast[]>(() => toastLifecycle.visible.map(({ lifecycle: _lifecycle, remainingMs: _remainingMs, startedAt: _startedAt, isPaused: _isPaused, ...toast }) => toast), [toastLifecycle.visible]);

  useEffect(() => {
    for (const [id, timer] of toastTimers.current) {
      const toast = toastLifecycle.visible.find((item) => item.id === id);
      if (!toast || toast.lifecycle !== 'visible' || toast.isPaused) {
        window.clearTimeout(timer);
        toastTimers.current.delete(id);
      }
    }

    for (const toast of toastLifecycle.visible) {
      if (toast.lifecycle !== 'visible' || toast.isPaused || toastTimers.current.has(toast.id)) continue;
      const timer = window.setTimeout(() => {
        toastTimers.current.delete(toast.id);
        dispatchToast({ type: 'begin-exit', id: toast.id });
      }, toast.remainingMs);
      toastTimers.current.set(toast.id, timer);
    }

    for (const [id, timer] of exitTimers.current) {
      if (!toastLifecycle.visible.some((toast) => toast.id === id && toast.lifecycle === 'exiting')) {
        window.clearTimeout(timer);
        exitTimers.current.delete(id);
      }
    }

    for (const toast of toastLifecycle.visible) {
      if (toast.lifecycle !== 'exiting' || exitTimers.current.has(toast.id)) continue;
      const timer = window.setTimeout(() => {
        exitTimers.current.delete(toast.id);
        dispatchToast({ type: 'finish-exit', id: toast.id, now: Date.now() });
      }, TOAST_EXIT_DURATION + 40);
      exitTimers.current.set(toast.id, timer);
    }
  }, [toastLifecycle]);

  useEffect(() => () => {
    for (const timer of toastTimers.current.values()) window.clearTimeout(timer);
    for (const timer of exitTimers.current.values()) window.clearTimeout(timer);
    toastTimers.current.clear();
    exitTimers.current.clear();
  }, []);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const persisted = await invoke<PersistedNotificationEntry[]>('get_notifications');
        setInbox(persisted.filter((item) => !item.isArchived).map((item) => ({
          ...item,
          isRead: Boolean(item.isRead),
          isPinned: Boolean(item.isPinned),
          isArchived: Boolean(item.isArchived),
          routeParams: item.routeParamsJson ? JSON.parse(item.routeParamsJson) as Record<string, string> : undefined,
        })));
      } catch {
        setInbox([]);
      }
    };

    void loadNotifications();
  }, []);

  const addToast = useCallback((payload: NotificationPayload) => {
    nextToastId.current += 1;
    const id = nextToastId.current;
    const nextToast: NotificationToast = {
      id,
      title: payload.title ?? 'Update',
      message: payload.message ?? 'A background task completed.',
      variant: payload.variant ?? 'info',
      duration: Number.isFinite(payload.duration) && (payload.duration ?? 0) > 0
        ? payload.duration as number
        : DEFAULT_TOAST_DURATION,
    };

    dispatchToast({ type: 'enqueue', toast: nextToast, now: Date.now() });

    if (payload.target === 'inbox' || payload.target === 'both') {
      const createdAt = new Date().toISOString();
      const entry: NotificationEntry = {
        id: `notif-${crypto.randomUUID()}`,
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
      const persistedEntry: PersistedNotificationEntry = {
        id: entry.id,
        title: entry.title,
        message: entry.message,
        variant: entry.variant,
        isRead: entry.isRead ? 1 : 0,
        isPinned: entry.isPinned ? 1 : 0,
        isArchived: entry.isArchived ? 1 : 0,
        createdAt: entry.createdAt,
        route: entry.route,
        routeParamsJson: entry.routeParams ? JSON.stringify(entry.routeParams) : undefined,
      };
      void invoke('save_notification', { notification: persistedEntry });
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    dispatchToast({ type: 'begin-exit', id });
  }, []);

  const pauseToast = useCallback((id: number) => {
    dispatchToast({ type: 'pause', id, now: Date.now() });
  }, []);

  const resumeToast = useCallback((id: number) => {
    dispatchToast({ type: 'resume', id, now: Date.now() });
  }, []);

  const finishToastExit = useCallback((id: number) => {
    const timer = exitTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      exitTimers.current.delete(id);
    }
    dispatchToast({ type: 'finish-exit', id, now: Date.now() });
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
        aria-atomic="false"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: 'min(360px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
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
            isExiting={toastLifecycle.visible.find((item) => item.id === toast.id)?.lifecycle === 'exiting'}
            onPause={pauseToast}
            onResume={resumeToast}
            onExitComplete={finishToastExit}
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
