import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNotificationListener, type NotificationPayload } from '../../hooks/use-notification-listener';
import { Toast } from './toast';

export type NotificationVariant = 'info' | 'success' | 'error';

export interface NotificationToast extends NotificationPayload {
  id: number;
  variant: NotificationVariant;
  duration: number;
}

interface NotificationContextValue {
  toasts: NotificationToast[];
  addToast: (payload: NotificationPayload) => void;
  dismissToast: (id: number) => void;
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
  const themeMode = useAppThemeMode();
  const isDark = themeMode === 'dark';

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

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, nextToast.duration);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    toasts,
    addToast,
    dismissToast,
  }), [addToast, dismissToast, toasts]);

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
