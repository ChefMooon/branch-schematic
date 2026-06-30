import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useNotifications } from '../components/notifications/NotificationProvider';

export interface NotificationPayload {
  title?: string;
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

const EVENT_NAME = 'repo-index-complete';

export function useNotificationListener() {
  const { addToast } = useNotifications();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function subscribe() {
      unlisten = await listen<NotificationPayload>(EVENT_NAME, (event) => {
        addToast(event.payload);
      });
    }

    void subscribe();

    return () => {
      if (unlisten) {
        void unlisten();
      }
    };
  }, [addToast]);

  return null;
}
