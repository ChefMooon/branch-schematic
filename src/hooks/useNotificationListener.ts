import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useNotifications } from '../components/notifications/NotificationProvider';

export interface NotificationPayload {
  title?: string;
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  target?: 'toast' | 'inbox' | 'both';
  route?: string;
  routeParams?: Record<string, string>;
}

const EVENT_NAME = 'repo-index-complete';

export function useNotificationListener() {
  const { addToast } = useNotifications();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    async function subscribe() {
      const cleanup = await listen<NotificationPayload>(EVENT_NAME, (event) => {
        addToast(event.payload);
      });
      if (disposed) {
        void cleanup();
      } else {
        unlisten = cleanup;
      }
    }

    void subscribe().catch(() => undefined);

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [addToast]);

  return null;
}
